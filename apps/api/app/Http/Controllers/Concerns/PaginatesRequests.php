<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;

/**
 * Shared list contract: ?page=1&per_page=25 (max 100).
 */
trait PaginatesRequests
{
    protected function perPage(Request $request, int $default = 25, int $max = 100): int
    {
        return max(1, min($max, (int) $request->integer('per_page', $default)));
    }
}
