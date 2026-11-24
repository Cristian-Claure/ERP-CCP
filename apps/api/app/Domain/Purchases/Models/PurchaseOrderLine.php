<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Inventory\Models\Product;
use App\Domain\Shared\Support\Decimal;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use BcMath\Number;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** OC line. `received_quantity` is a cache of the posted receipts (suppliers:verify). */
#[Fillable(['company_id', 'purchase_order_id', 'product_id', 'quantity', 'unit_price', 'line_total', 'received_quantity'])]
class PurchaseOrderLine extends Model
{
    use BelongsToCompany;

    protected $attributes = [
        'received_quantity' => '0',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:2',
            'line_total' => 'decimal:2',
            'received_quantity' => 'decimal:4',
        ];
    }

    public function pending(): Number
    {
        $pending = Decimal::of($this->quantity) - Decimal::of($this->received_quantity);

        return $pending < 0 ? new Number('0') : $pending;
    }

    /** @return BelongsTo<PurchaseOrder, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
