<?php

use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Exceptions\LinkedInventoryException;
use App\Domain\Sales\Exceptions\SaleHasPaymentsException;
use App\Domain\Sales\Models\CustomerLedgerEntry;
use App\Domain\Sales\Models\CustomerPayment;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Queries\ReceivablesQueries;
use Illuminate\Support\Facades\DB;
use Tests\Support\SalesScenario;

beforeEach(fn () => $this->s = SalesScenario::make());

it('voids a credit sale in cascade: SAL- reversed at original cost and charge reversed', function () {
    $s = $this->s;

    $sale = $s->creditSale('4', '20.00');
    $voided = $s->void($sale);

    $exit = InventoryDocument::query()->withoutGlobalScopes()->findOrFail($sale->inventory_document_id);
    expect($voided->status->value)->toBe('voided')
        ->and($exit->status->value)->toBe('voided')
        ->and($s->inv->state())->toBe(['100.0000', '10.0000', '1000.0000'])
        ->and(CustomerLedgerEntry::query()->withoutGlobalScopes()->pluck('amount')->all())->toBe(['80.00', '-80.00'])
        ->and($s->fresh($s->creditCustomer)->balance)->toBe('0.00');
});

it('voids a cash sale together with its automatic receipt', function () {
    $s = $this->s;

    $sale = $s->sale([['quantity' => '2']]);
    $s->void($sale);

    $receipt = CustomerPayment::query()->withoutGlobalScopes()->sole();
    expect($receipt->status->value)->toBe('voided')
        ->and($sale->fresh()->paid_amount)->toBe('0.00')
        ->and(CustomerLedgerEntry::query()->withoutGlobalScopes()->orderBy('id')->pluck('kind')->map->value->all())
        ->toBe(['charge', 'payment', 'reversal', 'reversal'])
        ->and($s->fresh($s->customer)->balance)->toBe('0.00');
});

it('blocks voiding a sale with manual receipts applied until they are voided', function () {
    $s = $this->s;

    $sale = $s->creditSale('5', '20.00');
    $payment = $s->pay($s->creditCustomer, '30.00');

    expect(fn () => $s->void($sale))->toThrow(function (SaleHasPaymentsException $e) use ($payment) {
        expect($e->paymentNumbers)->toBe([$payment->number]);
    });
    expect($sale->fresh()->status->value)->toBe('posted');

    $s->voidPayment($payment);
    expect($s->void($sale)->status->value)->toBe('voided')
        ->and($s->fresh($s->creditCustomer)->balance)->toBe('0.00');
});

/*
 * Reversing an exit is a receipt at the original cost, which can never break
 * the valuation invariant; any inventory error (state, stock...) must still
 * abort the WHOLE void and keep its code. Simulated with a SAL- that is no
 * longer posted.
 */
it('rolls back the entire void (receipt, charge reversal) when the inventory void fails', function () {
    $s = $this->s;

    $sale = $s->sale([['quantity' => '3']]); // cash: charge + automatic receipt

    $exit = InventoryDocument::query()->withoutGlobalScopes()->findOrFail($sale->inventory_document_id);
    DB::table('inventory_documents')->where('id', $exit->id)->update(['status' => 'draft']);

    expect(fn () => $s->void($sale))->toThrow(LinkedInventoryException::class, $sale->number);

    expect($sale->fresh()->status->value)->toBe('posted')
        ->and(CustomerPayment::query()->withoutGlobalScopes()->sole()->status->value)->toBe('posted')
        ->and(CustomerLedgerEntry::query()->withoutGlobalScopes()->count())->toBe(2)
        ->and($sale->fresh()->paid_amount)->toBe('60.00');
});

it('allocates a receipt FIFO by due date and tracks partial payments', function () {
    $s = $this->s;

    $a = $s->creditSale('2', '20.00'); // 40
    $b = $s->creditSale('3', '20.00'); // 60

    $s->pay($s->creditCustomer, '50.00');

    expect($a->fresh()->paid_amount)->toBe('40.00')
        ->and($b->fresh()->paid_amount)->toBe('10.00')
        ->and($s->fresh($s->creditCustomer)->balance)->toBe('50.00');
});

it('applies a receipt to the chosen sales and rejects inconsistent allocations', function () {
    $s = $this->s;

    $a = $s->creditSale('2', '20.00');
    $b = $s->creditSale('3', '20.00');

    $s->pay($s->creditCustomer, '25.00', [$b->id => '25.00']);
    expect($a->fresh()->paid_amount)->toBe('0.00')->and($b->fresh()->paid_amount)->toBe('25.00');

    expect(fn () => $s->pay($s->creditCustomer, '10.00', [$a->id => '5.00']))
        ->toThrow(InvalidSalesDocumentException::class, 'igual al monto');
    expect(fn () => $s->pay($s->creditCustomer, '50.00', [$a->id => '50.00']))
        ->toThrow(InvalidSalesDocumentException::class);
});

it('rejects a receipt above the open debt (no advances)', function () {
    $s = $this->s;
    $s->creditSale('1', '20.00');

    expect(fn () => $s->pay($s->creditCustomer, '20.01'))
        ->toThrow(fn (InvalidSalesDocumentException $e) => expect($e->errorCode())->toBe('payment_exceeds_debt'));
});

it('forbids voiding the automatic receipt of a cash sale directly', function () {
    $s = $this->s;
    $s->sale();

    expect(fn () => $s->voidPayment(CustomerPayment::query()->withoutGlobalScopes()->sole()))
        ->toThrow(InvalidSalesDocumentException::class, 'anulando la venta');
});

it('buckets open debt by days past due (not due, 0–30, 31–60, 61–90, +90)', function () {
    $s = $this->s;
    $today = now($s->inv->company->timezone)->startOfDay();

    $sales = collect(range(1, 6))->map(fn () => $s->creditSale('1', '15.00'));
    // Due dates: in 5 days, today, 15, 45, 75 and 120 days ago.
    foreach ([5, 0, -15, -45, -75, -120] as $i => $offset) {
        SalesDocument::query()->withoutGlobalScopes()->whereKey($sales[$i]->id)->update(['due_date' => $today->copy()->addDays($offset)]);
    }

    $aging = app(ReceivablesQueries::class)->aging($today, $s->creditCustomer->id);

    expect($aging)->toBe([
        'not_due' => '15.00', 'd0_30' => '30.00', 'd31_60' => '15.00', 'd61_90' => '15.00', 'd90_plus' => '15.00', 'total' => '90.00',
    ]);
});

it('customers:verify passes on a consistent ledger and repairs corrupted caches', function () {
    $s = $this->s;

    $sale = $s->creditSale('5', '20.00');
    $s->pay($s->creditCustomer, '30.00');
    $s->void($s->sale());

    $this->artisan('customers:verify')->assertSuccessful();

    DB::table('customers')->where('id', $s->creditCustomer->id)->update(['balance' => '999.00']);
    DB::table('sales_documents')->where('id', $sale->id)->update(['paid_amount' => '0']);

    $this->artisan('customers:verify')->assertFailed();
    $this->artisan('customers:verify --repair')->assertSuccessful();

    expect($s->fresh($s->creditCustomer)->balance)->toBe('70.00')
        ->and($sale->fresh()->paid_amount)->toBe('30.00');
});
