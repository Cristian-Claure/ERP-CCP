<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Inventory\Models\Product;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'company_id', 'purchase_receipt_id', 'purchase_order_line_id', 'product_id', 'quantity', 'unit_price',
    'order_unit_price', 'price_variance_pct', 'price_variance_flag', 'line_total', 'vat', 'net', 'additional_cost',
    'cost_total', 'unit_cost',
])]
class PurchaseReceiptLine extends Model
{
    use BelongsToCompany;

    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:2',
            'order_unit_price' => 'decimal:2',
            'price_variance_pct' => 'decimal:2',
            'price_variance_flag' => 'boolean',
            'line_total' => 'decimal:2',
            'vat' => 'decimal:2',
            'net' => 'decimal:2',
            'additional_cost' => 'decimal:2',
            'cost_total' => 'decimal:2',
            'unit_cost' => 'decimal:4',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<PurchaseOrderLine, $this> */
    public function orderLine(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderLine::class, 'purchase_order_line_id');
    }
}
