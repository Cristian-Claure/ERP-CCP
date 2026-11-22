<?php

namespace App\Domain\Atlas\Queries;

use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Sales\Enums\DebtStatus;
use App\Domain\Sales\Enums\SalesDocumentStatus;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Queries\ReceivablesQueries;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Read model of CCP Atlas: geolocated customers with their sales of the
 * period, the warehouses that served them (arcs) and, only when allowed,
 * their receivables. Pure reads; cached by AtlasCache.
 */
class AtlasQueries
{
    public const PERIODS = ['30d', '90d', '365d', 'ytd', 'all'];

    public function __construct(private readonly ReceivablesQueries $receivables) {}

    /**
     * @return array{0: ?CarbonImmutable, 1: CarbonImmutable}
     */
    public function range(string $period, CarbonImmutable $today): array
    {
        return [match ($period) {
            '30d' => $today->subDays(29),
            '365d' => $today->subDays(364),
            'ytd' => $today->startOfYear(),
            'all' => null,
            default => $today->subDays(89),
        }, $today];
    }

    /**
     * @return array{customers: list<array<string, mixed>>, period: array{key: string, from: ?string, to: string}}
     */
    public function customers(int $companyId, CarbonImmutable $today, string $period, ?string $segment, ?DebtStatus $status, bool $withReceivables): array
    {
        [$from, $to] = $this->range($period, $today);

        $query = Customer::query()
            ->select(['customers.id', 'name', 'city', 'department', 'country', 'segment', 'latitude', 'longitude', 'balance', 'credit_limit', 'payment_terms'])
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->when($segment, fn ($q) => $q->whereIn('segment', explode(',', $segment)));

        if ($withReceivables) {
            $this->receivables->withDebtAmounts($query, $today);
            if ($status !== null) {
                $this->receivables->whereDebtStatus($query, $status, $today);
            }
        }

        $customers = $query->orderBy('id')->get();
        $flows = $this->flows($companyId, $customers->pluck('id')->all(), $from, $to);

        return [
            'period' => ['key' => $period, 'from' => $from?->toDateString(), 'to' => $to->toDateString()],
            'customers' => $customers->map(function (Customer $c) use ($flows, $withReceivables) {
                $f = $flows[$c->id] ?? ['total' => Decimal::of('0'), 'count' => 0, 'last' => null, 'by_warehouse' => []];
                $row = [
                    'id' => $c->id,
                    'name' => $c->name,
                    'city' => $c->city,
                    'department' => $c->department,
                    'country' => $c->country,
                    'segment' => $c->segment->value,
                    'lat' => (float) $c->latitude,
                    'lng' => (float) $c->longitude,
                    'sales_total' => Decimal::money($f['total']),
                    'sales_count' => $f['count'],
                    'last_sale_at' => $f['last'],
                    'flows' => array_values($f['by_warehouse']),
                ];

                if ($withReceivables) {
                    $attributes = $c->getAttributes();
                    $row['receivables'] = [
                        'balance' => (string) $c->balance,
                        'overdue' => Decimal::money(Decimal::of($attributes['overdue_amount'] ?? '0')),
                        'debt_status' => ReceivablesQueries::statusFrom((string) $c->balance, $attributes['overdue_amount'] ?? null, $attributes['due_soon_amount'] ?? null)->value,
                    ];
                }

                return $row;
            })->all(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function warehouses(int $companyId): array
    {
        return Warehouse::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->whereNotNull('latitude')
            ->orderBy('id')
            ->get(['id', 'code', 'name', 'address', 'latitude', 'longitude'])
            ->map(fn (Warehouse $w) => [
                'id' => $w->id,
                'code' => $w->code,
                'name' => $w->name,
                'address' => $w->address,
                'lat' => (float) $w->latitude,
                'lng' => (float) $w->longitude,
            ])->all();
    }

    /**
     * Sales of the period per customer and per serving warehouse.
     *
     * @param  list<int>  $customerIds
     * @return array<int, array{total: Number, count: int, last: ?string, by_warehouse: array<int, array{warehouse_id: int, total: string, count: int}>}>
     */
    private function flows(int $companyId, array $customerIds, ?CarbonImmutable $from, CarbonImmutable $to): array
    {
        if ($customerIds === []) {
            return [];
        }

        $rows = DB::table('sales_documents')
            ->where('company_id', $companyId)
            ->where('status', SalesDocumentStatus::Posted->value)
            ->where('type', '!=', SalesDocumentType::Quote->value)
            ->whereIn('customer_id', $customerIds)
            ->when($from, fn ($q) => $q->where('document_date', '>=', $from->toDateString()))
            ->where('document_date', '<=', $to->toDateString())
            ->groupBy('customer_id', 'warehouse_id')
            ->get(['customer_id', 'warehouse_id', DB::raw('SUM(total) AS total'), DB::raw('COUNT(*) AS n'), DB::raw('MAX(document_date) AS last')]);

        $result = [];
        foreach ($rows as $r) {
            $id = (int) $r->customer_id;
            $result[$id] ??= ['total' => Decimal::of('0'), 'count' => 0, 'last' => null, 'by_warehouse' => []];
            $result[$id]['total'] += Decimal::of($r->total);
            $result[$id]['count'] += (int) $r->n;
            $result[$id]['last'] = max($result[$id]['last'] ?? '', (string) $r->last) ?: null;
            $result[$id]['by_warehouse'][(int) $r->warehouse_id] = [
                'warehouse_id' => (int) $r->warehouse_id,
                'total' => Decimal::money(Decimal::of($r->total)),
                'count' => (int) $r->n,
            ];
        }

        return $result;
    }
}
