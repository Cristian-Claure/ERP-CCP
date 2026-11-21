<?php

use App\Http\Controllers\Api\V1\Inventory\CatalogController;
use App\Http\Controllers\Api\V1\Inventory\DocumentController;
use App\Http\Controllers\Api\V1\Inventory\InventoryOverviewController;
use App\Http\Controllers\Api\V1\Inventory\KardexController;
use App\Http\Controllers\Api\V1\Inventory\ProductController;
use App\Http\Controllers\Api\V1\Shared\AuthController;
use App\Http\Controllers\Api\V1\Shared\HealthController;
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
        // ---- Inventory --------------------------------------------------------
        Route::prefix('inventory')->name('inventory.')->group(function (): void {
            Route::get('warehouses', [CatalogController::class, 'warehouses'])->name('warehouses.index');
            Route::post('warehouses', [CatalogController::class, 'storeWarehouse'])->name('warehouses.store');
            Route::put('warehouses/{warehouse}', [CatalogController::class, 'updateWarehouse'])->name('warehouses.update');
            Route::get('categories', [CatalogController::class, 'categories'])->name('categories.index');
            Route::post('categories', [CatalogController::class, 'storeCategory'])->name('categories.store');
            Route::get('units', [CatalogController::class, 'units'])->name('units.index');
            Route::get('adjustment-reasons', [CatalogController::class, 'adjustmentReasons'])->name('adjustment-reasons');
            Route::get('stock', [CatalogController::class, 'stock'])->name('stock');

            Route::get('products', [ProductController::class, 'index'])->name('products.index');
            Route::post('products', [ProductController::class, 'store'])->name('products.store');
            Route::get('products/{product}', [ProductController::class, 'show'])->name('products.show');
            Route::put('products/{product}', [ProductController::class, 'update'])->name('products.update');
            Route::get('products/{product}/stock', [ProductController::class, 'stock'])->name('products.stock');
            Route::get('products/{product}/kardex', [KardexController::class, 'index'])->name('products.kardex');
            Route::get('products/{product}/kardex/export', [KardexController::class, 'export'])->name('products.kardex.export');

            Route::get('documents', [DocumentController::class, 'index'])->name('documents.index');
            Route::post('documents', [DocumentController::class, 'store'])->name('documents.store');
            Route::get('documents/{document}', [DocumentController::class, 'show'])->name('documents.show');
            Route::put('documents/{document}', [DocumentController::class, 'update'])->name('documents.update');
            Route::delete('documents/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');
            Route::post('documents/{document}/post', [DocumentController::class, 'post'])->name('documents.post');
            Route::post('documents/{document}/void', [DocumentController::class, 'void'])->name('documents.void');
        });

        Route::get('dashboard/inventory', [InventoryOverviewController::class, 'dashboard'])->name('dashboard.inventory');
        Route::get('settings/inventory', [InventoryOverviewController::class, 'settings'])->name('settings.inventory');
        Route::patch('settings/inventory', [InventoryOverviewController::class, 'updateSettings'])->name('settings.inventory.update');
    });
});
