<?php

namespace App\Domain\Sales\Services;

use App\Domain\Sales\Data\LineAmounts;
use App\Domain\Sales\Data\SalesTotals;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;

/**
 * Pure amounts engine for sales documents (ADR 0005). Money is rounded to
 * 2 decimals; no database access.
 *
 * Per line: gross = round(qty × price) − line discount.
 * The global discount is prorated over the gross amounts (residual to the
 * last line) so every line knows its exact total and margin.
 * Prices INCLUDE VAT: vat = round(total × 13 %), distributed over the line
 * totals with the same prorating (residual to the last line), so
 * Σ line VAT == document VAT exactly. net = total − vat.
 */
final class SalesCalculator
{
    public const VAT_RATE = '0.13';

    /**
     * @param  list<array{quantity: string, unit_price: string, discount_amount: ?string}>  $lines
     *
     * @throws InvalidSalesDocumentException
     */
    public function compute(array $lines, string $globalDiscount, bool $breakDownVat): SalesTotals
    {
        $errors = [];
        $subtotal = new Number('0');
        $lineDiscounts = new Number('0');
        $grosses = [];

        foreach ($lines as $i => $line) {
            $extended = (new Number($line['quantity']) * new Number($line['unit_price']))->round(2);
            $discount = Decimal::of($line['discount_amount'] ?? '0')->round(2);

            if ($discount < 0 || $discount > $extended) {
                $errors["lines.{$i}.discount_amount"] = ['El descuento no puede ser negativo ni mayor al importe de la línea.'];
            }

            $subtotal += $extended;
            $lineDiscounts += $discount;
            $grosses[] = $extended - $discount;
        }

        $global = Decimal::of($globalDiscount)->round(2);
        $grossTotal = $subtotal - $lineDiscounts;

        if ($global < 0 || $global > $grossTotal) {
            $errors['global_discount'] = ['El descuento global no puede ser negativo ni mayor al total.'];
        }

        if ($errors !== []) {
            throw new InvalidSalesDocumentException($errors);
        }

        $shares = Decimal::prorate($global, $grosses);
        $totals = array_map(fn (Number $gross, Number $share) => $gross - $share, $grosses, $shares);
        $total = $grossTotal - $global;

        $vat = $breakDownVat ? ($total * new Number(self::VAT_RATE))->round(2) : new Number('0');
        $vats = Decimal::prorate($vat, $totals);

        $lineAmounts = [];
        foreach ($grosses as $i => $gross) {
            $lineAmounts[] = new LineAmounts(
                gross: $gross->round(2),
                globalShare: $shares[$i],
                total: $totals[$i]->round(2),
                vat: $vats[$i],
                net: ($totals[$i] - $vats[$i])->round(2),
            );
        }

        return new SalesTotals(
            lines: $lineAmounts,
            subtotal: $subtotal->round(2),
            lineDiscountTotal: $lineDiscounts->round(2),
            globalDiscount: $global,
            total: $total->round(2),
            vat: $vat,
            net: ($total - $vat)->round(2),
        );
    }
}
