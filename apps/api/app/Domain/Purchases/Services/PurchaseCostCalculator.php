<?php

namespace App\Domain\Purchases\Services;

use App\Domain\Shared\Support\Decimal;
use App\Domain\Shared\Support\Vat;
use BcMath\Number;

/**
 * Pure entry-cost engine of a receipt (ADR 0006, preliminary fiscal logic to
 * be validated with an accountant). No database access.
 *
 * 1. line_total = round(quantity × invoiced unit price).
 * 2. Supplier WITH invoice: the 13 % VAT is computed "por dentro" exactly like
 *    sales (Shared\Support\Vat: vat = round(total × 0.13), prorated per line,
 *    residual to the last) and is crédito fiscal; the cost is the net.
 *    Supplier WITHOUT invoice: no credit, the cost is the total paid.
 * 3. Additional costs (freight, unloading, other) are prorated over the line
 *    nets BY VALUE with Decimal::prorate (residual to the last line).
 * 4. cost_total = net + additional; unit_cost = cost_total / quantity (4 dp).
 */
final class PurchaseCostCalculator
{
    /**
     * @param  list<array{quantity: string, unit_price: string}>  $lines
     * @param  list<string>  $additionalCosts
     * @return array{
     *     lines: list<array{line_total: string, vat: string, net: string, additional_cost: string, cost_total: string, unit_cost: string}>,
     *     invoice_total: string, vat_credit: string, net_total: string, additional_costs_total: string, cost_total: string
     * }
     */
    public function compute(array $lines, array $additionalCosts, bool $issuesInvoice): array
    {
        $totals = array_map(
            fn (array $l) => (new Number((string) $l['quantity']) * new Number((string) $l['unit_price']))->round(2),
            $lines,
        );
        ['vat' => $vat, 'lines' => $vats] = Vat::split($totals, $issuesInvoice);
        $nets = array_map(fn (Number $t, Number $v) => ($t - $v)->round(2), $totals, $vats);

        $extra = array_reduce($additionalCosts, fn (Number $s, string $c) => $s + Decimal::of($c)->round(2), new Number('0'));
        $shares = Decimal::prorate($extra, $nets);

        $out = [];
        $invoice = new Number('0');
        $costTotal = new Number('0');
        foreach ($lines as $i => $line) {
            $cost = ($nets[$i] + $shares[$i])->round(2);
            $invoice += $totals[$i];
            $costTotal += $cost;
            $out[] = [
                'line_total' => Decimal::money($totals[$i]),
                'vat' => Decimal::money($vats[$i]),
                'net' => Decimal::money($nets[$i]),
                'additional_cost' => Decimal::money($shares[$i]),
                'cost_total' => Decimal::money($cost),
                'unit_cost' => (string) $cost->div(new Number((string) $line['quantity']), 8)->round(4),
            ];
        }

        return [
            'lines' => $out,
            'invoice_total' => Decimal::money($invoice),
            'vat_credit' => Decimal::money($vat),
            'net_total' => Decimal::money($invoice - $vat),
            'additional_costs_total' => Decimal::money($extra),
            'cost_total' => Decimal::money($costTotal),
        ];
    }

    /** |invoiced − ordered| / ordered × 100, 2 decimals (0 when ordered is 0). */
    public function variancePct(string $invoiced, string $ordered): string
    {
        $base = Decimal::of($ordered);
        if ($base == 0) {
            return '0.00';
        }

        return (string) (Decimal::abs(Decimal::of($invoiced) - $base) * new Number('100'))->div($base, 6)->round(2);
    }
}
