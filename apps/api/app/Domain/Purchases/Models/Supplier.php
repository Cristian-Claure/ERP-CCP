<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Purchases\Policies\SupplierPolicy;
use App\Domain\Shared\Tenancy\BelongsToCompany;
use Database\Factories\SupplierFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Supplier. `balance` is a derived cache of the supplier ledger (what we owe),
 * written only by SupplierLedger; `issues_invoice` decides whether the VAT of
 * its invoices is crédito fiscal (ADR 0006).
 */
#[Fillable([
    'company_id', 'tax_id', 'name', 'contact_name', 'email', 'phone', 'address', 'country', 'city', 'latitude',
    'longitude', 'payment_terms_days', 'lead_time_days', 'issues_invoice', 'is_active', 'notes',
])]
#[UsePolicy(SupplierPolicy::class)]
#[UseFactory(SupplierFactory::class)]
class Supplier extends Model
{
    use BelongsToCompany, HasFactory;

    protected $attributes = [
        'balance' => '0.00',
    ];

    protected function casts(): array
    {
        return [
            'issues_invoice' => 'boolean',
            'is_active' => 'boolean',
            'payment_terms_days' => 'integer',
            'lead_time_days' => 'integer',
            'balance' => 'decimal:2',
            'latitude' => 'decimal:6',
            'longitude' => 'decimal:6',
        ];
    }

    /**
     * @return HasMany<PurchaseOrder, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    /**
     * @return HasMany<PurchaseReceipt, $this>
     */
    public function receipts(): HasMany
    {
        return $this->hasMany(PurchaseReceipt::class);
    }
}
