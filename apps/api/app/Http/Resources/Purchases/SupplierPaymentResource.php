<?php

namespace App\Http\Resources\Purchases;

use App\Domain\Purchases\Models\SupplierPayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SupplierPayment
 */
class SupplierPaymentResource extends JsonResource
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
            'payment_date' => $this->payment_date?->toDateString(),
            'method' => $this->method->value,
            'method_label' => $this->method->label(),
            'amount' => $this->amount,
            'reference' => $this->reference,
            'notes' => $this->notes,
            'supplier_id' => $this->supplier_id,
            'supplier' => $this->whenLoaded('supplier', fn () => ['id' => $this->supplier->id, 'name' => $this->supplier->name]),
            'allocations' => $this->whenLoaded('allocations', fn () => $this->allocations->map(fn ($a) => [
                'purchase_receipt_id' => $a->purchase_receipt_id,
                'number' => $a->relationLoaded('receipt') ? $a->receipt->number : null,
                'amount' => $a->amount,
            ])->values()),
            'created_by' => $this->whenLoaded('creator', fn () => ['id' => $this->creator->id, 'name' => $this->creator->name]),
            'voided_at' => $this->voided_at?->toIso8601String(),
            'void_reason' => $this->void_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
