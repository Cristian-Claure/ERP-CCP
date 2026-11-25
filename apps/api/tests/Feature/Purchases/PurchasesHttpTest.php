<?php

use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Tests\Support\PurchaseScenario;

beforeEach(fn () => $this->s = PurchaseScenario::make());

function purchasesUser(PurchaseScenario $s, string $role): User
{
    $user = User::factory()->for($s->inv->company)->create();
    CompanyContext::run($s->inv->company->id, fn () => $user->assignRole($role));

    return $user;
}

function orderBody(PurchaseScenario $s, string $qty = '10', string $price = '11.30'): array
{
    return [
        'supplier_id' => $s->supplier->id,
        'warehouse_id' => $s->inv->warehouse->id,
        'order_date' => $s->today(),
        'lines' => [['product_id' => $s->inv->product->id, 'quantity' => $qty, 'unit_price' => $price]],
    ];
}

it('runs the whole flow over HTTP: OC, approval, partial receipt with freight, payment and dashboard', function () {
    $s = $this->s;
    $this->actingAs($s->inv->user)->withHeaders(spaHeaders());

    $order = $this->postJson('/api/v1/purchases/orders', orderBody($s))->assertCreated()->assertJsonPath('status', 'draft');
    $id = $order->json('id');
    $this->postJson("/api/v1/purchases/orders/{$id}/approve")->assertOk()->assertJsonPath('number', 'OC-000001');

    $lineId = $order->json('lines.0.id');
    $receipt = $this->withHeaders(['Idempotency-Key' => 'rec-1'])->postJson("/api/v1/purchases/orders/{$id}/receipts", [
        'receipt_date' => $s->today(),
        'supplier_invoice_number' => '000123',
        'supplier_invoice_date' => $s->today(),
        'lines' => [['purchase_order_line_id' => $lineId, 'quantity' => '4', 'unit_price' => '11.30']],
        'costs' => [['kind' => 'freight', 'amount' => '10.00', 'description' => 'Transporte Warnes']],
    ])->assertCreated()
        ->assertJsonPath('invoice_total', '45.20')
        ->assertJsonPath('vat_credit', '5.88')
        ->assertJsonPath('cost_total', '49.32')
        ->assertJsonPath('inventory_document.number', 'ENT-000001');

    // Double submit with the same key: same receipt.
    $this->withHeaders(['Idempotency-Key' => 'rec-1'])->postJson("/api/v1/purchases/orders/{$id}/receipts", [
        'receipt_date' => $s->today(),
        'lines' => [['purchase_order_line_id' => $lineId, 'quantity' => '4', 'unit_price' => '11.30']],
    ])->assertOk()->assertJsonPath('id', $receipt->json('id'));

    $this->getJson("/api/v1/purchases/orders/{$id}")->assertJsonPath('status', 'partially_received')
        ->assertJsonPath('lines.0.pending_quantity', '6.0000');

    $this->postJson('/api/v1/payables/payments', [
        'supplier_id' => $s->supplier->id, 'payment_date' => $s->today(), 'method' => 'transfer', 'amount' => '20.00',
    ])->assertCreated()->assertJsonPath('allocations.0.number', 'REC-000001');

    $this->getJson('/api/v1/dashboard/purchases')->assertOk()
        ->assertJsonPath('pending_orders.count', 1)
        ->assertJsonPath('pending_orders.pending_value', '67.80')
        ->assertJsonPath('payables.total', '25.20');
    $this->getJson("/api/v1/purchases/suppliers/{$s->supplier->id}")->assertJsonPath('balance', '25.20')
        ->assertJsonPath('aging.total', '25.20');
});

it('enforces per-action purchase permissions for each demo role', function (string $role, array $can) {
    $s = $this->s;
    $draft = $s->order([[$s->inv->product, '1', '10.00']]);
    $approved = $s->approvedOrder();
    $receipt = $s->receive($s->approvedOrder(), [[0, '1']]);
    $user = purchasesUser($s, $role);
    $this->actingAs($user)->withHeaders(spaHeaders());
    $status = fn (bool $allowed, int $ok = 200) => $allowed ? $ok : 403;

    expect($this->getJson('/api/v1/purchases/suppliers')->status())->toBe($status($can['view']))
        ->and($this->getJson('/api/v1/purchases/orders')->status())->toBe($status($can['view']))
        ->and($this->postJson('/api/v1/purchases/orders', orderBody($s))->status())->toBe($status($can['create'], 201))
        ->and($this->postJson("/api/v1/purchases/orders/{$draft->id}/approve")->status())->toBe($status($can['create'] || $can['approve']));

    $line = $approved->lines()->first();
    expect($this->postJson("/api/v1/purchases/orders/{$approved->id}/receipts", [
        'receipt_date' => $s->today(),
        'lines' => [['purchase_order_line_id' => $line->id, 'quantity' => '1', 'unit_price' => '11.30']],
    ])->status())->toBe($status($can['receive'], 201));

    expect($this->postJson('/api/v1/payables/payments', [
        'supplier_id' => $s->supplier->id, 'payment_date' => $s->today(), 'method' => 'cash', 'amount' => '1.00',
    ])->status())->toBe($status($can['pay'], 201))
        ->and($this->postJson("/api/v1/purchases/receipts/{$receipt->id}/void", ['reason' => 'Prueba de permisos'])->status())
        ->toBe(match (true) {
            ! $can['void'] => 403,
            $can['pay'] => 422, // the payment above was applied FIFO to it
            default => 200,
        });
})->with([
    'admin' => ['admin', ['view' => true, 'create' => true, 'approve' => true, 'receive' => true, 'void' => true, 'pay' => true]],
    'gerente' => ['gerente', ['view' => true, 'create' => true, 'approve' => true, 'receive' => true, 'void' => true, 'pay' => true]],
    'almacenero' => ['almacenero', ['view' => true, 'create' => false, 'approve' => false, 'receive' => true, 'void' => false, 'pay' => false]],
    'vendedor' => ['vendedor', ['view' => false, 'create' => false, 'approve' => false, 'receive' => false, 'void' => false, 'pay' => false]],
]);

it('hides balances without payables.view', function () {
    $s = $this->s;
    $s->receive($s->approvedOrder(), [[0, '1']]);
    $this->actingAs(purchasesUser($s, 'almacenero'))->withHeaders(spaHeaders());

    $res = $this->getJson("/api/v1/purchases/suppliers/{$s->supplier->id}")->assertOk();
    expect($res->json())->not->toHaveKeys(['balance', 'aging']);
    $this->getJson('/api/v1/payables/summary')->assertForbidden();
});

it('isolates purchases between companies', function () {
    $a = $this->s;
    $b = PurchaseScenario::make();
    $orderB = $b->approvedOrder();
    $receiptB = $b->receive($orderB, [[0, '1']]);

    $this->actingAs($a->inv->user)->withHeaders(spaHeaders());
    $this->getJson("/api/v1/purchases/orders/{$orderB->id}")->assertNotFound();
    $this->getJson("/api/v1/purchases/receipts/{$receiptB->id}")->assertNotFound();
    $this->getJson("/api/v1/purchases/suppliers/{$b->supplier->id}")->assertNotFound();
    $this->postJson("/api/v1/purchases/orders/{$orderB->id}/approve")->assertNotFound();
    expect($this->getJson('/api/v1/purchases/orders')->json('meta.total'))->toBe(0)
        ->and($this->getJson('/api/v1/purchases/suppliers')->json('meta.total'))->toBe(2);

    // Ids of another company inside a payload are invisible too.
    $this->postJson('/api/v1/purchases/orders', [...orderBody($a), 'supplier_id' => $b->supplier->id])
        ->assertStatus(422)->assertJsonPath('error.details.supplier_id.0', 'Selecciona un proveedor activo.');
});
