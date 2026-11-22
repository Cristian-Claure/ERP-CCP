<?php

namespace App\Domain\Inventory\Services;

use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\StockBalance;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Shared\Models\Company;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Entry point to write the stock ledger. begin() locks every affected
 * balance (in a deterministic order, to avoid deadlocks) and returns a
 * LedgerSession that accumulates movements in memory until commit().
 *
 * Must run inside the caller's DB transaction.
 */
class StockLedger
{
    public function __construct(private readonly AverageCostCalculator $calculator) {}

    /**
     * @param  list<array{0: int, 1: int}>  $pairs  [product_id, warehouse_id]
     */
    public function begin(Company $company, InventoryDocument $document, array $pairs, int $userId): LedgerSession
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('StockLedger::begin() must run inside a database transaction.');
        }

        $pairs = collect($pairs)
            ->map(fn (array $p) => [(int) $p[0], (int) $p[1]])
            ->unique(fn (array $p) => $p[0].':'.$p[1])
            ->sortBy([fn ($a, $b) => $a[1] <=> $b[1], fn ($a, $b) => $a[0] <=> $b[0]])
            ->values();

        // Create missing balance rows without racing concurrent transactions.
        $now = now();
        DB::table('stock_balances')->insertOrIgnore($pairs->map(fn (array $p) => [
            'company_id' => $company->id,
            'product_id' => $p[0],
            'warehouse_id' => $p[1],
            'quantity' => 0,
            'avg_cost' => 0,
            'total_value' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all());

        // Lock in (warehouse_id, product_id) order: concurrent postings always
        // acquire row locks in the same sequence, so they cannot deadlock.
        $balances = StockBalance::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where(function ($q) use ($pairs) {
                foreach ($pairs as [$productId, $warehouseId]) {
                    $q->orWhere(fn ($w) => $w->where('product_id', $productId)->where('warehouse_id', $warehouseId));
                }
            })
            ->orderBy('warehouse_id')
            ->orderBy('product_id')
            ->lockForUpdate()
            ->get()
            ->keyBy(fn (StockBalance $b) => $b->product_id.':'.$b->warehouse_id);

        // Scope disabled because jobs may run without an HTTP company; filter explicitly.
        $products = Product::query()->withoutGlobalScopes()->where('company_id', $company->id)
            ->whereIn('id', $pairs->pluck(0))->get(['id', 'sku', 'name'])->keyBy('id');
        $warehouses = Warehouse::query()->withoutGlobalScopes()->where('company_id', $company->id)
            ->whereIn('id', $pairs->pluck(1))->get(['id', 'name'])->keyBy('id');

        return new LedgerSession(
            calculator: $this->calculator,
            company: $company,
            document: $document,
            userId: $userId,
            balances: $balances->all(),
            products: $products->all(),
            warehouses: $warehouses->all(),
        );
    }
}
