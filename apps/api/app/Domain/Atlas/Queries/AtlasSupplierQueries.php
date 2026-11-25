<?php

namespace App\Domain\Atlas\Queries;

use App\Domain\Purchases\Models\Supplier;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Support\Decimal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Atlas supplier layer: suppliers with coordinates and their inbound flows
 * (posted receipts of the period, per destination warehouse) -> arcs
 * supplier -> warehouse. Pure reads, cached by AtlasCache.
 */
class AtlasSupplierQueries
{
    /**
     * @return list<array<string, mixed>>
     */
    public function suppliers(int $companyId, ?CarbonImmutable $from, CarbonImmutable $to, bool $withPayables): array
    {
        $flows = DB::table('purchase_receipts')
            ->where('company_id', $companyId)
            ->where('status', PaymentStatus::Posted->value)
            ->when($from, fn ($q) => $q->where('receipt_date', '>=', $from->toDateString()))
            ->where('receipt_date', '<=', $to->toDateString())
            ->groupBy('supplier_id', 'warehouse_id')
            ->get(['supplier_id', 'warehouse_id', DB::raw('SUM(cost_total) AS total'), DB::raw('COUNT(*) AS n'), DB::raw('MAX(receipt_date) AS last')])
            ->groupBy('supplier_id');

        return Supplier::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->whereNotNull('latitude')
            ->orderBy('name')
            ->get()
            ->map(function (Supplier $s) use ($flows, $withPayables) {
                $rows = $flows->get($s->id, collect());
                $total = $rows->reduce(fn ($sum, $r) => $sum + Decimal::of((string) $r->total), Decimal::of('0'));

                return [
                    'id' => $s->id,
                    'name' => $s->name,
                    'tax_id' => $s->tax_id,
                    'country' => $s->country,
                    'city' => $s->city,
                    'lat' => (float) $s->latitude,
                    'lng' => (float) $s->longitude,
                    'issues_invoice' => $s->issues_invoice,
                    'lead_time_days' => $s->lead_time_days,
                    'purchases_total' => Decimal::money($total),
                    'receipts_count' => (int) $rows->sum('n'),
                    'last_receipt_at' => $rows->max('last'),
                    'balance' => $withPayables ? $s->balance : null,
                    'flows' => $rows->map(fn ($r) => [
                        'warehouse_id' => (int) $r->warehouse_id,
                        'total' => Decimal::money(Decimal::of((string) $r->total)),
                        'count' => (int) $r->n,
                    ])->values()->all(),
                ];
            })
            ->all();
    }
}
