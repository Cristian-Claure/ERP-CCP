<?php

namespace App\Domain\Inventory\Models;

use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'company_id', 'document_id', 'product_id', 'position', 'quantity', 'counted_quantity', 'system_quantity',
    'unit_cost', 'total_cost', 'notes',
])]
class InventoryDocumentLine extends Model
{
    use BelongsToCompany;

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'counted_quantity' => 'decimal:4',
            'system_quantity' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'total_cost' => 'decimal:4',
        ];
    }

    /**
     * @return BelongsTo<InventoryDocument, $this>
     */
    public function document(): BelongsTo
    {
        return $this->belongsTo(InventoryDocument::class, 'document_id');
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
