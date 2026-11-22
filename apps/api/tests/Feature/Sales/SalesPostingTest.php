<?php

use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Sales\Data\PostingAuthorization;
use App\Domain\Sales\Exceptions\CreditLimitExceededException;
use App\Domain\Sales\Exceptions\PriceBelowCostException;
use App\Domain\Sales\Models\CustomerLedgerEntry;
use App\Domain\Sales\Models\CustomerPayment;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Models\AuditLog;
use App\Domain\Shared\Models\DocumentSequence;
use Tests\Support\SalesScenario;

beforeEach(fn () => $this->s = SalesScenario::make());

it('posts a sale and its SAL- atomically, linked both ways', function () {
    $s = $this->s;

    $sale = $s->sale([['quantity' => '3', 'unit_price' => '20.00']]);
    $exit = InventoryDocument::query()->withoutGlobalScopes()->findOrFail($sale->inventory_document_id);

    expect($sale->number)->toBe('VTA-000001')
        ->and($sale->status->value)->toBe('posted')
        ->and($exit->number)->toBe('SAL-000001')
        ->and($exit->status->value)->toBe('posted')
        ->and($exit->reference)->toBe('VTA-000001')
        ->and($exit->source_type)->toBe('sales_document')
        ->and($exit->source_id)->toBe($sale->id)
        ->and($s->inv->state()[0])->toBe('97.0000');
});

it('rejects a sale without stock and does not consume a number nor leave anything behind', function () {
    $s = $this->s;

    $draft = $s->draft('invoice', [['quantity' => '101']]);

    expect(fn () => $s->post($draft))->toThrow(InsufficientStockException::class);

    expect($draft->fresh()->status->value)->toBe('draft')
        ->and($draft->fresh()->number)->toBeNull()
        ->and(InventoryDocument::query()->withoutGlobalScopes()->where('type', 'exit')->count())->toBe(0)
        ->and(CustomerLedgerEntry::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(DocumentSequence::query()->withoutGlobalScopes()->where('key', 'sales.invoice')->value('last_number'))->toBeNull()
        ->and($s->inv->state()[0])->toBe('100.0000');

    // The next successful sale takes number 1.
    expect($s->sale()->number)->toBe('VTA-000001');
});

it('stores VAT broken down from the VAT-included total', function () {
    $sale = $this->s->sale([['quantity' => '1', 'unit_price' => '113.00']]);

    expect($sale->total)->toBe('113.00')
        ->and($sale->iva_amount)->toBe('14.69')
        ->and($sale->net_amount)->toBe('98.31');
});

it('breaks down VAT on a sales note only when the company enables it', function () {
    $s = $this->s;

    $note = $s->sale([['unit_price' => '113.00']], type: 'sales_note');
    expect($note->number)->toBe('NV-000001')->and($note->iva_amount)->toBe('0.00')->and($note->net_amount)->toBe('113.00');

    $s->inv->company->update(['sales_note_vat_breakdown' => true]);
    $note2 = $s->sale([['unit_price' => '113.00']], type: 'sales_note');
    expect($note2->iva_amount)->toBe('14.69');
});

it('computes the margin per line on the net amount minus the average exit cost', function () {
    $s = $this->s; // stock 100 @ 10.00

    $sale = $s->sale([['quantity' => '2', 'unit_price' => '22.60']]); // total 45.20, VAT 5.88, net 39.32
    $line = $sale->lines->first();

    expect($line->unit_cost)->toBe('10.0000')
        ->and($line->cost_total)->toBe('20.00')
        ->and($line->net_amount)->toBe('39.32')
        ->and($line->margin)->toBe('19.32')
        ->and($sale->cost_total)->toBe('20.00')
        ->and($sale->margin_total)->toBe('19.32');
});

it('prorates the global discount so line margins add up exactly', function () {
    $s = $this->s;

    $sale = $s->sale(
        [['quantity' => '1', 'unit_price' => '30.00'], ['quantity' => '1', 'unit_price' => '30.00'], ['quantity' => '1', 'unit_price' => '30.00']],
        ['global_discount' => '10.00'],
    );

    $lines = $sale->lines;
    expect($lines->pluck('global_discount_share')->all())->toBe(['3.33', '3.33', '3.34'])
        ->and($sale->total)->toBe('80.00')
        ->and(bcadd(bcadd($lines[0]->margin, $lines[1]->margin, 2), $lines[2]->margin, 2))->toBe($sale->margin_total);
});

it('creates the charge and its automatic receipt in the same transaction for a cash sale', function () {
    $s = $this->s;

    $sale = $s->sale([['quantity' => '2', 'unit_price' => '20.00']], ['payment_method' => 'qr']);

    $payment = CustomerPayment::query()->withoutGlobalScopes()->sole();
    expect($payment->number)->toBe('COB-000001')
        ->and($payment->amount)->toBe('40.00')
        ->and($payment->method->value)->toBe('qr')
        ->and($payment->sales_document_id)->toBe($sale->id)
        ->and($sale->fresh()->paid_amount)->toBe('40.00')
        ->and(CustomerLedgerEntry::query()->withoutGlobalScopes()->pluck('kind')->map->value->all())->toBe(['charge', 'payment'])
        ->and($s->fresh($s->customer)->balance)->toBe('0.00');
});

it('charges a credit sale with its due date and leaves it open', function () {
    $s = $this->s;

    $sale = $s->creditSale('5', '20.00');

    expect($sale->due_date->toDateString())->toBe($sale->document_date->copy()->addDays(30)->toDateString())
        ->and($sale->paid_amount)->toBe('0.00')
        ->and($s->fresh($s->creditCustomer)->balance)->toBe('100.00');
});

it('blocks a credit sale above the limit before touching stock, unless overridden with permission', function () {
    $s = $this->s; // limit 1000

    $s->creditSale('40', '20.00'); // balance 800
    $draft = $s->draft('invoice', [['quantity' => '15', 'unit_price' => '20.00']], ['customer_id' => $s->creditCustomer->id, 'payment_terms' => 'credit']);

    expect(fn () => $s->post($draft))->toThrow(CreditLimitExceededException::class);
    expect(InventoryDocument::query()->withoutGlobalScopes()->where('type', 'exit')->count())->toBe(1)
        ->and($s->inv->state()[0])->toBe('60.0000');

    $posted = $s->post($draft, new PostingAuthorization(creditOverrideReason: 'Cliente histórico, pago garantizado'));

    expect($posted->status->value)->toBe('posted')
        ->and($posted->credit_override_by)->toBe($s->inv->user->id)
        ->and($posted->credit_override_reason)->toBe('Cliente histórico, pago garantizado')
        ->and(AuditLog::query()->where('event', 'sales.credit_limit.overridden')->count())->toBe(1);
});

it('blocks selling below cost or below the minimum price unless authorized, and audits who and why', function () {
    $s = $this->s; // cost 10, min price 12

    $belowCost = $s->draft('invoice', [['unit_price' => '11.00']]); // net 9.57 < 10
    expect(fn () => $s->post($belowCost))->toThrow(function (PriceBelowCostException $e) {
        expect($e->lines[0]['rule'])->toBe('below_cost')
            ->and($e->details())->not->toHaveKey('lines.0.unit_cost');
    });

    $s->inv->product->update(['min_price' => '12.50']);
    $s->inv->product->refresh();

    $cheapButAboveCost = $s->draft('invoice', [['unit_price' => '12.00']]); // net 10.62 > 10, but < 12.50
    expect(fn () => $s->post($cheapButAboveCost))->toThrow(fn (PriceBelowCostException $e) => expect($e->lines[0]['rule'])->toBe('below_min_price'));

    // Nothing was written by the failed attempts.
    expect(SalesDocument::query()->withoutGlobalScopes()->whereNotNull('number')->count())->toBe(0)
        ->and($s->inv->state()[0])->toBe('100.0000');

    $posted = $s->post($belowCost, new PostingAuthorization(belowCostReason: 'Liquidación de lote por vencer'));
    expect($posted->below_cost_authorized_by)->toBe($s->inv->user->id)
        ->and($posted->below_cost_reason)->toBe('Liquidación de lote por vencer')
        ->and(AuditLog::query()->where('event', 'sales.below_cost.authorized')->count())->toBe(1);
});

it('is idempotent: posting twice returns the same sale without a second exit or charge', function () {
    $s = $this->s;

    $draft = $s->draft();
    $first = $s->post($draft);
    $second = $s->post($draft);

    expect($second->number)->toBe($first->number)
        ->and(InventoryDocument::query()->withoutGlobalScopes()->where('type', 'exit')->count())->toBe(1)
        ->and(CustomerLedgerEntry::query()->withoutGlobalScopes()->where('kind', 'charge')->count())->toBe(1);
});

it('posts a quote with its own numbering and no effect on stock or receivables', function () {
    $s = $this->s;

    $quote = $s->sale([['quantity' => '5']], type: 'quote');

    expect($quote->number)->toBe('COT-000001')
        ->and($quote->inventory_document_id)->toBeNull()
        ->and($quote->valid_until->toDateString())->toBe($quote->document_date->copy()->addDays(15)->toDateString())
        ->and($s->inv->state()[0])->toBe('100.0000')
        ->and(CustomerLedgerEntry::query()->withoutGlobalScopes()->count())->toBe(0);
});
