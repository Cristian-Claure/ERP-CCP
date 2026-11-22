<?php

/**
 * Worker for ConcurrentCreditLimitTest: waits on the advisory-lock barrier
 * and posts the given sales document. Prints a JSON result.
 *
 * Usage: php post-sale.php <salesDocumentId> <userId> <companyId>
 */

use App\Domain\Sales\Actions\PostSalesDocument;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Exceptions\DomainException;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../../vendor/autoload.php';
$app = require __DIR__.'/../../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[, $documentId, $userId, $companyId] = $argv;

DB::select('SELECT pg_advisory_lock_shared(4242)');

try {
    $number = CompanyContext::run((int) $companyId, function () use ($documentId, $userId) {
        $user = User::query()->withoutGlobalScopes()->findOrFail((int) $userId);
        $document = SalesDocument::query()->findOrFail((int) $documentId);

        return app(PostSalesDocument::class)->handle($document, $user)->number;
    });
    echo json_encode(['ok' => true, 'number' => $number]);
} catch (DomainException $e) {
    echo json_encode(['ok' => false, 'code' => $e->errorCode(), 'details' => $e->details()]);
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'code' => 'unexpected', 'message' => $e::class.': '.$e->getMessage()]);
} finally {
    DB::select('SELECT pg_advisory_unlock_shared(4242)');
}
