<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Purchases\Enums\PurchaseOrderStatus;
use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Cancels a draft or approved OC without posted receipts (an OC with goods
 * received keeps its history: void the receipts first). Never deleted.
 */
class CancelPurchaseOrder
{
    public const MIN_REASON_LENGTH = 5;

    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(PurchaseOrder $order, User $actor, string $reason): PurchaseOrder
    {
        if (mb_strlen(trim($reason)) < self::MIN_REASON_LENGTH) {
            throw PurchaseException::with(['reason' => sprintf('El motivo es obligatorio (mínimo %d caracteres).', self::MIN_REASON_LENGTH)]);
        }

        return DB::transaction(function () use ($order, $actor, $reason) {
            /** @var PurchaseOrder $order */
            $order = PurchaseOrder::query()->lockForUpdate()->findOrFail($order->id);

            if ($order->status === PurchaseOrderStatus::Cancelled) {
                return $order;
            }
            $hasReceipts = PurchaseReceipt::query()->where('purchase_order_id', $order->id)
                ->where('status', PaymentStatus::Posted)->exists();
            if (! in_array($order->status, [PurchaseOrderStatus::Draft, PurchaseOrderStatus::Approved], true) || $hasReceipts) {
                throw PurchaseException::state('Solo se cancelan órdenes sin recepciones confirmadas. Anula primero las recepciones.');
            }

            $old = $order->status->value;
            $order->forceFill([
                'status' => PurchaseOrderStatus::Cancelled,
                'cancelled_by' => $actor->id,
                'cancelled_at' => now(),
                'cancel_reason' => trim($reason),
            ])->save();

            $this->audit->log('purchases.order.cancelled', actor: $actor, auditable: $order, old: ['status' => $old], new: [
                'status' => $order->status->value,
                'reason' => $order->cancel_reason,
            ]);

            return $order;
        });
    }
}
