<?php

use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

// Real multi-process tests need COMMITTED data: truncate instead of wrapping
// each test in a transaction.
pest()->extend(TestCase::class)
    ->use(DatabaseTruncation::class)
    ->in('Concurrency');

/**
 * Headers the SPA sends: Origin makes Sanctum treat the request as stateful.
 *
 * @return array<string, string>
 */
function spaHeaders(): array
{
    return [
        'Origin' => 'http://localhost:5173',
        'Referer' => 'http://localhost:5173/',
        'Accept' => 'application/json',
    ];
}
