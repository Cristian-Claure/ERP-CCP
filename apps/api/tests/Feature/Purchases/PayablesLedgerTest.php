<?php

use App\Domain\Purchases\Actions\VoidSupplierPayment;
use App\Domain\Purchases\Contracts\PurchaseSuggestionProvider;
use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Models\SupplierLedgerEntry;
use App\Domain\Purchases\Services\SupplierVerifier;
use Tests\Support\PurchaseScenario;

beforeEach(fn () => $this->s = PurchaseScenario::make());

it('keeps the supplier ledger: charge per receipt, FIFO payments, reversals and a clean verify', function () {
    $s = $this->s;
    $a = $s->receive($s->approvedOrder(), [[0, '10']]);           // 113.00
    $b = $s->receive($s->approvedOrder(), [[1, '5']]);            //  35.00
    expect($s->supplier->refresh()->balance)->toBe('148.00')
        ->and($a->due_date->toDateString())->toBe(now($s->inv->company->timezone)->addDays(30)->toDateString());

    $payment = $s->pay($s->supplier, '120.00');
    expect($payment->number)->toBe('PAG-000001')
        ->and($payment->allocations->pluck('amount')->all())->toBe(['113.00', '7.00'])
        ->and($a->refresh()->paid_amount)->toBe('113.00')
        ->and($b->refresh()->paid_amount)->toBe('7.00')
        ->and($s->supplier->refresh()->balance)->toBe('28.00');

    expect(fn () => $s->pay($s->supplier, '28.01'))
        ->toThrow(fn (PurchaseException $e) => expect($e->errorCode())->toBe('payment_exceeds_debt'));

    $s->as(fn () => app(VoidSupplierPayment::class)->handle($payment, $s->inv->user, 'Transferencia rechazada'));
    expect($s->supplier->refresh()->balance)->toBe('148.00')->and($a->refresh()->paid_amount)->toBe('0.00');

    $s->as(function () use ($s) {
        $kinds = SupplierLedgerEntry::query()->orderBy('id')->pluck('kind')->map->value->all();
        expect($kinds)->toBe(['charge', 'charge', 'payment', 'reversal'])
            ->and(SupplierLedgerEntry::query()->latest('id')->value('balance_after'))->toBe('148.00')
            ->and(app(SupplierVerifier::class)->verify($s->inv->company->id))->toBe([]);
    });
    $this->artisan('suppliers:verify')->assertSuccessful();
});

it('detects and repairs a corrupted supplier balance cache', function () {
    $s = $this->s;
    $s->receive($s->approvedOrder(), [[0, '10']]);
    $s->supplier->forceFill(['balance' => '1.00'])->save();

    $this->artisan('suppliers:verify')->assertFailed();
    $this->artisan('suppliers:verify --repair')->assertSuccessful();
    expect($s->supplier->refresh()->balance)->toBe('113.00');
});

it('suggests purchases from min stock, 30-day sales and the supplier lead time, minus what is on order', function () {
    $s = $this->s;
    $s->inv->product->update(['min_stock' => '20']);
    $s->receive($s->approvedOrder(), [[0, '10']]); // stock 10, last supplier lead time 5 days

    $suggest = fn () => $s->as(fn () => app(PurchaseSuggestionProvider::class)->suggest($s->inv->company->id, $s->inv->warehouse->id));
    $row = collect($suggest())->firstWhere('productId', $s->inv->product->id);
    // No sales yet: 20 + 0 × 5 − 10 − 0 = 10.
    expect($row->suggestedQuantity)->toBe('10')
        ->and($row->supplierId)->toBe($s->supplier->id)
        ->and($row->leadTimeDays)->toBe(5)
        ->and($row->method)->toBe('min_stock_velocity');

    // An approved OC for 6 more is "on order": 20 − 10 − 6 = 4.
    $s->approve($s->order([[$s->inv->product, '6', '11.30']]));
    expect(collect($suggest())->firstWhere('productId', $s->inv->product->id)->suggestedQuantity)->toBe('4');
});
