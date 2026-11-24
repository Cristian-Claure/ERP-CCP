<?php

namespace App\Http\Controllers\Api\V1\Purchases;

use App\Domain\Purchases\Actions\SaveSupplier;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\Models\SupplierLedgerEntry;
use App\Domain\Purchases\Queries\PayablesQueries;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Http\Controllers\Concerns\PaginatesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Purchases\SaveSupplierRequest;
use App\Http\Resources\Purchases\SupplierResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SupplierController extends Controller
{
    use PaginatesRequests;

    /** GET /purchases/suppliers?filter[search]=&filter[country]=&filter[issues_invoice]=&filter[is_active]=&sort=name */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Supplier::class);
        $sorts = ['name', 'city', 'country', 'created_at'];
        if ($request->user()->can('payables.view')) {
            $sorts[] = 'balance';
        }

        $suppliers = QueryBuilder::for(Supplier::query())
            ->allowedFilters(...[
                AllowedFilter::callback('search', function (Builder $q, $value) {
                    $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $value).'%';
                    $q->where(fn (Builder $w) => $w->where('name', 'ilike', $term)->orWhere('tax_id', 'ilike', $term)
                        ->orWhere('contact_name', 'ilike', $term)->orWhere('city', 'ilike', $term));
                }),
                AllowedFilter::exact('country'),
                AllowedFilter::exact('issues_invoice'),
                AllowedFilter::exact('is_active'),
            ])
            ->allowedSorts(...$sorts)
            ->defaultSort('name')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return SupplierResource::collection($suppliers);
    }

    public function store(SaveSupplierRequest $request, SaveSupplier $save): JsonResponse
    {
        Gate::authorize('create', Supplier::class);

        return SupplierResource::make($save->handle($request->validated(), $request->user()))->response()->setStatusCode(201);
    }

    public function show(Request $request, Supplier $supplier, PayablesQueries $payables, DocumentDateWindow $dates): JsonResponse
    {
        Gate::authorize('view', $supplier);
        $data = SupplierResource::make($supplier)->resolve($request);
        if ($request->user()->can('payables.view')) {
            $data['aging'] = $payables->aging($dates->today($request->user()->company), $supplier->id);
        }

        return response()->json($data);
    }

    public function update(SaveSupplierRequest $request, Supplier $supplier, SaveSupplier $save): SupplierResource
    {
        Gate::authorize('update', $supplier);

        return SupplierResource::make($save->handle($request->validated(), $request->user(), $supplier));
    }

    /** GET /purchases/suppliers/{supplier}/statement — ledger entries, newest first. */
    public function statement(Request $request, Supplier $supplier): JsonResponse
    {
        Gate::authorize('viewPayables', $supplier);

        $entries = SupplierLedgerEntry::query()->where('supplier_id', $supplier->id)->orderByDesc('id')
            ->paginate($this->perPage($request, 50));

        return response()->json([
            'data' => collect($entries->items())->map(fn (SupplierLedgerEntry $e) => [
                'id' => $e->id,
                'kind' => $e->kind->value,
                'amount' => $e->amount,
                'balance_after' => $e->balance_after,
                'entry_date' => $e->entry_date->toDateString(),
                'due_date' => $e->due_date?->toDateString(),
                'description' => $e->description,
                'source_type' => $e->source_type,
                'source_id' => $e->source_id,
            ]),
            'meta' => ['current_page' => $entries->currentPage(), 'last_page' => $entries->lastPage(), 'per_page' => $entries->perPage(), 'total' => $entries->total()],
        ]);
    }
}
