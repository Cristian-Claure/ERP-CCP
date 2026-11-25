<?php

/**
 * Worker for ConcurrentReceiptTest: waits on the advisory-lock barrier and
 * receives the given quantity of the first line of an OC. Prints a JSON result.
 *
 * Usage: php post-receipt.php <orderId> <quantity> <userId> <companyId>
 */

use App\Domain\Purchases\Actions\PostPurchaseReceipt;
use App\Domain\Purchases\Data\ReceiptData;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Shared\Exceptions\DomainException;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../../vendor/autoload.php';
$app = require __DIR__.'/../../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[, $orderId, $quantity, $userId, $companyId] = $argv;

DB::select('SELECT pg_advisory_lock_shared(4242)');

try {
    $number = CompanyContext::run((int) $companyId, function () use ($orderId, $quantity, $userId) {
        $user = User::query()->withoutGlobalScopes()->findOrFail((int) $userId);
        $order = PurchaseOrder::query()->findOrFail((int) $orderId);
        $line = $order->lines()->firstOrFail();

        return app(PostPurchaseReceipt::class)->handle($order, ReceiptData::fromArray([
            'receipt_date' => now($user->company->timezone)->toDateString(),
            'lines' => [['purchase_order_line_id' => $line->id, 'quantity' => $quantity, 'unit_price' => (string) $line->unit_price]],
        ]), $user)->number;
    });
    echo json_encode(['ok' => true, 'number' => $number]);
} catch (DomainException $e) {
    echo json_encode(['ok' => false, 'code' => $e->errorCode(), 'details' => $e->details()]);
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'code' => 'unexpected', 'message' => $e::class.': '.$e->getMessage()]);
} finally {
    DB::select('SELECT pg_advisory_unlock_shared(4242)');
}
