<?php

namespace App\Http\Resources\Inventory;

use App\Domain\Inventory\Models\InventoryDocumentLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InventoryDocumentLine
 */
class DocumentLineResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'position' => $this->position,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
                'unit' => $this->product->relationLoaded('unit') ? UnitResource::make($this->product->unit) : null,
            ]),
            'quantity' => $this->quantity,
            'counted_quantity' => $this->counted_quantity,
            'system_quantity' => $this->system_quantity,
            'unit_cost' => $this->unit_cost,
            'total_cost' => $this->total_cost,
            'notes' => $this->notes,
        ];
    }
}
