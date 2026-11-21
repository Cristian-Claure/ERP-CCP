<?php

namespace App\Domain\Inventory\Models;

use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Materialized balance per product and warehouse. A derived cache of
 * stock_movements: only StockLedger writes it (inside a locked transaction),
 * and `inventory:verify --repair` can rebuild it from the ledger.
 */
#[Fillable(['company_id', 'product_id', 'warehouse_id', 'quantity', 'avg_cost', 'total_value', 'last_movement_id'])]
class StockBalance extends Model
{
    use BelongsToCompany;

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'avg_cost' => 'decimal:4',
            'total_value' => 'decimal:4',
        ];
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
