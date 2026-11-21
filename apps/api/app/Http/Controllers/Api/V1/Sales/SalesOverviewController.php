<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Queries\ReceivablesQueries;
use App\Domain\Sales\Queries\SalesQueries;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Domain\Shared\Support\Decimal;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\UpdateSalesSettingsRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SalesOverviewController extends Controller
{
    public function __construct(
        private readonly SalesQueries $sales,
        private readonly ReceivablesQueries $receivables,
        private readonly DocumentDateWindow $dates,
    ) {}

    /**
     * GET /dashboard/sales — month KPIs, 90-day daily series, top customers
     * and products. Receivables only with receivables.view; product margins
     * only with sales.view_margin (otherwise ranked by revenue).
     */
    public function dashboard(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', SalesDocument::class);

        $user = $request->user();
        $companyId = $user->company_id;
        $today = $this->dates->today($user->company);
        $monthStart = $today->startOfMonth();
        $prevStart = $monthStart->subMonth();
        $prevSameDay = $prevStart->addDays(min($today->day, $prevStart->daysInMonth) - 1);
        $from90 = $today->subDays(89);
        $byMargin = $user->can('sales.view_margin');

        return response()->json([
            'month' => [
                'current' => $this->sales->totals($companyId, $monthStart, $today),
                // Same period of the previous month, for a fair comparison.
                'previous' => $this->sales->totals($companyId, $prevStart, $prevSameDay),
            ],
            'daily' => $this->sales->daily($companyId, $from90, $today),
            'top_customers' => $this->sales->topCustomers($companyId, $from90, $today),
            'top_products' => [
                'metric' => $byMargin ? 'margin' : 'revenue',
                'items' => $this->sales->topProducts($companyId, $from90, $today, $byMargin),
            ],
            'receivables' => $user->can('receivables.view') ? $this->receivablesSummary($today) : null,
        ]);
    }

    /** GET /receivables/summary — aging of the whole portfolio and top debtors. */
    public function receivables(Request $request): JsonResponse
    {
        Gate::authorize('viewReceivables', Customer::class);

        return response()->json($this->receivablesSummary($this->dates->today($request->user()->company)));
    }

    public function settings(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', SalesDocument::class);

        return response()->json($this->settingsPayload($request));
    }

    public function updateSettings(UpdateSalesSettingsRequest $request, AuditLogger $audit): JsonResponse
    {
        abort_unless($request->user()->can('settings.manage'), 403);

        $company = $request->user()->company;
        $keys = array_keys($request->validated());
        $old = $company->only($keys);
        $company->update($request->validated());
        $audit->log('settings.sales.updated', auditable: $company, old: $old, new: $company->only($keys));

        return response()->json($this->settingsPayload($request));
    }

    /**
     * @return array<string, mixed>
     */
    private function receivablesSummary($today): array
    {
        $aging = $this->receivables->aging($today);
        $overdue = Decimal::of($aging['d0_30']) + Decimal::of($aging['d31_60']) + Decimal::of($aging['d61_90']) + Decimal::of($aging['d90_plus']);

        $debtors = Customer::query()
            ->where('balance', '>', 0)
            ->orderByDesc('balance')
            ->limit(5)
            ->get(['id', 'name', 'city', 'balance', 'credit_limit']);

        return [
            'total' => $aging['total'],
            'overdue' => Decimal::money($overdue),
            'aging' => $aging,
            'customers_with_debt' => Customer::query()->where('balance', '>', 0)->count(),
            'top_debtors' => $debtors->map(fn (Customer $c) => [
                'customer_id' => $c->id,
                'name' => $c->name,
                'city' => $c->city,
                'balance' => $c->balance,
                'credit_limit' => $c->credit_limit,
            ])->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function settingsPayload(Request $request): array
    {
        $company = $request->user()->company->refresh();

        return [
            'sales_note_vat_breakdown' => $company->sales_note_vat_breakdown,
            'quote_validity_days' => $company->quote_validity_days,
            'default_customer_id' => $company->default_customer_id,
            'vat_rate' => '13.00',
        ];
    }
}
