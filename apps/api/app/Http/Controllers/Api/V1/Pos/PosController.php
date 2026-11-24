<?php

namespace App\Http\Controllers\Api\V1\Pos;

use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Sales\Actions\PosCheckout;
use App\Domain\Sales\Data\PosCheckoutData;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Services\PosCustomerResolver;
use App\Http\Controllers\Api\V1\Sales\SalesDocumentController;
use App\Http\Controllers\Controller;
use App\Http\Requests\Pos\PosCheckoutRequest;
use App\Http\Resources\Sales\CustomerResource;
use App\Http\Resources\Sales\SalesDocumentResource;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Point of sale (Phase 2b). Thin transport over the sales engine: the
 * checkout delegates to PosCheckout (SaveSalesDraft + PostSalesDocument).
 */
class PosController extends Controller
{
    /**
     * GET /pos/catalog?warehouse_id= — every active product with its price and the
     * stock of that warehouse, in one compact payload the POS caches and searches locally.
     */
    public function catalog(Request $request): JsonResponse
    {
        Gate::authorize('pos', SalesDocument::class);
        $warehouse = Warehouse::query()->findOrFail((int) $request->query('warehouse_id'));

        $rows = Product::query()
            ->where('products.is_active', true)
            ->leftJoin('stock_balances as b', fn (JoinClause $j) => $j->on('b.product_id', '=', 'products.id')
                ->where('b.warehouse_id', '=', $warehouse->id))
            ->leftJoin('product_categories as c', 'c.id', '=', 'products.category_id')
            ->join('units as u', 'u.id', '=', 'products.unit_id')
            ->orderBy('products.name')
            ->get([
                'products.id', 'products.sku', 'products.barcode', 'products.name', 'products.category_id',
                'c.name as category', 'u.code as unit', 'u.allows_decimals', 'products.sale_price',
                'products.min_price', 'b.quantity as stock',
            ]);

        return response()->json(['data' => $rows->map(fn (Product $p) => [
            'id' => $p->id,
            'sku' => $p->sku,
            'barcode' => $p->barcode,
            'name' => $p->name,
            'category_id' => $p->category_id,
            'category' => $p->getAttribute('category'),
            'unit' => $p->getAttribute('unit'),
            'allows_decimals' => (bool) $p->getAttribute('allows_decimals'),
            'sale_price' => $p->sale_price,
            'min_price' => $p->min_price,
            'stock' => $p->getAttribute('stock') ?? '0.0000',
        ])->values()]);
    }

    /** GET /pos/customers/lookup?document= — existing customer by NIT/CI, or {data: null}. */
    public function lookupCustomer(Request $request, PosCustomerResolver $customers): JsonResponse
    {
        Gate::authorize('pos', SalesDocument::class);
        $document = trim((string) $request->query('document'));
        $customer = $document === '' ? null : $customers->find($document);

        return response()->json(['data' => $customer ? CustomerResource::make($customer)->resolve($request) : null]);
    }

    /** POST /pos/sales (Idempotency-Key required) — atomic counter sale. */
    public function checkout(PosCheckoutRequest $request, PosCheckout $checkout): JsonResponse
    {
        Gate::authorize('pos', SalesDocument::class);
        $key = trim((string) $request->header('Idempotency-Key'));
        if ($key === '') {
            throw ValidationException::withMessages(['idempotency_key' => 'Falta la cabecera Idempotency-Key.']);
        }

        $sale = $checkout->handle(PosCheckoutData::fromArray($request->validated(), $key), $request->user());

        return SalesDocumentResource::make($sale->load(SalesDocumentController::DETAIL_RELATIONS))
            ->response()
            ->setStatusCode($sale->wasRecentlyCreated ? 201 : 200);
    }

    /** PATCH /pos/preferences {warehouse_id} — the warehouse the POS opens with. */
    public function preferences(Request $request): JsonResponse
    {
        Gate::authorize('pos', SalesDocument::class);
        $data = $request->validate(['warehouse_id' => ['required', 'integer']]);
        $warehouse = Warehouse::query()->where('is_active', true)->findOrFail($data['warehouse_id']);
        $request->user()->forceFill(['pos_warehouse_id' => $warehouse->id])->save();

        return response()->json(['data' => ['pos_warehouse_id' => $warehouse->id]]);
    }
}
