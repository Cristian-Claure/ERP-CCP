<?php

namespace App\Domain\Purchases\Services;

use App\Domain\Purchases\Enums\PurchaseOrderStatus;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Purchases\Models\PurchaseOrderLine;
use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Shared\Support\Decimal;

/**
 * Keeps the OC received quantities (cache, see suppliers:verify) and its status
 * in sync with a receipt being posted (+1) or voided (−1). The caller holds the
 * OC lock.
 */
class PurchaseOrderProgress
{
    public function apply(PurchaseOrder $order, PurchaseReceipt $receipt, int $sign): void
    {
        $lines = PurchaseOrderLine::query()->where('purchase_order_id', $order->id)->lockForUpdate()->get()->keyBy('id');

        foreach ($receipt->lines as $receiptLine) {
            $line = $lines[$receiptLine->purchase_order_line_id];
            $received = Decimal::of($line->received_quantity) + Decimal::of($receiptLine->quantity) * $sign;
            $line->forceFill(['received_quantity' => (string) $received->round(4)])->save();
        }

        $anyReceived = $lines->contains(fn (PurchaseOrderLine $l) => Decimal::of($l->received_quantity) > 0);
        $allReceived = $lines->every(fn (PurchaseOrderLine $l) => Decimal::of($l->received_quantity) >= Decimal::of($l->quantity));

        $order->forceFill(['status' => match (true) {
            $allReceived => PurchaseOrderStatus::Received,
            $anyReceived => PurchaseOrderStatus::PartiallyReceived,
            default => PurchaseOrderStatus::Approved,
        }])->save();
    }
}
