<?php

namespace App\Http\Resources\Sales;

use App\Domain\Sales\Models\CustomerPayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CustomerPayment
 */
class PaymentResource extends JsonResource
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
            'payment_date' => $this->payment_date->toDateString(),
            'method' => $this->method->value,
            'method_label' => $this->method->label(),
            'amount' => $this->amount,
            'reference' => $this->reference,
            'notes' => $this->notes,
            'is_automatic' => $this->isAutomatic(),
            'customer_id' => $this->customer_id,
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'document_label' => $this->customer->documentLabel(),
            ]),
            'allocations' => $this->whenLoaded('allocations', fn () => $this->allocations->map(fn ($a) => [
                'sales_document_id' => $a->sales_document_id,
                'number' => $a->relationLoaded('salesDocument') ? $a->salesDocument?->number : null,
                'amount' => $a->amount,
            ])->values()),
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator ? ['id' => $this->creator->id, 'name' => $this->creator->name] : null),
            'voided_at' => $this->voided_at?->toIso8601String(),
            'void_reason' => $this->void_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
