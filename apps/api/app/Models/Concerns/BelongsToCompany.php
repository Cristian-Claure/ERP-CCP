<?php

namespace App\Models\Concerns;

use App\Models\Company;
use App\Models\Scopes\CompanyScope;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Multi-company isolation for any model with a `company_id` column.
 *
 * - Adds a global scope that filters by the current company.
 * - Fills `company_id` automatically on create.
 *
 * Bypass consciously with Model::withoutGlobalScope(CompanyScope::class).
 *
 * @mixin Model
 */
trait BelongsToCompany
{
    public static function bootBelongsToCompany(): void
    {
        static::addGlobalScope(new CompanyScope);

        static::creating(function (Model $model): void {
            if (empty($model->getAttribute('company_id'))) {
                $model->setAttribute('company_id', app(CurrentCompany::class)->id());
            }
        });
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
