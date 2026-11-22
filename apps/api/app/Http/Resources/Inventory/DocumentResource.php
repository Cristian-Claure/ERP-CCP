<?php

namespace App\Http\Resources\Inventory;

use App\Domain\Inventory\Models\InventoryDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InventoryDocument
 */
class DocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
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
            'warehouse' => WarehouseResource::make($this->whenLoaded('warehouse')),
            'destination_warehouse' => WarehouseResource::make($this->whenLoaded('destinationWarehouse')),
            'warehouse_id' => $this->warehouse_id,
            'destination_warehouse_id' => $this->destination_warehouse_id,
            'adjustment_reason' => $this->adjustment_reason?->value,
            'adjustment_reason_label' => $this->adjustment_reason?->label(),
            'reference' => $this->reference,
            // Business document that generated it (e.g. the sale of a SAL-).
            'source' => $this->source_type === null ? null : [
                'type' => $this->source_type,
                'id' => $this->source_id,
                'number' => $this->whenLoaded('source', fn () => $this->source?->number),
            ],
            'notes' => $this->notes,
            'total_cost' => $this->total_cost,
            'lines_count' => $this->whenCounted('lines'),
            'lines' => DocumentLineResource::collection($this->whenLoaded('lines')),
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
