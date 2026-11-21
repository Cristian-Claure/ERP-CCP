<?php

namespace App\Domain\Shared\Support;

use BcMath\Number;

/**
 * Small helpers missing from BcMath\Number (exact decimal arithmetic).
 */
final class Decimal
{
    public static function of(string|int|Number|null $value): Number
    {
        return $value instanceof Number ? $value : new Number((string) ($value ?? '0'));
    }

    public static function abs(Number $value): Number
    {
        return $value < 0 ? $value * -1 : $value;
    }

    /**
     * Splits $amount proportionally to $weights, rounding each share to
     * $scale decimals. The rounding residual goes to the LAST share with a
     * non-zero weight, so the shares always add up exactly to $amount.
     *
     * @param  list<Number>  $weights  non-negative
     * @return list<Number>
     */
    public static function prorate(Number $amount, array $weights, int $scale = 2): array
    {
        $total = array_reduce($weights, fn (Number $sum, Number $w) => $sum + $w, new Number('0'));
        $zero = (new Number('0'))->round($scale);

        if ($weights === [] || $total == 0) {
            return array_map(fn () => $zero, $weights);
        }

        $last = array_key_last(array_filter($weights, fn (Number $w) => $w != 0));
        $shares = [];
        $assigned = new Number('0');

        foreach ($weights as $i => $weight) {
            if ($i === $last) {
                $shares[$i] = ($amount - $assigned)->round($scale);

                continue;
            }
            $share = ($amount * $weight)->div($total, $scale + 6)->round($scale);
            $shares[$i] = $share;
            $assigned += $share;
        }

        return $shares;
    }

    /** Rounds to 2 decimals and returns the plain string (money). */
    public static function money(Number $value): string
    {
        return bcadd((string) $value->round(2), '0', 2);
    }
}
