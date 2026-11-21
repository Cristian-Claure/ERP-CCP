<?php

namespace App\Domain\Sales\Models;

use App\Domain\Sales\Enums\CustomerDocumentType;
use App\Domain\Sales\Enums\CustomerSegment;
use App\Domain\Sales\Enums\PaymentTerms;
use App\Domain\Sales\Policies\CustomerPolicy;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Master data: customers are deactivated, never deleted. `balance` is a
 * derived cache of the customer ledger and is only written by
 * CustomerLedger (under lock).
 */
#[Fillable([
    'company_id', 'document_type', 'document_number', 'complement', 'name', 'email', 'phone', 'address',
    'city', 'department', 'country', 'latitude', 'longitude', 'payment_terms', 'credit_days', 'credit_limit',
    'segment', 'is_active', 'notes',
])]
#[UseFactory(CustomerFactory::class)]
#[UsePolicy(CustomerPolicy::class)]
class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use BelongsToCompany, HasFactory;

    protected $attributes = [
        'complement' => '',
        'country' => 'BO',
        'payment_terms' => 'cash',
        'segment' => 'retail',
        'credit_days' => 0,
        'credit_limit' => '0',
        'balance' => '0',
    ];

    protected function casts(): array
    {
        return [
            'document_type' => CustomerDocumentType::class,
            'payment_terms' => PaymentTerms::class,
            'segment' => CustomerSegment::class,
            'credit_days' => 'integer',
            'credit_limit' => 'decimal:2',
            'balance' => 'decimal:2',
            'latitude' => 'decimal:6',
            'longitude' => 'decimal:6',
            'is_active' => 'boolean',
        ];
    }

    /** "NIT 1234567" / "CI 1234567-1A" */
    public function documentLabel(): string
    {
        $number = $this->document_number.($this->complement !== '' ? '-'.$this->complement : '');

        return $this->document_type->label().' '.$number;
    }

    /**
     * @return HasMany<SalesDocument, $this>
     */
    public function salesDocuments(): HasMany
    {
        return $this->hasMany(SalesDocument::class);
    }

    /**
     * @return HasMany<CustomerLedgerEntry, $this>
     */
    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(CustomerLedgerEntry::class);
    }

    /**
     * @return HasMany<CustomerPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(CustomerPayment::class);
    }
}
