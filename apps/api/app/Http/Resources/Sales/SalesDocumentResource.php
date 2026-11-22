<?php

namespace App\Http\Resources\Sales;

use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Support\Decimal;
use App\Http\Resources\Inventory\WarehouseResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Cost and margin fields are omitted without sales.view_margin.
 *
 * @mixin SalesDocument
 */
class SalesDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $canSeeMargin = (bool) $request->user()?->can('sales.view_margin');
        $user = fn (string $relation) => $this->whenLoaded($relation, fn () => $this->{$relation}
            ? ['id' => $this->{$relation}->id, 'name' => $this->{$relation}->name]
            : null);

        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'number' => $this->number,
            'document_date' => $this->document_date->toDateString(),
            'valid_until' => $this->valid_until?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'payment_terms' => $this->payment_terms->value,
            'payment_terms_label' => $this->payment_terms->label(),
            'payment_method' => $this->payment_method?->value,
            'customer_id' => $this->customer_id,
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'document_label' => $this->customer->documentLabel(),
                'city' => $this->customer->city,
                'address' => $this->customer->address,
                'phone' => $this->customer->phone,
                'email' => $this->customer->email,
            ]),
            'warehouse_id' => $this->warehouse_id,
            'warehouse' => WarehouseResource::make($this->whenLoaded('warehouse')),
            'subtotal' => $this->subtotal,
            'line_discount_total' => $this->line_discount_total,
            'global_discount' => $this->global_discount,
            'total' => $this->total,
            'iva_amount' => $this->iva_amount,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'open_amount' => $this->type->isSale() ? Decimal::money($this->openAmount()) : null,
            'cost_total' => $this->when($canSeeMargin, $this->cost_total),
            'margin_total' => $this->when($canSeeMargin, $this->margin_total),
            'quote' => $this->whenLoaded('quote', fn () => $this->quote ? ['id' => $this->quote->id, 'number' => $this->quote->number] : null),
            'conversions' => $this->whenLoaded('conversions', fn () => $this->conversions->map(fn (SalesDocument $c) => [
                'id' => $c->id, 'number' => $c->number, 'type' => $c->type->value, 'status' => $c->status->value,
            ])->values()),
            'inventory_document' => $this->whenLoaded('inventoryDocument', fn () => $this->inventoryDocument
                ? ['id' => $this->inventoryDocument->id, 'number' => $this->inventoryDocument->number, 'status' => $this->inventoryDocument->status->value]
                : null),
            'below_cost_authorization' => $this->below_cost_authorized_by === null ? null : [
                'by' => $user('belowCostAuthorizer'),
                'at' => $this->below_cost_authorized_at?->toIso8601String(),
                'reason' => $this->below_cost_reason,
            ],
            'credit_override' => $this->credit_override_by === null ? null : [
                'by' => $user('creditOverrider'),
                'at' => $this->credit_override_at?->toIso8601String(),
                'reason' => $this->credit_override_reason,
            ],
            'payments' => $this->whenLoaded('allocations', fn () => $this->allocations->map(fn ($a) => [
                'payment_id' => $a->payment_id,
                'number' => $a->payment?->number,
                'date' => $a->payment?->payment_date?->toDateString(),
                'method' => $a->payment?->method?->value,
                'method_label' => $a->payment?->method?->label(),
                'status' => $a->payment?->status?->value,
                'amount' => $a->amount,
            ])->values()),
            'reference' => $this->reference,
            'notes' => $this->notes,
            'lines_count' => $this->whenCounted('lines'),
            'lines' => SalesDocumentLineResource::collection($this->whenLoaded('lines')),
            'created_by' => $user('creator'),
            'posted_by' => $user('poster'),
            'posted_at' => $this->posted_at?->toIso8601String(),
            'voided_by' => $user('voider'),
            'voided_at' => $this->voided_at?->toIso8601String(),
            'void_reason' => $this->void_reason,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
