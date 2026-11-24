<?php

namespace App\Domain\Shared\Support;

use BcMath\Number;

/**
 * Bolivian VAT (IVA 13 %) computed "por dentro": prices and invoices INCLUDE
 * the tax, so tax = round(total × 13 %) and net = total − tax (never
 * total ÷ 1.13). Shared by sales (débito fiscal, ADR 0005) and purchases
 * (crédito fiscal, ADR 0006) so both use exactly the same rounding.
 */
final class Vat
{
    public const RATE = '0.13';

    /**
     * Document VAT over its line totals, distributed per line with the same
     * prorating as discounts (residual to the last line): Σ line VAT == VAT.
     *
     * @param  list<Number>  $lineTotals  VAT-included line totals (2 decimals)
     * @return array{vat: Number, lines: list<Number>}
     */
    public static function split(array $lineTotals, bool $apply = true): array
    {
        $total = array_reduce($lineTotals, fn (Number $sum, Number $t) => $sum + $t, new Number('0'));
        $vat = $apply ? ($total * new Number(self::RATE))->round(2) : (new Number('0'))->round(2);

        return ['vat' => $vat, 'lines' => Decimal::prorate($vat, $lineTotals)];
    }
}
