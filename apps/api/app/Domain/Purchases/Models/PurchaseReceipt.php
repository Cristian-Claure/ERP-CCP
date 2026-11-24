<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Purchases\Policies\PurchaseReceiptPolicy;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Support\Decimal;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use BcMath\Number;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Receipt of goods (REC-) that doubles as the supplier invoice in this phase
 * (ADR 0006). Posted on creation with its ENT-; voided, never deleted.
 * `paid_amount` is a cache of the posted payment allocations.
 */
#[Fillable([
    'company_id', 'purchase_order_id', 'supplier_id', 'warehouse_id', 'number', 'status', 'receipt_date',
    'supplier_invoice_number', 'supplier_invoice_date', 'issues_invoice', 'invoice_total', 'vat_credit', 'net_total',
    'additional_costs_total', 'cost_total', 'due_date', 'price_variance_reason', 'notes', 'idempotency_key', 'created_by',
])]
#[UsePolicy(PurchaseReceiptPolicy::class)]
class PurchaseReceipt extends Model
{
    use BelongsToCompany;

    protected $attributes = [
        'status' => 'posted',
        'paid_amount' => '0.00',
    ];

    protected function casts(): array
    {
        return [
            'status' => PaymentStatus::class, // posted | voided
            'receipt_date' => 'date',
            'supplier_invoice_date' => 'date',
            'due_date' => 'date',
            'issues_invoice' => 'boolean',
            'invoice_total' => 'decimal:2',
            'vat_credit' => 'decimal:2',
            'net_total' => 'decimal:2',
            'additional_costs_total' => 'decimal:2',
            'cost_total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'voided_at' => 'datetime',
        ];
    }

    public function openAmount(): Number
    {
        return Decimal::of($this->invoice_total) - Decimal::of($this->paid_amount);
    }

    /** @return BelongsTo<PurchaseOrder, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
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

    /** @return HasMany<PurchaseReceiptLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseReceiptLine::class)->orderBy('id');
    }

    /** @return HasMany<PurchaseReceiptCost, $this> */
    public function costs(): HasMany
    {
        return $this->hasMany(PurchaseReceiptCost::class)->orderBy('id');
    }

    /** @return HasMany<SupplierPaymentAllocation, $this> */
    public function allocations(): HasMany
    {
        return $this->hasMany(SupplierPaymentAllocation::class);
    }

    /** @return BelongsTo<InventoryDocument, $this> */
    public function inventoryDocument(): BelongsTo
    {
        return $this->belongsTo(InventoryDocument::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withoutGlobalScopes();
    }

    /** @return BelongsTo<User, $this> */
    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by')->withoutGlobalScopes();
    }
}
