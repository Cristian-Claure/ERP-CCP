<?php

namespace App\Http\Resources\Purchases;

use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Purchases\Models\PurchaseOrderLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PurchaseOrder
 */
class PurchaseOrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'order_date' => $this->order_date?->toDateString(),
            'expected_date' => $this->expected_date?->toDateString(),
            'total' => $this->total,
            'reference' => $this->reference,
            'notes' => $this->notes,
            'supplier_id' => $this->supplier_id,
            'supplier' => $this->whenLoaded('supplier', fn () => [
                'id' => $this->supplier->id,
                'name' => $this->supplier->name,
                'tax_id' => $this->supplier->tax_id,
                'issues_invoice' => $this->supplier->issues_invoice,
                'payment_terms_days' => $this->supplier->payment_terms_days,
            ]),
            'warehouse_id' => $this->warehouse_id,
            'warehouse' => $this->whenLoaded('warehouse', fn () => ['id' => $this->warehouse->id, 'name' => $this->warehouse->name]),
            'lines_count' => $this->whenCounted('lines'),
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(fn (PurchaseOrderLine $l) => [
                'id' => $l->id,
                'product_id' => $l->product_id,
                'product' => $l->relationLoaded('product') ? [
                    'id' => $l->product->id,
                    'sku' => $l->product->sku,
                    'name' => $l->product->name,
                    'unit' => $l->product->relationLoaded('unit') ? ['code' => $l->product->unit->code, 'allows_decimals' => $l->product->unit->allows_decimals] : null,
                ] : null,
                'quantity' => $l->quantity,
                'unit_price' => $l->unit_price,
                'line_total' => $l->line_total,
                'received_quantity' => $l->received_quantity,
                'pending_quantity' => (string) $l->pending()->round(4),
            ])->values()),
            'receipts' => $this->whenLoaded('receipts', fn () => $this->receipts->map(fn ($r) => [
                'id' => $r->id,
                'number' => $r->number,
                'status' => $r->status->value,
                'receipt_date' => $r->receipt_date?->toDateString(),
                'supplier_invoice_number' => $r->supplier_invoice_number,
                'invoice_total' => $r->invoice_total,
            ])->values()),
            'created_by' => $this->whenLoaded('creator', fn () => ['id' => $this->creator->id, 'name' => $this->creator->name]),
            'approved_by' => $this->whenLoaded('approver', fn () => $this->approver ? ['id' => $this->approver->id, 'name' => $this->approver->name] : null),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
