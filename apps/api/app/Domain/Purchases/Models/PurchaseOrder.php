<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Purchases\Enums\PurchaseOrderStatus;
use App\Domain\Purchases\Policies\PurchaseOrderPolicy;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Purchase order (OC-): draft -> approved -> partially_received -> received,
 * or cancelled. The number is assigned on approval. Never deleted.
 */
#[Fillable([
    'company_id', 'supplier_id', 'warehouse_id', 'status', 'order_date', 'expected_date', 'total', 'reference',
    'notes', 'idempotency_key', 'created_by',
])]
#[UsePolicy(PurchaseOrderPolicy::class)]
class PurchaseOrder extends Model
{
    use BelongsToCompany;

    protected $attributes = [
        'status' => 'draft',
        'total' => '0.00',
    ];

    protected function casts(): array
    {
        return [
            'status' => PurchaseOrderStatus::class,
            'order_date' => 'date',
            'expected_date' => 'date',
            'total' => 'decimal:2',
            'approved_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Supplier, $this> */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return HasMany<PurchaseOrderLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseOrderLine::class)->orderBy('id');
    }

    /** @return HasMany<PurchaseReceipt, $this> */
    public function receipts(): HasMany
    {
        return $this->hasMany(PurchaseReceipt::class)->orderBy('id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withoutGlobalScopes();
    }

    /** @return BelongsTo<User, $this> */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by')->withoutGlobalScopes();
    }

    /** @return BelongsTo<User, $this> */
    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by')->withoutGlobalScopes();
    }
}
