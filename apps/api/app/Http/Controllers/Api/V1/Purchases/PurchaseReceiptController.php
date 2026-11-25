<?php

namespace App\Http\Controllers\Api\V1\Purchases;

use App\Domain\Purchases\Actions\VoidPurchaseReceipt;
use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Http\Controllers\Concerns\PaginatesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\VoidRequest;
use App\Http\Resources\Purchases\PurchaseReceiptResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class PurchaseReceiptController extends Controller
{
    use PaginatesRequests;

    public const DETAIL_RELATIONS = ['lines.product', 'costs', 'order', 'supplier', 'warehouse', 'inventoryDocument', 'creator', 'voider'];

    /** GET /purchases/receipts?filter[status]=&filter[supplier_id]=&filter[open]=1&filter[search]=&sort=-receipt_date */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', PurchaseReceipt::class);

        $receipts = QueryBuilder::for(PurchaseReceipt::query()->with(['supplier', 'order', 'warehouse']))
            ->allowedFilters(...[
                AllowedFilter::exact('status'),
                AllowedFilter::exact('supplier_id'),
                AllowedFilter::exact('purchase_order_id'),
                AllowedFilter::callback('open', fn (Builder $q, $v) => filter_var($v, FILTER_VALIDATE_BOOLEAN)
                    ? $q->where('status', 'posted')->whereColumn('paid_amount', '<', 'invoice_total') : $q),
                AllowedFilter::callback('search', function (Builder $q, $value) {
                    $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $value).'%';
                    $q->where(fn (Builder $w) => $w->where('number', 'ilike', $term)->orWhere('supplier_invoice_number', 'ilike', $term)
                        ->orWhereHas('supplier', fn (Builder $s) => $s->where('name', 'ilike', $term)));
                }),
            ])
            ->allowedSorts('receipt_date', 'number', 'invoice_total', 'due_date', 'created_at')
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return PurchaseReceiptResource::collection($receipts);
    }

    public function show(PurchaseReceipt $receipt): PurchaseReceiptResource
    {
        Gate::authorize('view', $receipt);

        return PurchaseReceiptResource::make($receipt->load(self::DETAIL_RELATIONS));
    }

    public function void(VoidRequest $request, PurchaseReceipt $receipt, VoidPurchaseReceipt $void): PurchaseReceiptResource
    {
        Gate::authorize('void', $receipt);

        return $this->show($void->handle($receipt, $request->user(), $request->string('reason')->toString()));
    }
}
