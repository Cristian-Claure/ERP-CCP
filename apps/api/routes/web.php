<?php

use Illuminate\Support\Facades\Route;

// API-only application: the SPA lives in apps/web.
Route::get('/', fn () => response()->json([
    'name' => config('app.name'),
    'api' => url('/api/v1'),
]));
