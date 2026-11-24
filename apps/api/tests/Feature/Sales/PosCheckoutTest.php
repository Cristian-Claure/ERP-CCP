<?php

use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\CustomerPayment;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Services\CustomerVerifier;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Tests\Support\SalesScenario;

beforeEach(function () {
    $this->s = SalesScenario::make(stock: '10', unitCost: '10.00');
    $this->s->inv->company->update(['default_customer_id' => $this->s->customer->id]);
});

function posUser(SalesScenario $s, string $role): User
{
    $user = User::factory()->for($s->inv->company)->create();
    CompanyContext::run($s->inv->company->id, fn () => $user->assignRole($role));

    return $user;
}

/** 2 × 20.00 = 40.00 by default; payments as the POS sends them (cash = amount tendered). */
function posSale(SalesScenario $s, array $payments, array $overrides = [], string $key = 'pos-key-1', ?User $as = null)
{
    $test = test();

    return $test->actingAs($as ?? $s->inv->user)->withHeaders([...spaHeaders(), 'Idempotency-Key' => $key])
        ->postJson('/api/v1/pos/sales', [
            'type' => 'sales_note',
            'warehouse_id' => $s->inv->warehouse->id,
            'lines' => [['product_id' => $s->inv->product->id, 'quantity' => '2', 'unit_price' => '20.00']],
            'payments' => $payments,
            ...$overrides,
        ]);
}

it('posts a counter sale with mixed payments (QR + cash with change) through the sales engine', function () {
    $s = $this->s;
    $response = posSale($s, [['method' => 'qr', 'amount' => '15.00'], ['method' => 'cash', 'amount' => '30.00']])
        ->assertCreated()
        ->assertJsonPath('status', 'posted')
        ->assertJsonPath('channel', 'pos')
        ->assertJsonPath('total', '40.00')
        ->assertJsonPath('paid_amount', '40.00')
        ->assertJsonPath('cash_received', '30.00')
        ->assertJsonPath('change_amount', '5.00');

    expect($response->json('number'))->toBe('NV-000001')
        ->and($response->json('inventory_document.number'))->toStartWith('SAL-');

    $s->as(function () use ($s, $response) {
        $receipts = CustomerPayment::query()->where('sales_document_id', $response->json('id'))->orderBy('id')->get();
        expect($receipts->map(fn ($r) => [$r->method->value, (string) $r->amount])->all())
            ->toBe([['qr', '15.00'], ['cash', '25.00']])
            ->and($s->fresh($s->customer)->balance)->toBe('0.00')
            ->and(app(CustomerVerifier::class)->verify($s->inv->company->id))->toBe([]);
    });
});

it('voids a mixed-payment sale together with all its automatic receipts', function () {
    $s = $this->s;
    $id = posSale($s, [['method' => 'card', 'amount' => '10.00'], ['method' => 'cash', 'amount' => '30.00']])->json('id');

    $this->postJson("/api/v1/sales/documents/{$id}/void", ['reason' => 'Error en el cobro'])->assertOk()
        ->assertJsonPath('status', 'voided');

    $s->as(function () use ($s, $id) {
        expect(CustomerPayment::query()->where('sales_document_id', $id)->pluck('status')->all())
            ->toBe([PaymentStatus::Voided, PaymentStatus::Voided])
            ->and($s->fresh($s->customer)->balance)->toBe('0.00')
            ->and(app(CustomerVerifier::class)->verify($s->inv->company->id))->toBe([])
            ->and($s->inv->balance()->quantity)->toBe('10.0000');
    });
});

it('rejects payments that do not cover the total or exceed it without cash', function () {
    $s = $this->s;
    posSale($s, [['method' => 'cash', 'amount' => '39.99']])
        ->assertStatus(422)->assertJsonPath('error.details.payments.0', 'Falta cobrar 0.01.');
    posSale($s, [['method' => 'qr', 'amount' => '45.00']], key: 'k2')
        ->assertStatus(422);

    $s->as(fn () => expect(SalesDocument::query()->count())->toBe(0));
});

it('is atomic: a sale without stock leaves no draft, no receipt and no number used', function () {
    $s = $this->s;
    posSale($s, [['method' => 'cash', 'amount' => '500.00']], [
        'lines' => [['product_id' => $s->inv->product->id, 'quantity' => '11', 'unit_price' => '20.00']],
    ])->assertStatus(422)->assertJsonPath('error.code', 'insufficient_stock');

    $s->as(fn () => expect(SalesDocument::query()->count())->toBe(0)
        ->and(CustomerPayment::query()->count())->toBe(0));

    expect(posSale($s, [['method' => 'cash', 'amount' => '40.00']], key: 'k2')->json('number'))->toBe('NV-000001');
});

it('is idempotent: a double Enter with the same key returns the same sale', function () {
    $s = $this->s;
    $first = posSale($s, [['method' => 'cash', 'amount' => '50.00']])->assertCreated();
    $second = posSale($s, [['method' => 'cash', 'amount' => '50.00']])->assertOk();

    expect($second->json('id'))->toBe($first->json('id'));
    $s->as(fn () => expect(SalesDocument::query()->count())->toBe(1)
        ->and(CustomerPayment::query()->count())->toBe(1)
        ->and($s->inv->balance()->quantity)->toBe('8.0000'));

    $this->withHeaders(['Idempotency-Key' => ''])->postJson('/api/v1/pos/sales', [])->assertStatus(422);
});

it('finds the customer by NIT/CI or creates it on the fly with minimal data', function () {
    $s = $this->s;
    $seller = posUser($s, 'vendedor');
    $customer = ['document_type' => 'nit', 'document_number' => '1234567019', 'name' => 'Ferretería Nueva SRL'];

    $sale = posSale($s, [['method' => 'cash', 'amount' => '40.00']], ['type' => 'invoice', 'customer' => $customer], as: $seller)
        ->assertCreated()->assertJsonPath('customer.name', 'Ferretería Nueva SRL');
    posSale($s, [['method' => 'cash', 'amount' => '40.00']], ['customer' => [...$customer, 'name' => 'Otro']], 'k2', $seller)
        ->assertCreated()->assertJsonPath('customer_id', $sale->json('customer_id'));

    $this->getJson('/api/v1/pos/customers/lookup?document=1234567019')->assertOk()
        ->assertJsonPath('data.name', 'Ferretería Nueva SRL');
    $this->getJson('/api/v1/pos/customers/lookup?document=999')->assertOk()->assertJsonPath('data', null);

    $s->as(fn () => expect(Customer::query()->where('document_number', '1234567019')->count())->toBe(1)
        ->and(Customer::query()->where('document_number', '1234567019')->value('payment_terms')->value)->toBe('cash'));

    // Without a name a new NIT cannot be registered; without the default customer the S/N sale fails clearly.
    posSale($s, [['method' => 'cash', 'amount' => '40.00']], ['customer' => ['document_number' => '555']], 'k3')
        ->assertStatus(422);
});

it('needs the below-cost authorization like any sale, and nothing persists until it is given', function () {
    $s = $this->s;
    $cheap = ['lines' => [['product_id' => $s->inv->product->id, 'quantity' => '2', 'unit_price' => '5.00']]];

    posSale($s, [['method' => 'cash', 'amount' => '10.00']], $cheap)
        ->assertStatus(422)->assertJsonPath('error.code', 'price_below_cost');
    $s->as(fn () => expect(SalesDocument::query()->count())->toBe(0));

    posSale($s, [['method' => 'cash', 'amount' => '10.00']], [...$cheap, 'below_cost_reason' => 'Liquidación de mostrador'], 'k2')
        ->assertCreated()->assertJsonPath('below_cost_authorization.reason', 'Liquidación de mostrador');
});

it('serves the catalog with the stock of the warehouse and enforces POS permissions', function () {
    $s = $this->s;
    $this->actingAs($s->inv->user)->withHeaders(spaHeaders())
        ->getJson('/api/v1/pos/catalog?warehouse_id='.$s->inv->warehouse->id)->assertOk()
        ->assertJsonPath('data.0.sku', 'ARR-1')
        ->assertJsonPath('data.0.stock', '10.0000')
        ->assertJsonPath('data.0.sale_price', '20.00');

    $this->getJson('/api/v1/pos/catalog?warehouse_id='.$s->inv->branch->id)->assertOk()
        ->assertJsonPath('data.0.stock', '0.0000');

    $this->patchJson('/api/v1/pos/preferences', ['warehouse_id' => $s->inv->branch->id])->assertOk();
    expect($s->inv->user->fresh()->pos_warehouse_id)->toBe($s->inv->branch->id);

    $storekeeper = posUser($s, 'almacenero');
    $this->actingAs($storekeeper)->getJson('/api/v1/pos/catalog?warehouse_id='.$s->inv->warehouse->id)->assertForbidden();
    posSale($s, [['method' => 'cash', 'amount' => '40.00']], as: $storekeeper)->assertForbidden();
});
