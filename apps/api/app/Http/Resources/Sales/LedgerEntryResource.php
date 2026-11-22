<?php

namespace App\Http\Resources\Sales;

use App\Domain\Sales\Models\CustomerLedgerEntry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CustomerLedgerEntry
 */
class LedgerEntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $amount = (string) $this->amount;

        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'kind_label' => $this->kind->label(),
            'entry_date' => $this->entry_date->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'description' => $this->description,
            'debit' => bccomp($amount, '0', 2) > 0 ? $amount : null,   // increases the debt
            'credit' => bccomp($amount, '0', 2) < 0 ? ltrim($amount, '-') : null,
            'amount' => $amount,
            'balance_after' => $this->balance_after,
            'source_type' => $this->source_type,
            'source_id' => $this->source_id,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
