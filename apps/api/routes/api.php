<?php

use App\Http\Controllers\Api\V1\Inventory\CatalogController;
use App\Http\Controllers\Api\V1\Inventory\DocumentController;
use App\Http\Controllers\Api\V1\Inventory\InventoryOverviewController;
use App\Http\Controllers\Api\V1\Inventory\KardexController;
use App\Http\Controllers\Api\V1\Inventory\ProductController;
use App\Http\Controllers\Api\V1\Sales\CustomerController;
use App\Http\Controllers\Api\V1\Sales\PaymentController;
use App\Http\Controllers\Api\V1\Sales\SalesDocumentController;
use App\Http\Controllers\Api\V1\Sales\SalesOverviewController;
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

        // ---- Sales -------------------------------------------------------------
        Route::get('customers', [CustomerController::class, 'index'])->name('customers.index');
        Route::post('customers', [CustomerController::class, 'store'])->name('customers.store');
        Route::get('customers/cities', [CustomerController::class, 'cities'])->name('customers.cities');
        Route::get('customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');
        Route::put('customers/{customer}', [CustomerController::class, 'update'])->name('customers.update');
        Route::get('customers/{customer}/statement', [CustomerController::class, 'statement'])->name('customers.statement');

        Route::prefix('sales')->name('sales.')->group(function (): void {
            Route::get('documents', [SalesDocumentController::class, 'index'])->name('documents.index');
            Route::post('documents', [SalesDocumentController::class, 'store'])->name('documents.store');
            Route::get('documents/{document}', [SalesDocumentController::class, 'show'])->name('documents.show');
            Route::put('documents/{document}', [SalesDocumentController::class, 'update'])->name('documents.update');
            Route::delete('documents/{document}', [SalesDocumentController::class, 'destroy'])->name('documents.destroy');
            Route::post('documents/{document}/post', [SalesDocumentController::class, 'post'])->name('documents.post');
            Route::post('documents/{document}/void', [SalesDocumentController::class, 'void'])->name('documents.void');
            Route::post('documents/{document}/convert', [SalesDocumentController::class, 'convert'])->name('documents.convert');
        });

        Route::prefix('receivables')->name('receivables.')->group(function (): void {
            Route::get('summary', [SalesOverviewController::class, 'receivables'])->name('summary');
            Route::get('payments', [PaymentController::class, 'index'])->name('payments.index');
            Route::post('payments', [PaymentController::class, 'store'])->name('payments.store');
            Route::get('payments/{payment}', [PaymentController::class, 'show'])->name('payments.show');
            Route::post('payments/{payment}/void', [PaymentController::class, 'void'])->name('payments.void');
        });

        Route::get('dashboard/sales', [SalesOverviewController::class, 'dashboard'])->name('dashboard.sales');
        Route::get('settings/sales', [SalesOverviewController::class, 'settings'])->name('settings.sales');
        Route::patch('settings/sales', [SalesOverviewController::class, 'updateSettings'])->name('settings.sales.update');

        Route::get('dashboard/inventory', [InventoryOverviewController::class, 'dashboard'])->name('dashboard.inventory');
        Route::get('settings/inventory', [InventoryOverviewController::class, 'settings'])->name('settings.inventory');
        Route::patch('settings/inventory', [InventoryOverviewController::class, 'updateSettings'])->name('settings.inventory.update');
    });
});
