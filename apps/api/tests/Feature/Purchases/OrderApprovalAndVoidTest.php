<?php

use App\Domain\Purchases\Actions\CancelPurchaseOrder;
use App\Domain\Purchases\Enums\PurchaseOrderStatus;
use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Exceptions\ReceiptInventoryException;
use App\Domain\Purchases\Services\SupplierVerifier;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Models\AuditLog;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Illuminate\Auth\Access\AuthorizationException;
use Tests\Support\PurchaseScenario;

beforeEach(fn () => $this->s = PurchaseScenario::make());

function purchasingUser(PurchaseScenario $s, string $role): User
{
    $user = User::factory()->for($s->inv->company)->create();
    CompanyContext::run($s->inv->company->id, fn () => $user->assignRole($role));

    return $user;
}

it('approves by amount: below the threshold with purchases.create, above it only with purchases.approve', function () {
    $s = $this->s;
    $storekeeper = purchasingUser($s, 'almacenero');
    $manager = purchasingUser($s, 'gerente');

    $small = $s->order([[$s->inv->product, '10', '50.00']]); // 500 <= 1000
    $big = $s->order([[$s->inv->product, '100', '50.00']]);  // 5000 > 1000

    expect(fn () => $s->approve($small, $storekeeper))->toThrow(AuthorizationException::class);
    expect($s->approve($small, $manager)->status)->toBe(PurchaseOrderStatus::Approved);

    $s->inv->company->update(['purchase_approval_threshold' => '100000.00']);
    $creatorOnly = purchasingUser($s, 'gerente');
    expect($s->approve($big, $creatorOnly)->number)->toBe('OC-000002');
});

it('segregation of duties: an OC above the threshold cannot be approved by its creator (audited)', function () {
    $s = $this->s;
    $manager = purchasingUser($s, 'gerente');
    $other = purchasingUser($s, 'gerente');
    $big = $s->order([[$s->inv->product, '100', '50.00']], actor: $manager);

    expect(fn () => $s->approve($big, $manager))
        ->toThrow(fn (PurchaseException $e) => expect($e->errorCode())->toBe('self_approval_not_allowed'));

    expect($big->refresh()->status)->toBe(PurchaseOrderStatus::Draft)
        ->and($big->number)->toBeNull();
    $s->as(fn () => expect(AuditLog::query()->where('event', 'purchases.order.self_approval_blocked')->where('user_id', $manager->id)->count())->toBe(1));

    expect($s->approve($big, $other)->approved_by)->toBe($other->id);
});

it('voids a receipt: reverses its ENT-, the payable and the OC progress; the invoice number is freed', function () {
    $s = $this->s;
    $order = $s->approvedOrder();
    $receipt = $s->receive($order, [[0, '10']], ['supplier_invoice_number' => 'F-9', 'supplier_invoice_date' => $s->today()]);
    expect($s->supplier->refresh()->balance)->toBe('113.00');

    $voided = $s->void($receipt);
    expect($voided->status)->toBe(PaymentStatus::Voided)
        ->and($order->refresh()->status)->toBe(PurchaseOrderStatus::Approved)
        ->and($order->lines()->first()->received_quantity)->toBe('0.0000')
        ->and($s->supplier->refresh()->balance)->toBe('0.00')
        ->and($s->inv->state())->toBe(['0.0000', '9.8310', '0.0000']) // ADR 0004: empty stock keeps the last avg cost
        ->and($s->void($receipt)->status)->toBe(PaymentStatus::Voided); // idempotent

    $s->receive($order, [[0, '10']], ['supplier_invoice_number' => 'F-9', 'supplier_invoice_date' => $s->today()]);
    $s->as(fn () => expect(app(SupplierVerifier::class)->verify($s->inv->company->id))->toBe([]));
});

it('rejects voiding a receipt whose stock was already consumed, leaving everything unchanged', function () {
    $s = $this->s;
    $receipt = $s->receive($s->approvedOrder(), [[0, '10']]);
    $s->inv->exit('7');

    expect(fn () => $s->void($receipt))->toThrow(ReceiptInventoryException::class);

    expect($receipt->refresh()->status)->toBe(PaymentStatus::Posted)
        ->and($s->supplier->refresh()->balance)->toBe('113.00')
        ->and($s->inv->state()[0])->toBe('3.0000');
});

it('rejects voiding a paid receipt until its payment is voided', function () {
    $s = $this->s;
    $receipt = $s->receive($s->approvedOrder(), [[0, '10']]);
    $s->pay($s->supplier, '50.00');

    expect(fn () => $s->void($receipt))
        ->toThrow(fn (PurchaseException $e) => expect($e->errorCode())->toBe('receipt_has_payments'));
});

it('cancels only orders without posted receipts', function () {
    $s = $this->s;
    $cancel = fn ($o) => $s->as(fn () => app(CancelPurchaseOrder::class)->handle($o, $s->inv->user, 'Proveedor sin stock'));

    expect($cancel($s->approvedOrder())->status)->toBe(PurchaseOrderStatus::Cancelled);

    $received = $s->approvedOrder();
    $s->receive($received, [[0, '1']]);
    expect(fn () => $cancel($received))->toThrow(PurchaseException::class, 'sin recepciones');
});
