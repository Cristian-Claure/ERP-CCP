<?php

namespace App\Http\Controllers\Api\V1\Atlas;

use App\Domain\Atlas\Queries\AtlasQueries;
use App\Domain\Atlas\Services\AtlasCache;
use App\Domain\Sales\Enums\CustomerSegment;
use App\Domain\Sales\Enums\DebtStatus;
use App\Domain\Sales\Models\Customer;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * CCP Atlas (3D globe). Requires customers.view; receivable fields (balance,
 * overdue, debt status) and the debt filter only with receivables.view.
 */
class AtlasController extends Controller
{
    public function __construct(
        private readonly AtlasQueries $queries,
        private readonly AtlasCache $cache,
        private readonly DocumentDateWindow $dates,
    ) {}

    /** GET /atlas/customers?period=30d|90d|365d|ytd|all&segment=retail,wholesale&status=overdue */
    public function customers(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Customer::class);

        $validated = $request->validate([
            'period' => ['nullable', Rule::in(AtlasQueries::PERIODS)],
            'segment' => ['nullable', 'string', 'regex:/^(retail|wholesale|corporate)(,(retail|wholesale|corporate))*$/'],
            'status' => ['nullable', Rule::enum(DebtStatus::class)],
        ]);

        $user = $request->user();
        $withReceivables = $user->can('receivables.view');
        $filters = [
            'period' => $validated['period'] ?? '90d',
            'segment' => $validated['segment'] ?? null,
            // Without receivables.view the debt filter does not exist for this user.
            'status' => $withReceivables ? ($validated['status'] ?? null) : null,
            'receivables' => $withReceivables,
        ];
        $today = $this->dates->today($user->company);
        $filters['today'] = $today->toDateString();

        $data = $this->cache->remember($user->company_id, 'customers', $filters, fn () => $this->queries->customers(
            $user->company_id,
            $today,
            $filters['period'],
            $filters['segment'],
            $filters['status'] ? DebtStatus::from($filters['status']) : null,
            $withReceivables,
        ));

        return response()->json([
            'data' => $data['customers'],
            'meta' => [
                'period' => $data['period'],
                'receivables' => $withReceivables,
                'segments' => array_map(fn (CustomerSegment $s) => ['value' => $s->value, 'label' => $s->label()], CustomerSegment::cases()),
                'cache_version' => $this->cache->version($user->company_id),
            ],
        ]);
    }

    /** GET /atlas/warehouses — warehouses with coordinates (arc origins). */
    public function warehouses(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Customer::class);

        $companyId = $request->user()->company_id;

        return response()->json([
            'data' => $this->cache->remember($companyId, 'warehouses', [], fn () => $this->queries->warehouses($companyId)),
        ]);
    }
}
