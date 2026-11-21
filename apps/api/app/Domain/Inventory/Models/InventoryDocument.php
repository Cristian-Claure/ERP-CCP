<?php

namespace App\Domain\Inventory\Models;

use App\Domain\Inventory\Enums\AdjustmentReason;
use App\Domain\Inventory\Enums\DocumentStatus;
use App\Domain\Inventory\Enums\DocumentType;
use App\Domain\Inventory\Policies\InventoryDocumentPolicy;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Lifecycle: draft -> posted -> voided. Posted documents are never edited
 * nor deleted; voiding creates reversal movements.
 */
#[Fillable([
    'company_id', 'type', 'status', 'number', 'warehouse_id', 'destination_warehouse_id', 'document_date',
    'adjustment_reason', 'reference', 'source_type', 'source_id', 'notes', 'total_cost', 'idempotency_key', 'created_by',
])]
#[UsePolicy(InventoryDocumentPolicy::class)]
class InventoryDocument extends Model
{
    use BelongsToCompany;

    protected $attributes = [
        'status' => 'draft',
    ];

    protected function casts(): array
    {
        return [
            'type' => DocumentType::class,
            'status' => DocumentStatus::class,
            'adjustment_reason' => AdjustmentReason::class,
            'document_date' => 'date',
            'total_cost' => 'decimal:4',
            'posted_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    public function isDraft(): bool
    {
        return $this->status === DocumentStatus::Draft;
    }

    /**
     * @return HasMany<InventoryDocumentLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(InventoryDocumentLine::class, 'document_id')->orderBy('position')->orderBy('id');
    }

    /**
     * Business document that generated this one (e.g. a sale for its SAL-).
     *
     * @return MorphTo<Model, $this>
     */
    public function source(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return HasMany<StockMovement, $this>
     */
    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class, 'document_id');
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function destinationWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'destination_warehouse_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withoutGlobalScopes();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function poster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by')->withoutGlobalScopes();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by')->withoutGlobalScopes();
    }
}
