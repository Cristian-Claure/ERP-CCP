<?php

/**
 * Worker for ConcurrentPostingTest. Boots the app in a separate PHP process
 * (own DB connection), waits on a PostgreSQL advisory-lock barrier held by
 * the test, then posts the given document. Prints a JSON result.
 *
 * Usage: php post-document.php <documentId> <userId> <companyId>
 */

use App\Domain\Inventory\Actions\PostInventoryDocument;
use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../../vendor/autoload.php';
$app = require __DIR__.'/../../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[, $documentId, $userId, $companyId] = $argv;

// Barrier: blocks until the test releases its exclusive lock.
DB::select('SELECT pg_advisory_lock_shared(4242)');

try {
    $number = CompanyContext::run((int) $companyId, function () use ($documentId, $userId) {
        $user = User::query()->withoutGlobalScopes()->findOrFail((int) $userId);
        $document = InventoryDocument::query()->findOrFail((int) $documentId);

        return app(PostInventoryDocument::class)->handle($document, $user)->number;
    });
    echo json_encode(['ok' => true, 'number' => $number]);
} catch (InsufficientStockException $e) {
    echo json_encode(['ok' => false, 'code' => $e->errorCode(), 'details' => $e->details()]);
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'code' => 'unexpected', 'message' => $e::class.': '.$e->getMessage()]);
} finally {
    DB::select('SELECT pg_advisory_unlock_shared(4242)');
}
