<?php

namespace App\Domain\Inventory\Models;

use App\Domain\Inventory\Enums\MovementKind;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Append-only ledger. The stock of a product in a warehouse is, by definition,
 * the sum of its movements. quantity_after / avg_cost_after / value_after are
 * the running balance right after this movement (kardex).
 */
#[Fillable([
    'company_id', 'product_id', 'warehouse_id', 'document_id', 'document_line_id', 'kind', 'quantity', 'unit_cost',
    'total_cost', 'quantity_after', 'avg_cost_after', 'value_after', 'reverses_movement_id', 'document_date',
    'occurred_at', 'created_by',
])]
class StockMovement extends Model
{
    use BelongsToCompany;

    public const UPDATED_AT = null;

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Stock movements are immutable.'));
        static::deleting(fn () => throw new LogicException('Stock movements are immutable.'));
    }

    protected function casts(): array
    {
        return [
            'kind' => MovementKind::class,
            'quantity' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'total_cost' => 'decimal:4',
            'quantity_after' => 'decimal:4',
            'avg_cost_after' => 'decimal:4',
            'value_after' => 'decimal:4',
            'document_date' => 'date',
            'occurred_at' => 'datetime',
        ];
    }

    public function isReversal(): bool
    {
        return $this->reverses_movement_id !== null;
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

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
