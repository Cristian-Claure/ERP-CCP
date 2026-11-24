<?php

namespace App\Domain\Purchases\Queries;

use App\Domain\Purchases\Enums\PurchaseOrderStatus;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Support\Decimal;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Read side of accounts payable (same buckets as receivables: not yet due,
 * 0–30, 31–60, 61–90, +90 days past due) over OPEN receipts, plus the
 * "pending orders" figures of the dashboard.
 */
class PayablesQueries
{
    public const BUCKETS = ['not_due', 'd0_30', 'd31_60', 'd61_90', 'd90_plus'];

    /**
     * @return array<string, string> buckets + total
     */
    public function aging(CarbonInterface $today, ?int $supplierId = null): array
    {
        $row = $this->openReceipts()
            ->when($supplierId, fn (Builder $q) => $q->where('supplier_id', $supplierId))
            ->selectRaw($this->bucketSelect(), array_fill(0, count(self::BUCKETS), $today->toDateString()))
            ->toBase()
            ->first();

        $result = [];
        $total = Decimal::of('0');
        foreach (self::BUCKETS as $bucket) {
            $value = Decimal::of($row->{$bucket} ?? '0');
            $result[$bucket] = Decimal::money($value);
            $total += $value;
        }
        $result['total'] = Decimal::money($total);

        return $result;
    }

    /**
     * Suppliers we owe the most to, with their overdue part.
     *
     * @return list<array{supplier_id: int, name: string, balance: string, overdue: string}>
     */
    public function topSuppliers(CarbonInterface $today, int $limit = 5): array
    {
        return $this->openReceipts()
            ->join('suppliers', 'suppliers.id', '=', 'purchase_receipts.supplier_id')
            ->groupBy('suppliers.id', 'suppliers.name')
            ->selectRaw('suppliers.id AS supplier_id, suppliers.name, SUM(invoice_total - paid_amount) AS balance,
                COALESCE(SUM(CASE WHEN due_date < ? THEN invoice_total - paid_amount END), 0) AS overdue', [$today->toDateString()])
            ->orderByDesc('balance')
            ->limit($limit)
            ->toBase()
            ->get()
            ->map(fn ($r) => [
                'supplier_id' => (int) $r->supplier_id,
                'name' => $r->name,
                'balance' => Decimal::money(Decimal::of((string) $r->balance)),
                'overdue' => Decimal::money(Decimal::of((string) $r->overdue)),
            ])
            ->all();
    }

    /**
     * Approved or partially received OCs: count and the value still pending.
     *
     * @return array{count: int, pending_value: string}
     */
    public function pendingOrders(): array
    {
        $row = PurchaseOrder::query()
            ->whereIn('purchase_orders.status', PurchaseOrderStatus::open())
            ->join('purchase_order_lines as l', 'l.purchase_order_id', '=', 'purchase_orders.id')
            ->selectRaw('COUNT(DISTINCT purchase_orders.id) AS count, COALESCE(SUM(GREATEST(l.quantity - l.received_quantity, 0) * l.unit_price), 0) AS pending_value')
            ->toBase()
            ->first();

        return ['count' => (int) $row->count, 'pending_value' => Decimal::money(Decimal::of((string) $row->pending_value))];
    }

    /** @return Builder<PurchaseReceipt> */
    public function openReceipts(): Builder
    {
        return PurchaseReceipt::query()
            ->where('purchase_receipts.status', PaymentStatus::Posted)
            ->whereColumn('paid_amount', '<', 'invoice_total');
    }

    private function bucketSelect(): string
    {
        $open = '(invoice_total - paid_amount)';
        $days = '(CAST(? AS date) - due_date)';

        return implode(', ', [
            "COALESCE(SUM(CASE WHEN {$days} < 0 THEN {$open} END), 0) AS not_due",
            "COALESCE(SUM(CASE WHEN {$days} BETWEEN 0 AND 30 THEN {$open} END), 0) AS d0_30",
            "COALESCE(SUM(CASE WHEN {$days} BETWEEN 31 AND 60 THEN {$open} END), 0) AS d31_60",
            "COALESCE(SUM(CASE WHEN {$days} BETWEEN 61 AND 90 THEN {$open} END), 0) AS d61_90",
            "COALESCE(SUM(CASE WHEN {$days} > 90 THEN {$open} END), 0) AS d90_plus",
        ]);
    }
}
