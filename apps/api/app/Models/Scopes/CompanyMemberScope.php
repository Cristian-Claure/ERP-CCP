<?php

namespace App\Models\Scopes;

use App\Support\Tenancy\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Users are tenant-scoped by *membership* (company_user), not by their
 * active company, so a user who belongs to several companies is visible
 * in each of them.
 */
class CompanyMemberScope implements Scope
{
    /**
     * @param  Builder<Model>  $builder
     */
    public function apply(Builder $builder, Model $model): void
    {
        $companyId = app(CurrentCompany::class)->id();

        if ($companyId === null) {
            return;
        }

        $builder->whereExists(function ($query) use ($companyId, $model) {
            $query->selectRaw('1')
                ->from('company_user')
                ->whereColumn('company_user.user_id', $model->qualifyColumn('id'))
                ->where('company_user.company_id', $companyId)
                ->where('company_user.is_active', true);
        });
    }
}
