<?php

namespace App\Domain\Shared\Models;

use Database\Factories\CompanyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'legal_name', 'tax_id', 'currency', 'timezone', 'allow_negative_stock', 'document_backdate_days', 'sales_note_vat_breakdown', 'quote_validity_days', 'default_customer_id', 'email', 'phone', 'address', 'is_active'])]
#[UseFactory(CompanyFactory::class)]
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'allow_negative_stock' => 'boolean',
            'document_backdate_days' => 'integer',
            'sales_note_vat_breakdown' => 'boolean',
            'quote_validity_days' => 'integer',
        ];
    }

    /**
     * Members of the company (company_user), regardless of their active company.
     *
     * @return BelongsToMany<User, $this>
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('is_active')
            ->withTimestamps();
    }

    /**
     * Users whose ACTIVE company is this one.
     *
     * @return HasMany<User, $this>
     */
    public function activeUsers(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
