<?php

use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Services\SalesCalculator;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;

function line(string $qty, string $price, string $discount = '0'): array
{
    return ['quantity' => $qty, 'unit_price' => $price, 'discount_amount' => $discount];
}

function money(Number $n): string
{
    return Decimal::money($n);
}

it('breaks down VAT included in the price (13 % of the total, not added)', function () {
    $t = (new SalesCalculator)->compute([line('1', '113.00')], '0', true);

    expect(money($t->total))->toBe('113.00')
        ->and(money($t->vat))->toBe('14.69')   // 113 × 0.13 = 14.69
        ->and(money($t->net))->toBe('98.31');  // 113 − 14.69
});

it('rounds the document VAT once and distributes it so lines add up exactly', function () {
    // 3 × 33.33: each line VAT 4.3329 -> would round to 4.33 × 3 = 12.99; document VAT is 13.00.
    $t = (new SalesCalculator)->compute([line('1', '33.33'), line('1', '33.33'), line('1', '33.34')], '0', true);

    $sumVat = array_reduce($t->lines, fn (Number $s, $l) => $s + $l->vat, new Number('0'));
    $sumNet = array_reduce($t->lines, fn (Number $s, $l) => $s + $l->net, new Number('0'));

    expect(money($t->vat))->toBe('13.00')
        ->and(money($sumVat))->toBe('13.00')
        ->and(money($sumNet))->toBe(money($t->net));
});

it('prorates the global discount by line amount, residual to the last line', function () {
    // gross 10 / 10 / 10, global discount 10 -> 3.33 / 3.33 / 3.34
    $t = (new SalesCalculator)->compute([line('1', '10'), line('1', '10'), line('1', '10')], '10.00', true);

    expect(array_map(fn ($l) => money($l->globalShare), $t->lines))->toBe(['3.33', '3.33', '3.34'])
        ->and(array_map(fn ($l) => money($l->total), $t->lines))->toBe(['6.67', '6.67', '6.66'])
        ->and(money($t->total))->toBe('20.00');
});

it('prorates proportionally to each line after its own discount', function () {
    // gross: 2×50−10 = 90 and 1×10 = 10 (total 100); global 7 -> 6.30 / 0.70
    $t = (new SalesCalculator)->compute([line('2', '50', '10'), line('1', '10')], '7', true);

    expect(money($t->subtotal))->toBe('110.00')
        ->and(money($t->lineDiscountTotal))->toBe('10.00')
        ->and(array_map(fn ($l) => money($l->globalShare), $t->lines))->toBe(['6.30', '0.70'])
        ->and(money($t->total))->toBe('93.00');
});

it('keeps Σ line totals == document total for awkward splits', function (string $global) {
    $lines = [line('3', '7.77'), line('1.5', '19.99'), line('7', '0.33'), line('1', '1.01')];
    $t = (new SalesCalculator)->compute($lines, $global, true);

    $sumTotal = array_reduce($t->lines, fn (Number $s, $l) => $s + $l->total, new Number('0'));
    $sumShare = array_reduce($t->lines, fn (Number $s, $l) => $s + $l->globalShare, new Number('0'));

    expect(money($sumTotal))->toBe(money($t->total))
        ->and(money($sumShare))->toBe(money($t->globalDiscount));
})->with(['0.01', '1.00', '5.55', '13.37', '50.00']);

it('gives no VAT breakdown when not applicable (sales note without the setting)', function () {
    $t = (new SalesCalculator)->compute([line('1', '113.00')], '0', false);

    expect(money($t->vat))->toBe('0.00')->and(money($t->net))->toBe('113.00');
});

it('rejects a line discount above the line amount and a global discount above the total', function () {
    expect(fn () => (new SalesCalculator)->compute([line('1', '10', '11')], '0', true))
        ->toThrow(InvalidSalesDocumentException::class)
        ->and(fn () => (new SalesCalculator)->compute([line('1', '10')], '10.01', true))
        ->toThrow(InvalidSalesDocumentException::class);
});

it('prorates with Decimal::prorate even when some weights are zero', function () {
    $shares = Decimal::prorate(new Number('1.00'), [new Number('1'), new Number('0'), new Number('2'), new Number('0')]);

    expect(array_map(money(...), $shares))->toBe(['0.33', '0.00', '0.67', '0.00']);
});
