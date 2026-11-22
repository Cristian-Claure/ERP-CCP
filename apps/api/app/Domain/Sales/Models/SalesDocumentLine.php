<?php

namespace App\Domain\Sales\Models;

use App\Domain\Inventory\Models\Product;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'company_id', 'document_id', 'product_id', 'position', 'quantity', 'unit_price', 'discount_amount',
    'gross_amount', 'global_discount_share', 'total', 'iva_amount', 'net_amount', 'notes',
])]
class SalesDocumentLine extends Model
{
    use BelongsToCompany;

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'gross_amount' => 'decimal:2',
            'global_discount_share' => 'decimal:2',
            'total' => 'decimal:2',
            'iva_amount' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'unit_cost' => 'decimal:4',
            'cost_total' => 'decimal:2',
            'margin' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<SalesDocument, $this>
     */
    public function document(): BelongsTo
    {
        return $this->belongsTo(SalesDocument::class, 'document_id');
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
