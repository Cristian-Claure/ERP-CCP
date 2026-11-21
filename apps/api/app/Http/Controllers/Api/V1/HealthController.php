<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\HealthService;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function __invoke(HealthService $health): JsonResponse
    {
        $result = $health->check();

        return response()->json(
            [...$result, 'timestamp' => now()->toIso8601String()],
            $result['status'] === 'ok' ? 200 : 503,
        );
    }
}
