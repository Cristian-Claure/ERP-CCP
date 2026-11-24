<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Inventory\Actions\VoidInventoryDocument;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Purchases\Events\PurchasingChanged;
use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Exceptions\ReceiptInventoryException;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\Models\SupplierPayment;
use App\Domain\Purchases\Services\PurchaseOrderProgress;
use App\Domain\Purchases\Services\SupplierLedger;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Exceptions\DomainException;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentDateWindow;
use Illuminate\Support\Facades\DB;

/**
 * Voids a posted receipt in ONE transaction: no payments applied -> its ENT-
 * through VoidInventoryDocument (rejected when the stock was already
 * consumed or the valuation would become inconsistent: the whole void
 * aborts) -> payable reversal -> OC progress back -> audit.
 *
 * Lock order: supplier -> purchase order -> receipt -> stock balances.
 * Idempotent: voiding a voided receipt returns it unchanged.
 */
class VoidPurchaseReceipt
{
    public const MIN_REASON_LENGTH = 5;

    public function __construct(
        private readonly VoidInventoryDocument $voidInventory,
        private readonly PurchaseOrderProgress $progress,
        private readonly SupplierLedger $ledger,
        private readonly DocumentDateWindow $dates,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(PurchaseReceipt $receipt, User $actor, string $reason): PurchaseReceipt
    {
        if (mb_strlen(trim($reason)) < self::MIN_REASON_LENGTH) {
            throw PurchaseException::with(['reason' => sprintf('El motivo de anulación es obligatorio (mínimo %d caracteres).', self::MIN_REASON_LENGTH)]);
        }

        $result = DB::transaction(function () use ($receipt, $actor, $reason) {
            $supplier = Supplier::query()->lockForUpdate()->findOrFail($receipt->supplier_id);
            $order = PurchaseOrder::query()->lockForUpdate()->findOrFail($receipt->purchase_order_id);
            /** @var PurchaseReceipt $receipt */
            $receipt = PurchaseReceipt::query()->lockForUpdate()->findOrFail($receipt->id);

            if ($receipt->status === PaymentStatus::Voided) {
                return $receipt;
            }
            $this->assertNoPayments($receipt);

            $entry = InventoryDocument::query()->findOrFail($receipt->inventory_document_id);
            try {
                $this->voidInventory->handle($entry, $actor, "Anulación de {$receipt->number}: {$reason}");
            } catch (DomainException $e) {
                throw new ReceiptInventoryException($e, $receipt->number, (string) $entry->number);
            }

            $today = $this->dates->today($supplier->company()->firstOrFail());
            $this->ledger->reverse($supplier, $receipt, $today, sprintf('Anulación de la recepción %s', $receipt->number), $actor->id);
            $this->progress->apply($order, $receipt->load('lines'), -1);

            $receipt->forceFill([
                'status' => PaymentStatus::Voided,
                'voided_by' => $actor->id,
                'voided_at' => now(),
                'void_reason' => trim($reason),
            ])->save();

            $this->audit->log('purchases.receipt.voided', actor: $actor, auditable: $receipt, old: ['status' => 'posted'], new: [
                'status' => 'voided',
                'reason' => $receipt->void_reason,
                'order_status' => $order->status->value,
            ]);

            return $receipt;
        });

        PurchasingChanged::dispatch($result->company_id);

        return $result;
    }

    private function assertNoPayments(PurchaseReceipt $receipt): void
    {
        $numbers = SupplierPayment::query()
            ->where('status', PaymentStatus::Posted)
            ->whereHas('allocations', fn ($q) => $q->where('purchase_receipt_id', $receipt->id))
            ->pluck('number')
            ->all();

        if ($numbers !== []) {
            throw PurchaseException::receiptHasPayments($receipt->number, $numbers);
        }
    }
}
