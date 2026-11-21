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
}
