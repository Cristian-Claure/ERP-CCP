<?php

namespace App\Http\Resources\Inventory;

use App\Domain\Inventory\Models\StockMovement;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One kardex line: both dates (posting and document), in/out split, cost
 * and the running balance after the movement.
 *
 * @mixin StockMovement
 */
class KardexEntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $quantity = new Number($this->quantity);
        $isIn = $quantity > 0;

        return [
            'id' => $this->id,
            'posted_at' => $this->occurred_at->toIso8601String(),
            'document_date' => $this->document_date->toDateString(),
            'document' => $this->whenLoaded('document', fn () => [
                'id' => $this->document->id,
                'number' => $this->document->number,
                'type' => $this->document->type->value,
                'type_label' => $this->document->type->label(),
                'status' => $this->document->status->value,
            ]),
            'kind' => $this->kind->value,
            'kind_label' => ($this->isReversal() ? 'Anulación · ' : '').$this->kind->label(),
            'is_reversal' => $this->isReversal(),
            'quantity_in' => $isIn ? (string) $quantity : null,
            'quantity_out' => $isIn ? null : (string) Decimal::abs($quantity),
            'unit_cost' => $this->unit_cost,
            'total_cost' => (string) Decimal::abs(new Number($this->total_cost)),
            'quantity_after' => $this->quantity_after,
            'avg_cost_after' => $this->avg_cost_after,
            'value_after' => $this->value_after,
        ];
    }
}
