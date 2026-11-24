<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Domain\Sales\Actions\ConvertQuoteToSale;
use App\Domain\Sales\Actions\DeleteSalesDraft;
use App\Domain\Sales\Actions\PostSalesDocument;
use App\Domain\Sales\Actions\SaveSalesDraft;
use App\Domain\Sales\Actions\VoidSalesDocument;
use App\Domain\Sales\Data\PostingAuthorization;
use App\Domain\Sales\Data\SalesDocumentData;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Models\SalesDocument;
use App\Http\Controllers\Concerns\PaginatesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\PostSalesDocumentRequest;
use App\Http\Requests\Sales\SaveSalesDocumentRequest;
use App\Http\Requests\Sales\VoidRequest;
use App\Http\Resources\Sales\SalesDocumentResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SalesDocumentController extends Controller
{
    use PaginatesRequests;

    public const DETAIL_RELATIONS = [
        'lines.product.unit', 'customer', 'warehouse', 'quote', 'conversions', 'inventoryDocument',
        'allocations.payment', 'creator', 'poster', 'voider', 'belowCostAuthorizer', 'creditOverrider',
    ];

    /**
     * GET /sales/documents?filter[status]=&filter[type]=quote|invoice|sales_note|sale
     *     &filter[customer_id]=&filter[warehouse_id]=&filter[payment_terms]=&filter[open]=1
     *     &filter[search]=&filter[date_from]=&filter[date_to]=&sort=-document_date
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', SalesDocument::class);

        $documents = QueryBuilder::for(SalesDocument::query()->with(['customer', 'warehouse'])->withCount('lines'))
            ->allowedFilters(...[
                AllowedFilter::exact('status'),
                AllowedFilter::callback('type', fn (Builder $q, $value) => $value === 'sale'
                    ? $q->where('type', '!=', SalesDocumentType::Quote)
                    : $q->whereIn('type', (array) $value)),
                AllowedFilter::exact('customer_id'),
                AllowedFilter::exact('warehouse_id'),
                AllowedFilter::exact('payment_terms'),
                AllowedFilter::callback('open', fn (Builder $q, $value) => filter_var($value, FILTER_VALIDATE_BOOLEAN)
                    ? $q->where('status', 'posted')->where('type', '!=', SalesDocumentType::Quote)->whereColumn('paid_amount', '<', 'total')
                    : $q),
                AllowedFilter::callback('search', function (Builder $q, $value) {
                    $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $value).'%';
                    $q->where(fn (Builder $w) => $w->where('number', 'ilike', $term)
                        ->orWhere('reference', 'ilike', $term)
                        ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'ilike', $term)->orWhere('document_number', 'ilike', $term)));
                }),
                AllowedFilter::callback('date_from', fn (Builder $q, $value) => $q->whereDate('document_date', '>=', $value)),
                AllowedFilter::callback('date_to', fn (Builder $q, $value) => $q->whereDate('document_date', '<=', $value)),
            ])
            ->allowedSorts('document_date', 'number', 'total', 'due_date', 'created_at', 'posted_at')
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return SalesDocumentResource::collection($documents);
    }

    public function store(SaveSalesDocumentRequest $request, SaveSalesDraft $save): JsonResponse
    {
        Gate::authorize('create', SalesDocument::class);

        $key = $request->header('Idempotency-Key');
        $document = $save->handle(SalesDocumentData::fromArray($request->validated(), $key ? substr($key, 0, 100) : null), $request->user());

        return SalesDocumentResource::make($document->load(self::DETAIL_RELATIONS))
            ->response()
            ->setStatusCode($document->wasRecentlyCreated ? 201 : 200);
    }

    public function show(SalesDocument $document): SalesDocumentResource
    {
        Gate::authorize('view', $document);

        return SalesDocumentResource::make($document->load(self::DETAIL_RELATIONS));
    }

    public function update(SaveSalesDocumentRequest $request, SalesDocument $document, SaveSalesDraft $save): SalesDocumentResource
    {
        Gate::authorize('update', $document);

        $data = SalesDocumentData::fromArray([...$request->validated(), 'type' => $document->type->value]);
        $save->handle($data, $request->user(), $document);

        return $this->show($document->refresh());
    }

    public function destroy(Request $request, SalesDocument $document, DeleteSalesDraft $delete): Response
    {
        Gate::authorize('delete', $document);

        $delete->handle($document, $request->user());

        return response()->noContent();
    }

    public function post(PostSalesDocumentRequest $request, SalesDocument $document, PostSalesDocument $post): SalesDocumentResource
    {
        Gate::authorize('post', $document);

        return $this->show($post->handle($document, $request->user(), PostingAuthorization::fromArray($request->validated())));
    }

    public function void(VoidRequest $request, SalesDocument $document, VoidSalesDocument $void): SalesDocumentResource
    {
        Gate::authorize('void', $document);

        return $this->show($void->handle($document, $request->user(), $request->string('reason')->toString()));
    }

    /** POST /sales/documents/{quote}/convert {type: invoice|sales_note} -> new draft */
    public function convert(Request $request, SalesDocument $document, ConvertQuoteToSale $convert): JsonResponse
    {
        Gate::authorize('create', SalesDocument::class);

        $validated = $request->validate([
            'type' => ['required', Rule::in([SalesDocumentType::Invoice->value, SalesDocumentType::SalesNote->value])],
        ]);

        $sale = $convert->handle($document, SalesDocumentType::from($validated['type']), $request->user());

        return SalesDocumentResource::make($sale->load(self::DETAIL_RELATIONS))->response()->setStatusCode(201);
    }
}
