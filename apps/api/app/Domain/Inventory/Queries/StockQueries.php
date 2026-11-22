<?php

namespace App\Domain\Inventory\Queries;

use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\StockBalance;
use App\Domain\Inventory\Models\StockMovement;
use App\Domain\Inventory\Models\Warehouse;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Read-side queries over the ledger. All of them are tenant-scoped through
 * the models' global scopes.
 */
class StockQueries
{
    /**
     * Products with their consolidated stock (all warehouses) as
     * stock_quantity / stock_value columns.
     *
     * @return Builder<Product>
     */
    public function productsWithStock(): Builder
    {
        $stock = StockBalance::query()
            ->selectRaw('product_id, SUM(quantity) AS total_quantity, SUM(total_value) AS total_value')
            ->groupBy('product_id');

        return Product::query()
            ->leftJoinSub($stock, 'stock', 'stock.product_id', '=', 'products.id')
            ->select('products.*')
            ->selectRaw('COALESCE(stock.total_quantity, 0) AS stock_quantity')
            ->selectRaw('COALESCE(stock.total_value, 0) AS stock_value');
    }

    /**
     * @return Collection<int, StockBalance>
     */
    public function stockByWarehouse(Product $product): Collection
    {
        return Warehouse::query()
            ->orderBy('name')
            ->get()
            ->map(function (Warehouse $warehouse) use ($product) {
                $balance = StockBalance::query()
                    ->where('product_id', $product->id)
                    ->where('warehouse_id', $warehouse->id)
                    ->first();

                return [
                    'warehouse' => ['id' => $warehouse->id, 'code' => $warehouse->code, 'name' => $warehouse->name, 'is_active' => $warehouse->is_active],
                    'quantity' => $balance?->quantity ?? '0.0000',
                    'avg_cost' => $balance?->avg_cost ?? '0.0000',
                    'total_value' => $balance?->total_value ?? '0.0000',
                    'updated_at' => $balance?->updated_at?->toIso8601String(),
                ];
            });
    }

    /**
     * Kardex movements for one product in one warehouse within [from, to]
     * (company-local dates applied to the posting timestamp).
     *
     * @return Builder<StockMovement>
     */
    /**
     * Bounds come in the company timezone; they are converted to UTC because the
     * query builder serializes dates WITHOUT offset (a 00:00 La Paz bound would be
     * read as 00:00 UTC and hide the evening movements).
     */
    public function kardex(Product $product, int $warehouseId, CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        return StockMovement::query()
            ->with('document:id,number,type,status')
            ->where('product_id', $product->id)
            ->where('warehouse_id', $warehouseId)
            ->where('occurred_at', '>=', $from->utc())
            ->where('occurred_at', '<', $to->utc())
            ->orderBy('id');
    }

    /**
     * Balance right before $from (last movement prior to the range).
     *
     * @return array{quantity: string, avg_cost: string, value: string}
     */
    public function openingBalance(Product $product, int $warehouseId, CarbonImmutable $from): array
    {
        $last = StockMovement::query()
            ->where('product_id', $product->id)
            ->where('warehouse_id', $warehouseId)
            ->where('occurred_at', '<', $from->utc())
            ->orderByDesc('id')
            ->first(['quantity_after', 'avg_cost_after', 'value_after']);

        return [
            'quantity' => $last?->quantity_after ?? '0.0000',
            'avg_cost' => $last?->avg_cost_after ?? '0.0000',
            'value' => $last?->value_after ?? '0.0000',
        ];
    }

    /**
     * @return array{count: int, items: list<array<string, mixed>>}
     */
    public function lowStock(int $limit = 6): array
    {
        $query = $this->productsWithStock()
            ->with('unit:id,code')
            ->where('products.is_active', true)
            ->where('products.min_stock', '>', 0)
            ->whereRaw('COALESCE(stock.total_quantity, 0) < products.min_stock');

        $count = (clone $query)->count();
        $items = $query
            ->orderByRaw('COALESCE(stock.total_quantity, 0) / NULLIF(products.min_stock, 0) ASC')
            ->limit($limit)
            ->get()
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'sku' => $p->sku,
                'name' => $p->name,
                'unit' => $p->unit?->code,
                'stock' => (string) $p->getAttribute('stock_quantity'),
                'min_stock' => $p->min_stock,
            ])
            ->all();

        return ['count' => $count, 'items' => $items];
    }

    /**
     * Inventory value per active warehouse.
     *
     * @return list<array{warehouse_id: int, code: string, name: string, value: string, products: int}>
     */
    public function valuationByWarehouse(): array
    {
        $totals = StockBalance::query()
            ->select('warehouse_id', DB::raw('SUM(total_value) AS value'), DB::raw('COUNT(*) FILTER (WHERE quantity > 0) AS products'))
            ->groupBy('warehouse_id')
            ->get()
            ->keyBy('warehouse_id');

        return Warehouse::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (Warehouse $w) => [
                'warehouse_id' => $w->id,
                'code' => $w->code,
                'name' => $w->name,
                'value' => (string) ($totals->get($w->id)?->getAttribute('value') ?? '0'),
                'products' => (int) ($totals->get($w->id)?->getAttribute('products') ?? 0),
            ])
            ->all();
    }
}
