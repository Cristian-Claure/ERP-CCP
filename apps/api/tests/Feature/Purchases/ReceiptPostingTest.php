<?php

use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Purchases\Enums\PurchaseOrderStatus;
use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Services\SupplierVerifier;
use Tests\Support\PurchaseScenario;

beforeEach(fn () => $this->s = PurchaseScenario::make());

it('receives an OC partially and then totally, each receipt with its own ENT- through the inventory engine', function () {
    $s = $this->s;
    $order = $s->approvedOrder();
    expect($order->number)->toBe('OC-000001');

    $first = $s->receive($order, [[0, '4']]);
    expect($first->number)->toBe('REC-000001')
        ->and($order->refresh()->status)->toBe(PurchaseOrderStatus::PartiallyReceived);

    $s->as(function () use ($first) {
        $entry = InventoryDocument::query()->findOrFail($first->inventory_document_id);
        expect($entry->number)->toBe('ENT-000001')
            ->and($entry->source_type)->toBe('purchase_receipt')
            ->and($entry->source_id)->toBe($first->id);
    });

    $s->receive($order, [[0, '6'], [1, '5']]);
    expect($order->refresh()->status)->toBe(PurchaseOrderStatus::Received)
        ->and($order->lines()->pluck('received_quantity')->all())->toBe(['10.0000', '5.0000'])
        ->and($s->inv->state()[0])->toBe('10.0000');

    $s->as(fn () => expect(app(SupplierVerifier::class)->verify($s->inv->company->id))->toBe([]));
});

it('blocks over-receipt beyond the pending quantity, and allows it within the company tolerance', function () {
    $s = $this->s;
    $order = $s->approvedOrder();
    $s->receive($order, [[0, '8']]);

    expect(fn () => $s->receive($order, [[0, '3']]))
        ->toThrow(fn (PurchaseException $e) => expect($e->errorCode())->toBe('over_receipt')
            ->and($e->errors['lines.0.quantity'][0])->toContain('lo pendiente es 2'));

    $s->inv->company->update(['purchase_receipt_tolerance_pct' => '10']);
    $s->receive($order, [[0, '3']]); // 11 <= 10 × 1.10
    expect($order->lines()->pluck('received_quantity')->all())->toBe(['11.0000', '0.0000']);
    expect(fn () => $s->receive($order, [[0, '0.5']]))->toThrow(PurchaseException::class);
});

it('costs the entry at the net (VAT credit) for an invoicing supplier and at the total paid for one without invoice', function () {
    $s = $this->s;
    $withInvoice = $s->receive($s->approvedOrder(), [[0, '10']]); // 113.00, VAT 14.69 → net 98.31
    expect($withInvoice->invoice_total)->toBe('113.00')
        ->and($withInvoice->vat_credit)->toBe('14.69')
        ->and($withInvoice->lines[0]->unit_cost)->toBe('9.8310')
        ->and($s->inv->state())->toBe(['10.0000', '9.8310', '98.3100']);

    $informal = $s->receive($s->approvedOrder($s->informal), [[0, '10']]);
    expect($informal->vat_credit)->toBe('0.00')
        ->and($informal->lines[0]->unit_cost)->toBe('11.3000')
        // Average cost: (98.31 + 113.00) / 20.
        ->and($s->inv->state())->toBe(['20.0000', '10.5655', '211.3100']);
});

it('prorates freight and unloading into the unit cost by value, residual to the last line', function () {
    $s = $this->s;
    $receipt = $s->receive($s->approvedOrder($s->informal), [[0, '10'], [1, '5']], ['costs' => [
        ['kind' => 'freight', 'amount' => '50.00'], ['kind' => 'unloading', 'amount' => '10.01'],
    ]]);

    // Values 113.00 and 35.00 (148.00): 60.01 × 113/148 = 45.82, the last line takes 14.19.
    expect($receipt->additional_costs_total)->toBe('60.01')
        ->and($receipt->lines->pluck('additional_cost')->all())->toBe(['45.82', '14.19'])
        ->and($receipt->lines->pluck('cost_total')->all())->toBe(['158.82', '49.19'])
        ->and($receipt->cost_total)->toBe('208.01')
        ->and($receipt->invoice_total)->toBe('148.00')
        ->and($receipt->costs)->toHaveCount(2);
});

it('flags an invoiced price beyond the variance threshold and requires a reason', function () {
    $s = $this->s;
    $order = $s->approvedOrder();

    expect(fn () => $s->receive($order, [[0, '10', '11.80']]))
        ->toThrow(fn (PurchaseException $e) => expect($e->errorCode())->toBe('price_variance_reason_required'));

    $receipt = $s->receive($order, [[0, '10', '11.80']], ['price_variance_reason' => 'Aumento de lista del proveedor']);
    expect($receipt->lines[0]->price_variance_flag)->toBeTrue()
        ->and($receipt->lines[0]->price_variance_pct)->toBe('4.42')
        ->and($receipt->price_variance_reason)->toBe('Aumento de lista del proveedor');

    // Within 2 %: no reason needed.
    $ok = $s->receive($order, [[1, '5', '7.10']]);
    expect($ok->lines[0]->price_variance_flag)->toBeFalse();
});

it('rejects a duplicated supplier invoice number and a future invoice date', function () {
    $s = $this->s;
    $invoice = ['supplier_invoice_number' => 'F-001-123', 'supplier_invoice_date' => $s->today()];
    $receipt = $s->receive($s->approvedOrder(), [[0, '1']], $invoice);

    expect(fn () => $s->receive($s->approvedOrder(), [[0, '1']], $invoice))
        ->toThrow(fn (PurchaseException $e) => expect($e->errorCode())->toBe('duplicate_supplier_invoice')
            ->and($e->getMessage())->toContain($receipt->number));

    // Same number for ANOTHER supplier is fine.
    $s->receive($s->approvedOrder($s->informal), [[0, '1']], $invoice);

    expect(fn () => $s->receive($s->approvedOrder(), [[0, '1']], ['supplier_invoice_number' => 'F-2', 'supplier_invoice_date' => now()->addDays(3)->toDateString()]))
        ->toThrow(PurchaseException::class, 'no puede ser futura');
});
