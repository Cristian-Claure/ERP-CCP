<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Queries\StockQueries;
use App\Domain\Shared\Services\AuditLogger;
use App\Http\Controllers\Concerns\PaginatesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\SaveProductRequest;
use App\Http\Resources\Inventory\ProductResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;

class ProductController extends Controller
{
    use PaginatesRequests;

    public function __construct(private readonly StockQueries $queries) {}

    /**
     * GET /inventory/products?filter[search]=&filter[category_id]=&filter[is_active]=&filter[below_min]=1&sort=-stock
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Product::class);

        $products = QueryBuilder::for($this->queries->productsWithStock()->with(['unit', 'category']))
            ->allowedFilters([
                AllowedFilter::callback('search', function (Builder $q, $value) {
                    $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $value).'%';
                    $q->where(fn (Builder $w) => $w
                        ->where('products.name', 'ilike', $term)
                        ->orWhere('products.sku', 'ilike', $term)
                        ->orWhere('products.barcode', 'ilike', $term));
                }),
                AllowedFilter::exact('category_id', 'products.category_id'),
                AllowedFilter::exact('is_active', 'products.is_active'),
                AllowedFilter::callback('below_min', fn (Builder $q, $value) => filter_var($value, FILTER_VALIDATE_BOOLEAN)
                    ? $q->where('products.min_stock', '>', 0)->whereRaw('COALESCE(stock.total_quantity, 0) < products.min_stock')
                    : $q),
            ])
            ->allowedSorts([
                AllowedSort::field('name', 'products.name'),
                AllowedSort::field('sku', 'products.sku'),
                AllowedSort::field('min_stock', 'products.min_stock'),
                AllowedSort::field('created_at', 'products.created_at'),
                AllowedSort::field('stock', 'stock_quantity'),
                AllowedSort::field('value', 'stock_value'),
            ])
            ->defaultSort('products.name')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return ProductResource::collection($products);
    }

    public function store(SaveProductRequest $request, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('create', Product::class);

        $product = Product::query()->create([...$request->validated(), 'min_stock' => $request->input('min_stock', 0)]);
        $audit->log('inventory.product.created', auditable: $product, new: $product->only(['sku', 'name', 'unit_id', 'min_stock']));

        return ProductResource::make($product->load(['unit', 'category']))->response()->setStatusCode(201);
    }

    public function show(Product $product): ProductResource
    {
        Gate::authorize('view', $product);

        $withStock = $this->queries->productsWithStock()->with(['unit', 'category'])->findOrFail($product->id);

        return ProductResource::make($withStock);
    }

    public function update(SaveProductRequest $request, Product $product, AuditLogger $audit): ProductResource
    {
        Gate::authorize('update', $product);

        $old = $product->only(['sku', 'name', 'unit_id', 'category_id', 'min_stock', 'is_active']);
        $product->update($request->validated());
        $audit->log('inventory.product.updated', auditable: $product, old: $old, new: $product->only(array_keys($old)));

        return $this->show($product);
    }

    /** GET /inventory/products/{product}/stock — balance per warehouse. */
    public function stock(Product $product): JsonResponse
    {
        Gate::authorize('view', $product);

        return response()->json(['data' => $this->queries->stockByWarehouse($product)]);
    }
}
