<?php

use App\Domain\Shared\Support\Vat;
use BcMath\Number;

$n = fn (string ...$v) => array_map(fn (string $x) => new Number($x), $v);

it('computes VAT "por dentro" (total × 13 %), never total ÷ 1.13', function () use ($n) {
    ['vat' => $vat, 'lines' => $lines] = Vat::split($n('100.00', '33.33', '0.01'));

    // 133.34 × 0.13 = 17.3342 → 17.33 (÷ 1.13 would give 15.34).
    expect((string) $vat)->toBe('17.33')
        ->and(array_map('strval', $lines))->toBe(['13.00', '4.33', '0.00'])
        ->and((string) array_reduce($lines, fn ($s, $l) => $s + $l, new Number('0')))->toBe('17.33');
});

it('returns zero VAT when not applied (no invoice / sales note without breakdown)', function () use ($n) {
    ['vat' => $vat, 'lines' => $lines] = Vat::split($n('10.00', '5.00'), apply: false);

    expect((string) $vat)->toBe('0.00')->and(array_map('strval', $lines))->toBe(['0.00', '0.00']);
});
