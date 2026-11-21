<?php

use App\Domain\Inventory\Data\BalanceState;
use App\Domain\Inventory\Data\MovementResult;
use App\Domain\Inventory\Exceptions\VoidCostInconsistencyException;
use App\Domain\Inventory\Services\AverageCostCalculator;
use BcMath\Number;

/**
 * Pure unit tests of the costing engine (no database). The feature tests
 * cover the same engine end-to-end; these pin down the edge cases.
 */
function calc(): AverageCostCalculator
{
    return new AverageCostCalculator;
}

function n(string $v): Number
{
    return new Number($v);
}

/**
 * @return array{0: string, 1: string, 2: string, 3: string, 4: string}
 */
function snapshot(MovementResult $r): array
{
    return array_map(fx(...), [$r->quantity, $r->totalCost, $r->after->quantity, $r->after->avgCost, $r->after->value]);
}

/** Fixed 4-decimal representation (Number keeps the scale of each operation). */
function fx(Number $n): string
{
    return bcadd((string) $n, '0', 4);
}

it('receives into an empty balance at the given cost', function () {
    $r = calc()->receive(BalanceState::zero(), n('10'), n('12.5'));

    expect(snapshot($r))->toBe(['10.0000', '125.0000', '10.0000', '12.5000', '125.0000']);
});

it('averages a receipt into existing stock', function () {
    $r = calc()->receive(BalanceState::of('10', '10', '100'), n('5'), n('13'));

    expect(snapshot($r))->toBe(['5.0000', '65.0000', '15.0000', '11.0000', '165.0000']);
});

it('rounds the average to 4 decimals using exact decimal arithmetic', function () {
    $r = calc()->receive(BalanceState::of('3', '1', '3'), n('3'), n('1.0001'));

    // value 6.0003 / 6 = 1.00005 -> 1.0001 (half up)
    expect(fx($r->after->avgCost))->toBe('1.0001')
        ->and(fx($r->after->value))->toBe('6.0003');
});

it('values a receipt that covers a negative balance at the incoming cost', function () {
    $r = calc()->receive(BalanceState::of('-4', '9', '0'), n('10'), n('11'));

    expect(snapshot($r))->toBe(['10.0000', '110.0000', '6.0000', '11.0000', '66.0000']);
});

it('keeps value at zero while the balance stays negative', function () {
    $r = calc()->receive(BalanceState::of('-10', '9', '0'), n('4'), n('11'));

    expect(snapshot($r))->toBe(['4.0000', '44.0000', '-6.0000', '11.0000', '0.0000']);
});

it('accepts a receipt at cost zero (e.g. a donation) without breaking the invariants', function () {
    $r = calc()->receive(BalanceState::of('10', '10', '100'), n('10'), n('0'));

    expect(fx($r->after->avgCost))->toBe('5.0000')
        ->and(fx($r->after->value))->toBe('100.0000');
});

it('issues at the current average cost', function () {
    $r = calc()->issue(BalanceState::of('15', '11.5', '172.5'), n('5'));

    expect(snapshot($r))->toBe(['-5.0000', '-57.5000', '10.0000', '11.5000', '115.0000']);
});

it('makes the last units absorb the rounding residual when the stock empties', function () {
    // 3 units worth 10.0001: the average 3.3334 x 3 would be 10.0002.
    $r = calc()->issue(BalanceState::of('3', '3.3334', '10.0001'), n('3'));

    expect(fx($r->totalCost))->toBe('-10.0001')
        ->and(fx($r->after->value))->toBe('0.0000')
        ->and(fx($r->after->avgCost))->toBe('3.3334');
});

it('never issues more value than is on hand', function () {
    $r = calc()->issue(BalanceState::of('10', '10.0001', '100'), n('9.9999'));

    expect($r->totalCost >= n('-100'))->toBeTrue()
        ->and($r->after->value >= n('0'))->toBeTrue();
});

it('issues from a negative balance at value zero', function () {
    $r = calc()->issue(BalanceState::of('-2', '7', '0'), n('3'));

    expect(snapshot($r))->toBe(['-3.0000', '0.0000', '-5.0000', '7.0000', '0.0000']);
});

it('reverses a receipt at its original cost and recomputes the average', function () {
    $r = calc()->reverseReceipt(BalanceState::of('15', '11.5', '172.5'), n('10'), n('13'));

    expect(snapshot($r))->toBe(['-10.0000', '-130.0000', '5.0000', '8.5000', '42.5000']);
});

it('tolerates a residual up to 0.01 when a reversal empties the stock', function () {
    $r = calc()->reverseReceipt(BalanceState::of('10', '10.001', '100.01'), n('10'), n('10'));

    expect(fx($r->totalCost))->toBe('-100.0100')
        ->and(fx($r->after->value))->toBe('0.0000');
});

it('rejects a reversal that empties the stock leaving a residual above 0.01', function () {
    calc()->reverseReceipt(BalanceState::of('10', '10.5', '105'), n('10'), n('10'));
})->throws(VoidCostInconsistencyException::class);

it('rejects a reversal that would leave positive stock with negative value', function () {
    calc()->reverseReceipt(BalanceState::of('11', '20', '220'), n('10'), n('30'));
})->throws(VoidCostInconsistencyException::class);

it('rejects non-positive quantities', function (string $method) {
    $args = $method === 'issue' ? [BalanceState::zero(), n('0')] : [BalanceState::zero(), n('0'), n('1')];
    calc()->{$method}(...$args);
})->with(['receive', 'issue', 'reverseReceipt'])->throws(InvalidArgumentException::class);
