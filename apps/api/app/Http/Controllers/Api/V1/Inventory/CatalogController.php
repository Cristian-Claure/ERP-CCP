<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Domain\Inventory\Enums\AdjustmentReason;
use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\ProductCategory;
use App\Domain\Inventory\Models\StockBalance;
use App\Domain\Inventory\Models\Unit;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Shared\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\SaveWarehouseRequest;
use App\Http\Resources\Inventory\CategoryResource;
use App\Http\Resources\Inventory\UnitResource;
use App\Http\Resources\Inventory\WarehouseResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Small catalogs: warehouses, categories, units, adjustment reasons, and
 * live stock availability for the document form.
 */
class CatalogController extends Controller
{
    public function warehouses(): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Warehouse::class);

        return WarehouseResource::collection(Warehouse::query()->orderBy('name')->get());
    }

    public function storeWarehouse(SaveWarehouseRequest $request, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('create', Warehouse::class);

        $warehouse = Warehouse::query()->create($request->validated());
        $audit->log('inventory.warehouse.created', auditable: $warehouse, new: $warehouse->only(['code', 'name']));

        return WarehouseResource::make($warehouse)->response()->setStatusCode(201);
    }

    public function updateWarehouse(SaveWarehouseRequest $request, Warehouse $warehouse, AuditLogger $audit): WarehouseResource
    {
        Gate::authorize('update', $warehouse);

        $old = $warehouse->only(['code', 'name', 'address', 'is_active']);
        $warehouse->update($request->validated());
        $audit->log('inventory.warehouse.updated', auditable: $warehouse, old: $old, new: $warehouse->only(array_keys($old)));

        return WarehouseResource::make($warehouse);
    }

    public function categories(): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Product::class);

        return CategoryResource::collection(ProductCategory::query()->orderBy('name')->get());
    }

    public function storeCategory(Request $request): JsonResponse
    {
        Gate::authorize('create', Product::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('product_categories')->where('company_id', $request->user()->company_id)],
        ]);

        return CategoryResource::make(ProductCategory::query()->create($data))->response()->setStatusCode(201);
    }

    public function units(): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Product::class);

        return UnitResource::collection(Unit::query()->orderBy('name')->get());
    }

    public function adjustmentReasons(): JsonResponse
    {
        Gate::authorize('viewAny', Product::class);

        return response()->json(['data' => AdjustmentReason::options()]);
    }

    /** GET /inventory/stock?warehouse_id=1&product_ids[]=3&product_ids[]=7 */
    public function stock(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Product::class);

        $data = $request->validate([
            'warehouse_id' => ['required', 'integer'],
            'product_ids' => ['required', 'array', 'max:500'],
            'product_ids.*' => ['integer'],
        ]);

        $balances = StockBalance::query()
            ->where('warehouse_id', $data['warehouse_id'])
            ->whereIn('product_id', $data['product_ids'])
            ->get()
            ->keyBy('product_id');

        return response()->json(['data' => collect($data['product_ids'])->unique()->values()->map(fn ($id) => [
            'product_id' => (int) $id,
            'warehouse_id' => (int) $data['warehouse_id'],
            'quantity' => $balances->get($id)?->quantity ?? '0.0000',
            'avg_cost' => $balances->get($id)?->avg_cost ?? '0.0000',
        ])]);
    }
}
