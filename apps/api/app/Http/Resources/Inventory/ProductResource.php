<?php

namespace App\Http\Resources\Inventory;

use App\Domain\Inventory\Models\Product;
use BcMath\Number;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hasStock = array_key_exists('stock_quantity', $this->resource->getAttributes());

        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'description' => $this->description,
            'min_stock' => $this->min_stock,
            'is_active' => $this->is_active,
            'unit' => UnitResource::make($this->whenLoaded('unit')),
            'category' => CategoryResource::make($this->whenLoaded('category')),
            'stock' => $this->when($hasStock, function () {
                $quantity = (new Number((string) $this->resource->getAttribute('stock_quantity')))->round(4);
                $minStock = new Number((string) $this->min_stock);

                return [
                    'quantity' => (string) $quantity,
                    'value' => (string) (new Number((string) $this->resource->getAttribute('stock_value')))->round(4),
                    'below_min' => $minStock > 0 && $quantity < $minStock,
                ];
            }),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
