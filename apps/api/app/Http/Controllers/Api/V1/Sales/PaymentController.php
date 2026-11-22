<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Domain\Sales\Actions\RegisterPayment;
use App\Domain\Sales\Actions\VoidPayment;
use App\Domain\Sales\Data\PaymentData;
use App\Domain\Sales\Models\CustomerPayment;
use App\Http\Controllers\Concerns\PaginatesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\RegisterPaymentRequest;
use App\Http\Requests\Sales\VoidRequest;
use App\Http\Resources\Sales\PaymentResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class PaymentController extends Controller
{
    use PaginatesRequests;

    private const DETAIL_RELATIONS = ['customer', 'allocations.salesDocument', 'creator'];

    /**
     * GET /receivables/payments?filter[customer_id]=&filter[status]=&filter[method]=
     *     &filter[search]=&filter[date_from]=&filter[date_to]=&sort=-payment_date
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', CustomerPayment::class);

        $payments = QueryBuilder::for(CustomerPayment::query()->with(['customer', 'allocations.salesDocument']))
            ->allowedFilters(...[
                AllowedFilter::exact('customer_id'),
                AllowedFilter::exact('status'),
                AllowedFilter::exact('method'),
                AllowedFilter::callback('search', function (Builder $q, $value) {
                    $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $value).'%';
                    $q->where(fn (Builder $w) => $w->where('number', 'ilike', $term)->orWhere('reference', 'ilike', $term));
                }),
                AllowedFilter::callback('date_from', fn (Builder $q, $value) => $q->whereDate('payment_date', '>=', $value)),
                AllowedFilter::callback('date_to', fn (Builder $q, $value) => $q->whereDate('payment_date', '<=', $value)),
            ])
            ->allowedSorts('payment_date', 'number', 'amount', 'created_at')
            ->defaultSort('-created_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return PaymentResource::collection($payments);
    }

    public function store(RegisterPaymentRequest $request, RegisterPayment $register): JsonResponse
    {
        Gate::authorize('create', CustomerPayment::class);

        $key = $request->header('Idempotency-Key');
        $payment = $register->handle(PaymentData::fromArray($request->validated(), $key ? substr($key, 0, 100) : null), $request->user());

        return PaymentResource::make($payment->load(self::DETAIL_RELATIONS))
            ->response()
            ->setStatusCode($payment->wasRecentlyCreated ? 201 : 200);
    }

    public function show(CustomerPayment $payment): PaymentResource
    {
        Gate::authorize('view', $payment);

        return PaymentResource::make($payment->load(self::DETAIL_RELATIONS));
    }

    public function void(VoidRequest $request, CustomerPayment $payment, VoidPayment $void): PaymentResource
    {
        Gate::authorize('void', $payment);

        return $this->show($void->handle($payment, $request->user(), $request->string('reason')->toString()));
    }
}
