<?php

use App\Domain\Purchases\Services\PurchaseCostCalculator;

$lines = [
    ['quantity' => '10', 'unit_price' => '11.30'], // 113.00
    ['quantity' => '3', 'unit_price' => '7.00'],   //  21.00
    ['quantity' => '7', 'unit_price' => '1.43'],   //  10.01
];

it('with invoice: VAT 13 % por dentro is fiscal credit and the cost is the net, freight prorated by value', function () use ($lines) {
    $r = (new PurchaseCostCalculator)->compute($lines, ['50.00', '10.00'], issuesInvoice: true);

    // 144.01 × 0.13 = 18.7213 → 18.72 (not 144.01 ÷ 1.13 × 0.13 = 16.57).
    expect($r['invoice_total'])->toBe('144.01')
        ->and($r['vat_credit'])->toBe('18.72')
        ->and($r['net_total'])->toBe('125.29')
        ->and(array_column($r['lines'], 'vat'))->toBe(['14.69', '2.73', '1.30'])
        ->and(array_column($r['lines'], 'net'))->toBe(['98.31', '18.27', '8.71'])
        // 60.00 of freight + unloading over the nets 125.29, residual to the last line.
        ->and(array_column($r['lines'], 'additional_cost'))->toBe(['47.08', '8.75', '4.17'])
        ->and(array_column($r['lines'], 'cost_total'))->toBe(['145.39', '27.02', '12.88'])
        ->and(array_column($r['lines'], 'unit_cost'))->toBe(['14.5390', '9.0067', '1.8400'])
        ->and($r['additional_costs_total'])->toBe('60.00')
        ->and($r['cost_total'])->toBe('185.29');
});

it('without invoice: no fiscal credit, the cost is the total paid', function () use ($lines) {
    $r = (new PurchaseCostCalculator)->compute($lines, [], issuesInvoice: false);

    expect($r['vat_credit'])->toBe('0.00')
        ->and($r['net_total'])->toBe('144.01')
        ->and(array_column($r['lines'], 'cost_total'))->toBe(['113.00', '21.00', '10.01'])
        ->and(array_column($r['lines'], 'unit_cost'))->toBe(['11.3000', '7.0000', '1.4300']);
});

it('prorates freight exactly: the shares always add up to the freight', function () {
    $r = (new PurchaseCostCalculator)->compute(
        [['quantity' => '1', 'unit_price' => '10.00'], ['quantity' => '1', 'unit_price' => '10.00'], ['quantity' => '1', 'unit_price' => '10.00']],
        ['100.00'],
        issuesInvoice: false,
    );

    expect(array_column($r['lines'], 'additional_cost'))->toBe(['33.33', '33.33', '33.34']);
});

it('measures the price variance against the order price', function () {
    $calc = new PurchaseCostCalculator;
    expect($calc->variancePct('10.50', '10.00'))->toBe('5.00')
        ->and($calc->variancePct('9.80', '10.00'))->toBe('2.00')
        ->and($calc->variancePct('1.00', '0'))->toBe('0.00');
});
