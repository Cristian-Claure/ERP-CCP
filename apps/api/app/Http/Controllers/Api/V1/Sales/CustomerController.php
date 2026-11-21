<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Domain\Sales\Actions\SaveCustomer;
use App\Domain\Sales\Data\CustomerData;
use App\Domain\Sales\Enums\DebtStatus;
use App\Domain\Sales\Enums\SalesDocumentStatus;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\CustomerLedgerEntry;
use App\Domain\Sales\Queries\ReceivablesQueries;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Http\Controllers\Concerns\PaginatesRequests;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\SaveCustomerRequest;
use App\Http\Resources\Sales\CustomerResource;
use App\Http\Resources\Sales\LedgerEntryResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;

class CustomerController extends Controller
{
    use PaginatesRequests;

    public function __construct(
        private readonly ReceivablesQueries $receivables,
        private readonly DocumentDateWindow $dates,
    ) {}

    /**
     * GET /customers?filter[search]=&filter[city]=&filter[segment]=&filter[payment_terms]=
     *     &filter[is_active]=&filter[debt_status]=&sort=name
     * debt_status and the balance sort require receivables.view.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Customer::class);

        $receivables = $request->user()->can('receivables.view');
        $today = $this->dates->today($request->user()->company);
        $base = Customer::query()->select('customers.*');
        if ($receivables) {
            $this->receivables->withDebtAmounts($base, $today);
        }

        $filters = [
            AllowedFilter::callback('search', function (Builder $q, $value) {
                $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $value).'%';
                $q->where(fn (Builder $w) => $w->where('name', 'ilike', $term)->orWhere('document_number', 'ilike', $term)->orWhere('email', 'ilike', $term));
            }),
            AllowedFilter::exact('city'),
            AllowedFilter::exact('segment'),
            AllowedFilter::exact('payment_terms'),
            AllowedFilter::exact('is_active'),
            // Accepted for everyone (same URL contract) but ignored without receivables.view.
            AllowedFilter::callback('debt_status', function (Builder $q, $value) use ($today, $receivables) {
                $status = DebtStatus::tryFrom((string) $value);
                if ($receivables && $status !== null) {
                    $this->receivables->whereDebtStatus($q, $status, $today);
                }
            }),
        ];
        $sorts = ['name', 'city', 'created_at', AllowedSort::field('document_number', 'document_number')];

        if ($receivables) {
            $sorts[] = 'balance';
            $sorts[] = 'credit_limit';
        }

        $customers = QueryBuilder::for($base)
            ->allowedFilters(...$filters)
            ->allowedSorts(...$sorts)
            ->defaultSort('name')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return CustomerResource::collection($customers);
    }

    /** GET /customers/cities — distinct cities for the list filter. */
    public function cities(): JsonResponse
    {
        Gate::authorize('viewAny', Customer::class);

        return response()->json(['data' => Customer::query()
            ->whereNotNull('city')->distinct()->orderBy('city')->pluck('city')]);
    }

    public function store(SaveCustomerRequest $request, SaveCustomer $save): JsonResponse
    {
        Gate::authorize('create', Customer::class);

        $customer = $save->handle(CustomerData::fromArray($request->validated()), $request->user());

        return CustomerResource::make($customer)->response()->setStatusCode(201);
    }

    public function show(Request $request, Customer $customer): JsonResponse
    {
        Gate::authorize('view', $customer);

        $today = $this->dates->today($request->user()->company);
        $query = Customer::query()->select('customers.*')->whereKey($customer->id);
        $receivables = $request->user()->can('receivables.view');
        if ($receivables) {
            $this->receivables->withDebtAmounts($query, $today);
        }
        $query->addSelect($this->salesStats());

        // Same unwrapped shape as every single resource (additional() would force a "data" wrapper).
        $data = CustomerResource::make($query->firstOrFail())->resolve($request);
        if ($receivables) {
            $data['aging'] = $this->receivables->aging($today, $customer->id);
        }

        return response()->json($data);
    }

    public function update(SaveCustomerRequest $request, Customer $customer, SaveCustomer $save): CustomerResource
    {
        Gate::authorize('update', $customer);

        return CustomerResource::make($save->handle(CustomerData::fromArray($request->validated()), $request->user(), $customer));
    }

    /**
     * GET /customers/{customer}/statement?date_from=&date_to=&page=
     * Ledger entries (oldest first) with running balance, the opening
     * balance before date_from and the aging of the open debt.
     */
    public function statement(Request $request, Customer $customer): JsonResponse
    {
        Gate::authorize('viewReceivables', $customer);

        $request->validate([
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $from = $request->input('date_from');
        $to = $request->input('date_to');

        $entries = CustomerLedgerEntry::query()
            ->where('customer_id', $customer->id)
            ->when($from, fn (Builder $q) => $q->whereDate('entry_date', '>=', $from))
            ->when($to, fn (Builder $q) => $q->whereDate('entry_date', '<=', $to))
            ->orderBy('id')
            ->paginate($this->perPage($request, 50, 200))
            ->withQueryString();

        // Balance just before the first entry shown (running balance is stored per entry).
        $first = $entries->first();
        $opening = $first !== null
            ? bcsub((string) $first->balance_after, (string) $first->amount, 2)
            : (string) $customer->balance;

        return LedgerEntryResource::collection($entries)->additional([
            'opening_balance' => $opening,
            'balance' => $customer->balance,
            'aging' => $this->receivables->aging($this->dates->today($request->user()->company), $customer->id),
        ])->response();
    }

    /**
     * @return array<string, \Illuminate\Database\Query\Builder>
     */
    private function salesStats(): array
    {
        $sales = fn (string $select) => DB::table('sales_documents as s')
            ->selectRaw($select)
            ->whereColumn('s.customer_id', 'customers.id')
            ->where('s.status', SalesDocumentStatus::Posted->value)
            ->where('s.type', '!=', SalesDocumentType::Quote->value);

        return [
            'sales_count' => $sales('COUNT(*)'),
            'sales_total' => $sales('COALESCE(SUM(s.total), 0)'),
            'last_sale_at' => $sales('MAX(s.document_date)'),
        ];
    }
}
