<?php

namespace App\Http\Resources\Purchases;

use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Purchases\Models\PurchaseReceiptLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PurchaseReceipt
 */
class PurchaseReceiptResource extends JsonResource
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
            'receipt_date' => $this->receipt_date?->toDateString(),
            'supplier_invoice_number' => $this->supplier_invoice_number,
            'supplier_invoice_date' => $this->supplier_invoice_date?->toDateString(),
            'issues_invoice' => $this->issues_invoice,
            'invoice_total' => $this->invoice_total,
            'vat_credit' => $this->vat_credit,
            'net_total' => $this->net_total,
            'additional_costs_total' => $this->additional_costs_total,
            'cost_total' => $this->cost_total,
            'due_date' => $this->due_date?->toDateString(),
            'paid_amount' => $this->paid_amount,
            'open_amount' => (string) $this->openAmount()->round(2),
            'price_variance_reason' => $this->price_variance_reason,
            'notes' => $this->notes,
            'purchase_order_id' => $this->purchase_order_id,
            'order' => $this->whenLoaded('order', fn () => ['id' => $this->order->id, 'number' => $this->order->number]),
            'supplier_id' => $this->supplier_id,
            'supplier' => $this->whenLoaded('supplier', fn () => ['id' => $this->supplier->id, 'name' => $this->supplier->name]),
            'warehouse' => $this->whenLoaded('warehouse', fn () => ['id' => $this->warehouse->id, 'name' => $this->warehouse->name]),
            'inventory_document' => $this->whenLoaded('inventoryDocument', fn () => $this->inventoryDocument
                ? ['id' => $this->inventoryDocument->id, 'number' => $this->inventoryDocument->number] : null),
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(fn (PurchaseReceiptLine $l) => [
                'id' => $l->id,
                'product' => $l->relationLoaded('product') ? ['id' => $l->product->id, 'sku' => $l->product->sku, 'name' => $l->product->name] : null,
                'quantity' => $l->quantity,
                'unit_price' => $l->unit_price,
                'order_unit_price' => $l->order_unit_price,
                'price_variance_pct' => $l->price_variance_pct,
                'price_variance_flag' => $l->price_variance_flag,
                'line_total' => $l->line_total,
                'vat' => $l->vat,
                'net' => $l->net,
                'additional_cost' => $l->additional_cost,
                'cost_total' => $l->cost_total,
                'unit_cost' => $l->unit_cost,
            ])->values()),
            'costs' => $this->whenLoaded('costs', fn () => $this->costs->map(fn ($c) => [
                'kind' => $c->kind->value, 'kind_label' => $c->kind->label(), 'description' => $c->description, 'amount' => $c->amount,
            ])->values()),
            'created_by' => $this->whenLoaded('creator', fn () => ['id' => $this->creator->id, 'name' => $this->creator->name]),
            'voided_by' => $this->whenLoaded('voider', fn () => $this->voider ? ['id' => $this->voider->id, 'name' => $this->voider->name] : null),
            'voided_at' => $this->voided_at?->toIso8601String(),
            'void_reason' => $this->void_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
