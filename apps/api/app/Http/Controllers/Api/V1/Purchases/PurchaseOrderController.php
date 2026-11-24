<?php

namespace App\Http\Controllers\Api\V1\Purchases;

use App\Domain\Purchases\Actions\ApprovePurchaseOrder;
use App\Domain\Purchases\Actions\CancelPurchaseOrder;
use App\Domain\Purchases\Actions\PostPurchaseReceipt;
use App\Domain\Purchases\Actions\SavePurchaseOrder;
use App\Domain\Purchases\Data\PurchaseOrderData;
use App\Domain\Purchases\Data\ReceiptData;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Http\Controllers\Concerns\PaginatesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Purchases\PostReceiptRequest;
use App\Http\Requests\Purchases\SavePurchaseOrderRequest;
use App\Http\Requests\Sales\VoidRequest;
use App\Http\Resources\Purchases\PurchaseOrderResource;
use App\Http\Resources\Purchases\PurchaseReceiptResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class PurchaseOrderController extends Controller
{
    use PaginatesRequests;

    public const DETAIL_RELATIONS = ['lines.product.unit', 'supplier', 'warehouse', 'receipts', 'creator', 'approver'];

    /** GET /purchases/orders?filter[status]=&filter[supplier_id]=&filter[warehouse_id]=&filter[open]=1&filter[search]=&sort=-order_date */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', PurchaseOrder::class);

        $orders = QueryBuilder::for(PurchaseOrder::query()->with(['supplier', 'warehouse'])->withCount('lines'))
            ->allowedFilters(...[
                AllowedFilter::callback('status', fn (Builder $q, $v) => $q->whereIn('status', (array) $v)),
                AllowedFilter::exact('supplier_id'),
                AllowedFilter::exact('warehouse_id'),
                AllowedFilter::callback('open', fn (Builder $q, $v) => filter_var($v, FILTER_VALIDATE_BOOLEAN)
                    ? $q->whereIn('status', ['approved', 'partially_received']) : $q),
                AllowedFilter::callback('search', function (Builder $q, $value) {
                    $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $value).'%';
                    $q->where(fn (Builder $w) => $w->where('number', 'ilike', $term)->orWhere('reference', 'ilike', $term)
                        ->orWhereHas('supplier', fn (Builder $s) => $s->where('name', 'ilike', $term)->orWhere('tax_id', 'ilike', $term)));
                }),
                AllowedFilter::callback('date_from', fn (Builder $q, $v) => $q->whereDate('order_date', '>=', $v)),
                AllowedFilter::callback('date_to', fn (Builder $q, $v) => $q->whereDate('order_date', '<=', $v)),
            ])
            ->allowedSorts('order_date', 'number', 'total', 'expected_date', 'created_at')
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return PurchaseOrderResource::collection($orders);
    }

    public function store(SavePurchaseOrderRequest $request, SavePurchaseOrder $save): JsonResponse
    {
        Gate::authorize('create', PurchaseOrder::class);
        $order = $save->handle(PurchaseOrderData::fromArray($request->validated(), $request->header('Idempotency-Key')), $request->user());

        return PurchaseOrderResource::make($order->load(self::DETAIL_RELATIONS))->response()
            ->setStatusCode($order->wasRecentlyCreated ? 201 : 200);
    }

    public function show(PurchaseOrder $order): PurchaseOrderResource
    {
        Gate::authorize('view', $order);

        return PurchaseOrderResource::make($order->load(self::DETAIL_RELATIONS));
    }

    public function update(SavePurchaseOrderRequest $request, PurchaseOrder $order, SavePurchaseOrder $save): PurchaseOrderResource
    {
        Gate::authorize('update', $order);
        $save->handle(PurchaseOrderData::fromArray($request->validated()), $request->user(), $order);

        return $this->show($order->refresh());
    }

    public function approve(Request $request, PurchaseOrder $order, ApprovePurchaseOrder $approve): PurchaseOrderResource
    {
        Gate::authorize('approve', $order);

        return $this->show($approve->handle($order, $request->user()));
    }

    public function cancel(VoidRequest $request, PurchaseOrder $order, CancelPurchaseOrder $cancel): PurchaseOrderResource
    {
        Gate::authorize('cancel', $order);

        return $this->show($cancel->handle($order, $request->user(), $request->string('reason')->toString()));
    }

    /** POST /purchases/orders/{order}/receipts (Idempotency-Key) — partial or total receipt. */
    public function receive(PostReceiptRequest $request, PurchaseOrder $order, PostPurchaseReceipt $post): JsonResponse
    {
        Gate::authorize('receive', $order);
        $receipt = $post->handle($order, ReceiptData::fromArray($request->validated(), $request->header('Idempotency-Key')), $request->user());

        return PurchaseReceiptResource::make($receipt->load(PurchaseReceiptController::DETAIL_RELATIONS))->response()
            ->setStatusCode($receipt->wasRecentlyCreated ? 201 : 200);
    }
}
