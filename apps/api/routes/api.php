<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use Illuminate\Support\Facades\Route;

/*
| All routes are prefixed with /api (bootstrap/app.php) and versioned here.
*/

Route::prefix('v1')->name('v1.')->group(function (): void {
    Route::get('health', HealthController::class)->name('health');

    Route::prefix('auth')->name('auth.')->group(function (): void {
        Route::post('login', [AuthController::class, 'login'])
            ->middleware('throttle:login')
            ->name('login');

        Route::middleware(['auth:sanctum', 'company'])->group(function (): void {
            Route::post('logout', [AuthController::class, 'logout'])->name('logout');
            Route::get('me', [AuthController::class, 'me'])->name('me');
        });
    });

    Route::middleware(['auth:sanctum', 'company', 'throttle:api'])->group(function (): void {
        // Business modules (inventory, sales, ...) are registered here from Phase 1.
    });
});
