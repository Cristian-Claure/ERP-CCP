<?php

namespace App\Domain\Sales\Queries;

use App\Domain\Sales\Enums\DebtStatus;
use App\Domain\Sales\Enums\SalesDocumentStatus;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Support\Decimal;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

/**
 * Read side of accounts receivable: aging buckets and debt status, both
 * derived from OPEN sales (posted, not quotes, paid_amount < total).
 *
 * Aging by days past due: not yet due, 0–30, 31–60, 61–90, +90.
 */
class ReceivablesQueries
{
    public const BUCKETS = ['not_due', 'd0_30', 'd31_60', 'd61_90', 'd90_plus'];

    /**
     * @return array{not_due: string, d0_30: string, d31_60: string, d61_90: string, d90_plus: string, total: string}
     */
    public function aging(CarbonInterface $today, ?int $customerId = null): array
    {
        $row = $this->openSales()
            ->when($customerId, fn (Builder $q) => $q->where('customer_id', $customerId))
            ->selectRaw($this->bucketSelect(), $this->bucketBindings($today))
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
     * Aging per customer, keyed by customer id (only customers with debt).
     *
     * @param  list<int>  $customerIds
     * @return array<int, array<string, string>>
     */
    public function agingByCustomer(CarbonInterface $today, array $customerIds): array
    {
        if ($customerIds === []) {
            return [];
        }

        return $this->openSales()
            ->whereIn('customer_id', $customerIds)
            ->groupBy('customer_id')
            ->selectRaw('customer_id, '.$this->bucketSelect(), $this->bucketBindings($today))
            ->toBase()
            ->get()
            ->mapWithKeys(fn ($r) => [(int) $r->customer_id => array_combine(
                self::BUCKETS,
                array_map(fn (string $b) => Decimal::money(Decimal::of($r->{$b})), self::BUCKETS),
            )])
            ->all();
    }

    /**
     * Adds overdue_amount and due_soon_amount sub-selects to a customers query.
     *
     * @param  Builder<Customer>  $customers
     */
    public function withDebtAmounts(Builder $customers, CarbonInterface $today): Builder
    {
        $soon = $today->copy()->addDays(DebtStatus::DUE_SOON_DAYS)->toDateString();

        return $customers
            ->addSelect(['overdue_amount' => $this->openAmountSubquery()->where('sd.due_date', '<', $today->toDateString())])
            ->addSelect(['due_soon_amount' => $this->openAmountSubquery()
                ->where('sd.due_date', '>=', $today->toDateString())
                ->where('sd.due_date', '<=', $soon)]);
    }

    /**
     * Filters customers by debt status (same rules as DebtStatus).
     *
     * @param  Builder<Customer>  $customers
     */
    public function whereDebtStatus(Builder $customers, DebtStatus $status, CarbonInterface $today): Builder
    {
        $soon = $today->copy()->addDays(DebtStatus::DUE_SOON_DAYS)->toDateString();
        $today = $today->toDateString();
        $overdue = fn () => $this->openSalesExists()->where('sd.due_date', '<', $today);
        $dueSoon = fn () => $this->openSalesExists()->whereBetween('sd.due_date', [$today, $soon]);

        return match ($status) {
            DebtStatus::None => $customers->where('balance', '<=', 0),
            DebtStatus::Overdue => $customers->whereExists($overdue()),
            DebtStatus::DueSoon => $customers->whereNotExists($overdue())->whereExists($dueSoon()),
            DebtStatus::Current => $customers->where('balance', '>', 0)->whereNotExists($overdue())->whereNotExists($dueSoon()),
        };
    }

    public static function statusFrom(string $balance, ?string $overdue, ?string $dueSoon): DebtStatus
    {
        return match (true) {
            Decimal::of($overdue) > 0 => DebtStatus::Overdue,
            Decimal::of($dueSoon) > 0 => DebtStatus::DueSoon,
            Decimal::of($balance) > 0 => DebtStatus::Current,
            default => DebtStatus::None,
        };
    }

    /**
     * @return Builder<SalesDocument>
     */
    public function openSales(): Builder
    {
        return SalesDocument::query()
            ->where('status', SalesDocumentStatus::Posted)
            ->where('type', '!=', SalesDocumentType::Quote)
            ->whereColumn('paid_amount', '<', 'total');
    }

    private function openAmountSubquery(): QueryBuilder
    {
        return DB::table('sales_documents as sd')
            ->selectRaw('COALESCE(SUM(sd.total - sd.paid_amount), 0)')
            ->whereColumn('sd.customer_id', 'customers.id')
            ->where('sd.status', SalesDocumentStatus::Posted->value)
            ->where('sd.type', '!=', SalesDocumentType::Quote->value)
            ->whereColumn('sd.paid_amount', '<', 'sd.total');
    }

    private function openSalesExists(): QueryBuilder
    {
        return DB::table('sales_documents as sd')
            ->selectRaw('1')
            ->whereColumn('sd.customer_id', 'customers.id')
            ->where('sd.status', SalesDocumentStatus::Posted->value)
            ->where('sd.type', '!=', SalesDocumentType::Quote->value)
            ->whereColumn('sd.paid_amount', '<', 'sd.total');
    }

    private function bucketSelect(): string
    {
        // (today - due_date) = days past due; negative = not yet due.
        $open = '(total - paid_amount)';
        $days = '(CAST(? AS date) - due_date)';

        return implode(', ', [
            "COALESCE(SUM(CASE WHEN {$days} < 0 THEN {$open} END), 0) AS not_due",
            "COALESCE(SUM(CASE WHEN {$days} BETWEEN 0 AND 30 THEN {$open} END), 0) AS d0_30",
            "COALESCE(SUM(CASE WHEN {$days} BETWEEN 31 AND 60 THEN {$open} END), 0) AS d31_60",
            "COALESCE(SUM(CASE WHEN {$days} BETWEEN 61 AND 90 THEN {$open} END), 0) AS d61_90",
            "COALESCE(SUM(CASE WHEN {$days} > 90 THEN {$open} END), 0) AS d90_plus",
        ]);
    }

    /**
     * @return list<string>
     */
    private function bucketBindings(CarbonInterface $today): array
    {
        return array_fill(0, count(self::BUCKETS), $today->toDateString()); // one placeholder per bucket
    }
}
