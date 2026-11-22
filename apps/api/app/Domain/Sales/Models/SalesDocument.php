<?php

namespace App\Domain\Sales\Models;

use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\PaymentTerms;
use App\Domain\Sales\Enums\SalesDocumentStatus;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Policies\SalesDocumentPolicy;
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
 * Quote (COT-), invoice (VTA-) or sales note (NV-).
 * Lifecycle: draft -> posted -> voided. Posted documents are never edited
 * nor deleted; voiding reverses their stock exit and their receivable.
 */
#[Fillable([
    'company_id', 'type', 'status', 'customer_id', 'warehouse_id', 'document_date', 'valid_until', 'payment_terms',
    'due_date', 'payment_method', 'subtotal', 'line_discount_total', 'global_discount', 'total', 'iva_amount',
    'net_amount', 'quote_id', 'reference', 'notes', 'idempotency_key', 'created_by',
])]
#[UsePolicy(SalesDocumentPolicy::class)]
class SalesDocument extends Model
{
    use BelongsToCompany;

    protected $attributes = [
        'status' => 'draft',
        'payment_terms' => 'cash',
    ];

    protected function casts(): array
    {
        return [
            'type' => SalesDocumentType::class,
            'status' => SalesDocumentStatus::class,
            'payment_terms' => PaymentTerms::class,
            'payment_method' => PaymentMethod::class,
            'document_date' => 'date',
            'valid_until' => 'date',
            'due_date' => 'date',
            'subtotal' => 'decimal:2',
            'line_discount_total' => 'decimal:2',
            'global_discount' => 'decimal:2',
            'total' => 'decimal:2',
            'iva_amount' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'cost_total' => 'decimal:2',
            'margin_total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'posted_at' => 'datetime',
            'voided_at' => 'datetime',
            'below_cost_authorized_at' => 'datetime',
            'credit_override_at' => 'datetime',
        ];
    }

    public function isDraft(): bool
    {
        return $this->status === SalesDocumentStatus::Draft;
    }

    public function isPosted(): bool
    {
        return $this->status === SalesDocumentStatus::Posted;
    }

    public function openAmount(): Number
    {
        return Decimal::of($this->total) - Decimal::of($this->paid_amount);
    }

    /**
     * @return HasMany<SalesDocumentLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(SalesDocumentLine::class, 'document_id')->orderBy('position')->orderBy('id');
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * The SAL- generated on posting (two-way link: inventory_documents.source).
     *
     * @return BelongsTo<InventoryDocument, $this>
     */
    public function inventoryDocument(): BelongsTo
    {
        return $this->belongsTo(InventoryDocument::class);
    }

    /**
     * @return BelongsTo<SalesDocument, $this>
     */
    public function quote(): BelongsTo
    {
        return $this->belongsTo(SalesDocument::class, 'quote_id');
    }

    /**
     * Sales created from this quote.
     *
     * @return HasMany<SalesDocument, $this>
     */
    public function conversions(): HasMany
    {
        return $this->hasMany(SalesDocument::class, 'quote_id');
    }

    /**
     * @return HasMany<PaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
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

    /**
     * @return BelongsTo<User, $this>
     */
    public function belowCostAuthorizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'below_cost_authorized_by')->withoutGlobalScopes();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creditOverrider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'credit_override_by')->withoutGlobalScopes();
    }
}
