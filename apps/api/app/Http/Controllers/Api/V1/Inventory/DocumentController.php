<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Domain\Inventory\Actions\DeleteInventoryDocumentDraft;
use App\Domain\Inventory\Actions\PostInventoryDocument;
use App\Domain\Inventory\Actions\SaveInventoryDocumentDraft;
use App\Domain\Inventory\Actions\VoidInventoryDocument;
use App\Domain\Inventory\Data\DocumentData;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Http\Controllers\Concerns\PaginatesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\SaveDocumentRequest;
use App\Http\Requests\Inventory\VoidDocumentRequest;
use App\Http\Resources\Inventory\DocumentResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;

class DocumentController extends Controller
{
    use PaginatesRequests;

    private const DETAIL_RELATIONS = ['lines.product.unit', 'warehouse', 'destinationWarehouse', 'creator', 'poster', 'voider'];

    /**
     * GET /inventory/documents?filter[status]=&filter[type]=&filter[warehouse_id]=&filter[search]=
     *     &filter[date_from]=&filter[date_to]=&sort=-document_date
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', InventoryDocument::class);

        $documents = QueryBuilder::for(InventoryDocument::query()->with(['warehouse', 'destinationWarehouse', 'creator'])->withCount('lines'))
            ->allowedFilters(...[
                AllowedFilter::exact('status'),
                AllowedFilter::exact('type'),
                AllowedFilter::callback('warehouse_id', fn (Builder $q, $value) => $q->where(fn (Builder $w) => $w
                    ->where('warehouse_id', $value)->orWhere('destination_warehouse_id', $value))),
                AllowedFilter::callback('search', function (Builder $q, $value) {
                    $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $value).'%';
                    $q->where(fn (Builder $w) => $w->where('number', 'ilike', $term)->orWhere('reference', 'ilike', $term));
                }),
                AllowedFilter::callback('date_from', fn (Builder $q, $value) => $q->whereDate('document_date', '>=', $value)),
                AllowedFilter::callback('date_to', fn (Builder $q, $value) => $q->whereDate('document_date', '<=', $value)),
            ])
            ->allowedSorts(...[
                'document_date', 'number', 'created_at', 'posted_at', 'total_cost',
                AllowedSort::field('type', 'type'),
            ])
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return DocumentResource::collection($documents);
    }

    public function store(SaveDocumentRequest $request, SaveInventoryDocumentDraft $save): JsonResponse
    {
        Gate::authorize('create', InventoryDocument::class);

        $key = $request->header('Idempotency-Key');
        $document = $save->handle(DocumentData::fromArray($request->validated(), $key ? substr($key, 0, 100) : null), $request->user());

        return DocumentResource::make($document->load(self::DETAIL_RELATIONS))
            ->response()
            ->setStatusCode($document->wasRecentlyCreated ? 201 : 200);
    }

    public function show(InventoryDocument $document): DocumentResource
    {
        Gate::authorize('view', $document);

        return DocumentResource::make($document->load(self::DETAIL_RELATIONS));
    }

    public function update(SaveDocumentRequest $request, InventoryDocument $document, SaveInventoryDocumentDraft $save): DocumentResource
    {
        Gate::authorize('update', $document);

        $data = DocumentData::fromArray([...$request->validated(), 'type' => $document->type->value]);
        $save->handle($data, $request->user(), $document);

        return $this->show($document->refresh());
    }

    public function destroy(Request $request, InventoryDocument $document, DeleteInventoryDocumentDraft $delete): Response
    {
        Gate::authorize('delete', $document);

        $delete->handle($document, $request->user());

        return response()->noContent();
    }

    public function post(Request $request, InventoryDocument $document, PostInventoryDocument $post): DocumentResource
    {
        Gate::authorize('post', $document);

        return $this->show($post->handle($document, $request->user()));
    }

    public function void(VoidDocumentRequest $request, InventoryDocument $document, VoidInventoryDocument $void): DocumentResource
    {
        Gate::authorize('void', $document);

        return $this->show($void->handle($document, $request->user(), $request->string('reason')->toString()));
    }
}
