<?php

namespace App\Domain\Sales\Queries;

use App\Domain\Sales\Enums\SalesDocumentStatus;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Shared\Support\Decimal;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Read side of sales for dashboards. Only POSTED invoices and sales notes
 * count as sales; dates are business dates (document_date). Company
 * scoping is explicit (query builder, no Eloquent global scope).
 */
class SalesQueries
{
    /**
     * @return array{total: string, net: string, count: int}
     */
    public function totals(int $companyId, CarbonInterface $from, CarbonInterface $to): array
    {
        $row = $this->sales($companyId)
            ->whereBetween('document_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('COALESCE(SUM(total), 0) AS total, COALESCE(SUM(net_amount), 0) AS net, COUNT(*) AS n')
            ->first();

        return ['total' => Decimal::money(Decimal::of($row->total)), 'net' => Decimal::money(Decimal::of($row->net)), 'count' => (int) $row->n];
    }

    /**
     * One row per day (zeros included) between $from and $to.
     *
     * @return list<array{date: string, total: string, count: int}>
     */
    public function daily(int $companyId, CarbonInterface $from, CarbonInterface $to): array
    {
        $rows = DB::select(<<<'SQL'
            SELECT d::date AS date, COALESCE(SUM(s.total), 0) AS total, COUNT(s.id) AS n
            FROM generate_series(CAST(? AS date), CAST(? AS date), interval '1 day') AS d
            LEFT JOIN sales_documents s
              ON s.document_date = d::date AND s.company_id = ? AND s.status = 'posted' AND s.type <> 'quote'
            GROUP BY d ORDER BY d
        SQL, [$from->toDateString(), $to->toDateString(), $companyId]);

        return array_map(fn ($r) => [
            'date' => (string) $r->date,
            'total' => Decimal::money(Decimal::of($r->total)),
            'count' => (int) $r->n,
        ], $rows);
    }

    /**
     * @return list<array{customer_id: int, name: string, city: ?string, total: string, count: int}>
     */
    public function topCustomers(int $companyId, CarbonInterface $from, CarbonInterface $to, int $limit = 5, ?int $excludeCustomerId = null): array
    {
        return $this->sales($companyId, 's')
            ->join('customers as c', 'c.id', '=', 's.customer_id')
            // The walk-in customer ("S/N") is not a customer to rank.
            ->when($excludeCustomerId, fn (Builder $q) => $q->where('c.id', '!=', $excludeCustomerId))
            ->whereBetween('s.document_date', [$from->toDateString(), $to->toDateString()])
            ->groupBy('c.id', 'c.name', 'c.city')
            ->orderByDesc(DB::raw('SUM(s.total)'))
            ->limit($limit)
            ->get(['c.id as customer_id', 'c.name', 'c.city', DB::raw('SUM(s.total) AS total'), DB::raw('COUNT(*) AS n')])
            ->map(fn ($r) => [
                'customer_id' => (int) $r->customer_id,
                'name' => $r->name,
                'city' => $r->city,
                'total' => Decimal::money(Decimal::of($r->total)),
                'count' => (int) $r->n,
            ])->all();
    }

    /**
     * Ranked by margin (or by revenue when margins may not be shown).
     *
     * @return list<array{product_id: int, sku: string, name: string, revenue: string, margin: ?string, margin_pct: ?string, quantity: string}>
     */
    public function topProducts(int $companyId, CarbonInterface $from, CarbonInterface $to, bool $byMargin, int $limit = 5): array
    {
        $rows = DB::table('sales_document_lines as l')
            ->join('sales_documents as s', 's.id', '=', 'l.document_id')
            ->join('products as p', 'p.id', '=', 'l.product_id')
            ->where('s.company_id', $companyId)
            ->where('s.status', SalesDocumentStatus::Posted->value)
            ->where('s.type', '!=', SalesDocumentType::Quote->value)
            ->whereBetween('s.document_date', [$from->toDateString(), $to->toDateString()])
            ->groupBy('p.id', 'p.sku', 'p.name')
            ->orderByDesc(DB::raw($byMargin ? 'SUM(l.margin)' : 'SUM(l.net_amount)'))
            ->limit($limit)
            ->get(['p.id', 'p.sku', 'p.name', DB::raw('SUM(l.net_amount) AS revenue'), DB::raw('SUM(l.margin) AS margin'), DB::raw('SUM(l.quantity) AS qty')]);

        return $rows->map(function ($r) use ($byMargin) {
            $revenue = Decimal::of($r->revenue);
            $margin = Decimal::of($r->margin);

            return [
                'product_id' => (int) $r->id,
                'sku' => $r->sku,
                'name' => $r->name,
                'revenue' => Decimal::money($revenue),
                'margin' => $byMargin ? Decimal::money($margin) : null,
                'margin_pct' => $byMargin && $revenue > 0 ? Decimal::money(($margin * 100)->div($revenue, 4)) : null,
                'quantity' => (string) Decimal::of($r->qty)->round(4),
            ];
        })->all();
    }

    private function sales(int $companyId, ?string $alias = null): Builder
    {
        $p = $alias ? "{$alias}." : '';

        return DB::table($alias ? "sales_documents as {$alias}" : 'sales_documents')
            ->where("{$p}company_id", $companyId)
            ->where("{$p}status", SalesDocumentStatus::Posted->value)
            ->where("{$p}type", '!=', SalesDocumentType::Quote->value);
    }
}
