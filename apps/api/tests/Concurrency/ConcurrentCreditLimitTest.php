<?php

use App\Domain\Sales\Models\CustomerLedgerEntry;
use App\Domain\Sales\Models\SalesDocument;
use Tests\Support\ConcurrencyHarness;
use Tests\Support\SalesScenario;

/**
 * Two credit sales posted at the same instant for the same customer: each
 * fits the limit alone, together they do not. The customer row lock makes
 * the second one see the first one's charge.
 */
function postSale(SalesDocument $document, SalesScenario $s): callable
{
    return fn () => ConcurrencyHarness::start('post-sale', [(string) $document->id, (string) $s->inv->user->id, (string) $s->inv->company->id]);
}

it('never lets two simultaneous credit sales exceed the customer credit limit', function () {
    $s = SalesScenario::make(); // credit limit 1000, stock 100 @ 10

    $credit = ['customer_id' => $s->creditCustomer->id, 'payment_terms' => 'credit'];
    $saleA = $s->draft('invoice', [['quantity' => '30', 'unit_price' => '20.00']], $credit); // 600
    $saleB = $s->draft('invoice', [['quantity' => '30', 'unit_price' => '20.00']], $credit); // 600

    $results = ConcurrencyHarness::race([postSale($saleA, $s), postSale($saleB, $s)]);

    $ok = array_values(array_filter($results, fn ($r) => $r['ok']));
    $failed = array_values(array_filter($results, fn ($r) => ! $r['ok']));

    expect($ok)->toHaveCount(1)
        ->and($ok[0]['number'])->toBe('VTA-000001')
        ->and($failed)->toHaveCount(1)
        ->and($failed[0]['code'])->toBe('credit_limit_exceeded')
        ->and($failed[0]['details']['balance'])->toBe('600.00')
        ->and($failed[0]['details']['available'])->toBe('400.00');

    expect($s->fresh($s->creditCustomer)->balance)->toBe('600.00')
        ->and(CustomerLedgerEntry::query()->withoutGlobalScopes()->count())->toBe(1)
        ->and($s->inv->state()[0])->toBe('70.0000');

    $this->artisan('customers:verify')->assertSuccessful();
    $this->artisan('inventory:verify')->assertSuccessful();
});
