<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Queries\StockQueries;
use App\Domain\Inventory\Services\DocumentValidator;
use App\Domain\Shared\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\UpdateInventorySettingsRequest;
use BcMath\Number;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class InventoryOverviewController extends Controller
{
    /** GET /dashboard/inventory — low stock + valuation per warehouse (real data). */
    public function dashboard(StockQueries $queries): JsonResponse
    {
        Gate::authorize('viewAny', Product::class);

        $valuation = $queries->valuationByWarehouse();
        $total = array_reduce($valuation, fn (Number $sum, array $w) => $sum + new Number($w['value']), new Number('0'));

        return response()->json([
            'low_stock' => $queries->lowStock(),
            'valuation' => [
                'total' => (string) $total->round(4),
                'warehouses' => $valuation,
            ],
        ]);
    }

    public function settings(Request $request, DocumentValidator $validator): JsonResponse
    {
        Gate::authorize('viewAny', Product::class);

        return response()->json($this->settingsPayload($request, $validator));
    }

    public function updateSettings(UpdateInventorySettingsRequest $request, DocumentValidator $validator, AuditLogger $audit): JsonResponse
    {
        abort_unless($request->user()->can('settings.manage'), 403);

        $company = $request->user()->company;
        $old = $company->only(['allow_negative_stock', 'document_backdate_days']);
        $company->update($request->validated());
        $audit->log('settings.inventory.updated', auditable: $company, old: $old, new: $company->only(array_keys($old)));

        return response()->json($this->settingsPayload($request, $validator));
    }

    /**
     * @return array<string, mixed>
     */
    private function settingsPayload(Request $request, DocumentValidator $validator): array
    {
        $company = $request->user()->company->refresh();
        [$min, $max] = $validator->dateWindow($company);

        return [
            'allow_negative_stock' => $company->allow_negative_stock,
            'document_backdate_days' => $company->document_backdate_days,
            'document_date_min' => $min->toDateString(),
            'document_date_max' => $max->toDateString(),
        ];
    }
}
