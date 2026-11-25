<?php

namespace App\Http\Controllers\Api\V1\Purchases;

use App\Domain\Purchases\Actions\SavePurchaseOrder;
use App\Domain\Purchases\Contracts\PurchaseSuggestionProvider;
use App\Domain\Purchases\Data\PurchaseOrderData;
use App\Domain\Purchases\Data\PurchaseSuggestion;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\Queries\PayablesQueries;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Http\Controllers\Controller;
use App\Http\Requests\Purchases\UpdatePurchaseSettingsRequest;
use App\Http\Resources\Purchases\PurchaseOrderResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Dashboard figures, purchase suggestions (-> draft OC) and purchase settings. */
class PurchasesOverviewController extends Controller
{
    public function dashboard(Request $request, PayablesQueries $payables, DocumentDateWindow $dates): JsonResponse
    {
        Gate::authorize('viewAny', PurchaseOrder::class);
        $canSeePayables = $request->user()->can('payables.view');

        return response()->json([
            'pending_orders' => $payables->pendingOrders(),
            'payables' => $canSeePayables ? $payables->aging($dates->today($request->user()->company)) : null,
        ]);
    }

    /** GET /purchases/suggestions?warehouse_id=&supplier_id= */
    public function suggestions(Request $request, PurchaseSuggestionProvider $provider): JsonResponse
    {
        Gate::authorize('create', PurchaseOrder::class);
        $rows = $provider->suggest(
            $request->user()->company_id,
            $request->integer('warehouse_id') ?: null,
            $request->integer('supplier_id') ?: null,
        );

        return response()->json(['data' => array_map(fn (PurchaseSuggestion $s) => $s->toArray(), $rows)]);
    }

    /** POST /purchases/suggestions/orders {supplier_id, warehouse_id, lines[{product_id, quantity, unit_price}]} -> draft OC */
    public function createOrder(Request $request, SavePurchaseOrder $save, DocumentDateWindow $dates): JsonResponse
    {
        Gate::authorize('create', PurchaseOrder::class);
        $data = $request->validate([
            'supplier_id' => ['required', 'integer'],
            'warehouse_id' => ['required', 'integer'],
            'lines' => ['required', 'array', 'min:1', 'max:300'],
            'lines.*.product_id' => ['required', 'integer'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0', 'decimal:0,2'],
        ]);
        Supplier::query()->findOrFail($data['supplier_id']);

        $order = $save->handle(PurchaseOrderData::fromArray([
            ...$data,
            'order_date' => $dates->today($request->user()->company)->toDateString(),
            'notes' => 'Generada desde la sugerencia de compra.',
        ], $request->header('Idempotency-Key')), $request->user());

        return PurchaseOrderResource::make($order->load(PurchaseOrderController::DETAIL_RELATIONS))->response()->setStatusCode(201);
    }

    public function settings(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', PurchaseOrder::class);

        return response()->json($this->settingsPayload($request));
    }

    public function updateSettings(UpdatePurchaseSettingsRequest $request, AuditLogger $audit): JsonResponse
    {
        abort_unless($request->user()->can('settings.manage'), 403);

        $company = $request->user()->company;
        $keys = array_keys($request->validated());
        $old = $company->only($keys);
        $company->update($request->validated());
        $audit->log('settings.purchases.updated', auditable: $company, old: $old, new: $company->only($keys));

        return response()->json($this->settingsPayload($request));
    }

    /** @return array<string, mixed> */
    private function settingsPayload(Request $request): array
    {
        $company = $request->user()->company->refresh();

        return [
            'purchase_approval_threshold' => $company->purchase_approval_threshold,
            'purchase_receipt_tolerance_pct' => $company->purchase_receipt_tolerance_pct,
            'purchase_price_variance_pct' => $company->purchase_price_variance_pct,
        ];
    }
}
