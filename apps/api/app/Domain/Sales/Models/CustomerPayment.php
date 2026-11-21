<?php

namespace App\Domain\Sales\Models;

use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Sales\Policies\CustomerPaymentPolicy;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Receipt (COB-). Posted on creation; voided, never deleted. When
 * sales_document_id is set it is the automatic receipt of a cash sale and
 * it is voided together with that sale.
 */
#[Fillable([
    'company_id', 'customer_id', 'number', 'status', 'payment_date', 'method', 'amount', 'reference', 'notes',
    'sales_document_id', 'idempotency_key', 'created_by',
])]
#[UsePolicy(CustomerPaymentPolicy::class)]
class CustomerPayment extends Model
{
    use BelongsToCompany;

    protected $attributes = [
        'status' => 'posted',
    ];

    protected function casts(): array
    {
        return [
            'status' => PaymentStatus::class,
            'method' => PaymentMethod::class,
            'payment_date' => 'date',
            'amount' => 'decimal:2',
            'voided_at' => 'datetime',
        ];
    }

    public function isAutomatic(): bool
    {
        return $this->sales_document_id !== null;
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * @return HasMany<PaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class, 'payment_id');
    }

    /**
     * @return BelongsTo<SalesDocument, $this>
     */
    public function salesDocument(): BelongsTo
    {
        return $this->belongsTo(SalesDocument::class);
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
    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by')->withoutGlobalScopes();
    }
}
