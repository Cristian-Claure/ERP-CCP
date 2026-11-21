<?php

namespace App\Http\Resources\Sales;

use App\Domain\Sales\Models\SalesDocumentLine;
use App\Http\Resources\Inventory\UnitResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalesDocumentLine
 */
class SalesDocumentLineResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $canSeeMargin = (bool) $request->user()?->can('sales.view_margin');

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
            'unit_price' => $this->unit_price,
            'discount_amount' => $this->discount_amount,
            'gross_amount' => $this->gross_amount,
            'global_discount_share' => $this->global_discount_share,
            'total' => $this->total,
            'iva_amount' => $this->iva_amount,
            'net_amount' => $this->net_amount,
            'unit_cost' => $this->when($canSeeMargin, $this->unit_cost),
            'cost_total' => $this->when($canSeeMargin, $this->cost_total),
            'margin' => $this->when($canSeeMargin, $this->margin),
            'notes' => $this->notes,
        ];
    }
}
