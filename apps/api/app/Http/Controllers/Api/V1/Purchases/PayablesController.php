<?php

namespace App\Http\Controllers\Api\V1\Purchases;

use App\Domain\Purchases\Actions\RegisterSupplierPayment;
use App\Domain\Purchases\Actions\VoidSupplierPayment;
use App\Domain\Purchases\Data\SupplierPaymentData;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\Models\SupplierPayment;
use App\Domain\Purchases\Queries\PayablesQueries;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Http\Controllers\Concerns\PaginatesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Purchases\RegisterSupplierPaymentRequest;
use App\Http\Requests\Sales\VoidRequest;
use App\Http\Resources\Purchases\SupplierPaymentResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/** Accounts payable: summary (aging), supplier payments (PAG-) and their void. */
class PayablesController extends Controller
{
    use PaginatesRequests;

    private const RELATIONS = ['supplier', 'allocations.receipt', 'creator'];

    public function summary(Request $request, PayablesQueries $payables, DocumentDateWindow $dates): JsonResponse
    {
        Gate::authorize('viewPayables', Supplier::class);
        $today = $dates->today($request->user()->company);

        return response()->json([
            'aging' => $payables->aging($today),
            'top_suppliers' => $payables->topSuppliers($today),
        ]);
    }

    /** GET /payables/payments?filter[supplier_id]=&filter[status]=&filter[search]=&sort=-payment_date */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', SupplierPayment::class);

        $payments = QueryBuilder::for(SupplierPayment::query()->with('supplier'))
            ->allowedFilters(...[
                AllowedFilter::exact('supplier_id'),
                AllowedFilter::exact('status'),
                AllowedFilter::exact('method'),
                AllowedFilter::callback('search', function (Builder $q, $value) {
                    $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $value).'%';
                    $q->where(fn (Builder $w) => $w->where('number', 'ilike', $term)->orWhere('reference', 'ilike', $term)
                        ->orWhereHas('supplier', fn (Builder $s) => $s->where('name', 'ilike', $term)));
                }),
            ])
            ->allowedSorts('payment_date', 'number', 'amount', 'created_at')
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return SupplierPaymentResource::collection($payments);
    }

    public function store(RegisterSupplierPaymentRequest $request, RegisterSupplierPayment $register): JsonResponse
    {
        Gate::authorize('create', SupplierPayment::class);
        $payment = $register->handle(SupplierPaymentData::fromArray($request->validated(), $request->header('Idempotency-Key')), $request->user());

        return SupplierPaymentResource::make($payment->load(self::RELATIONS))->response()
            ->setStatusCode($payment->wasRecentlyCreated ? 201 : 200);
    }

    public function show(SupplierPayment $payment): SupplierPaymentResource
    {
        Gate::authorize('view', $payment);

        return SupplierPaymentResource::make($payment->load(self::RELATIONS));
    }

    public function void(VoidRequest $request, SupplierPayment $payment, VoidSupplierPayment $void): SupplierPaymentResource
    {
        Gate::authorize('void', $payment);

        return $this->show($void->handle($payment, $request->user(), $request->string('reason')->toString()));
    }
}
