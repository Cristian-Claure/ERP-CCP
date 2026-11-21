<?php

namespace App\Domain\Shared\Tenancy;

use App\Domain\Shared\Models\Company;
use Closure;

/**
 * For jobs, commands and seeders. Never call setPermissionsTeamId() by hand
 * outside HTTP: wrap the work in inCompany() / forEachCompany() instead.
 */
trait RunsInCompanyContext
{
    /**
     * @template T
     *
     * @param  Closure(Company): T  $callback
     * @return T
     */
    protected function inCompany(Company|int $company, Closure $callback): mixed
    {
        $model = $company instanceof Company ? $company : Company::query()->findOrFail($company);

        return CompanyContext::run($model->id, fn () => $callback($model));
    }

    /**
     * @param  Closure(Company): void  $callback
     * @param  iterable<Company>|null  $companies  Defaults to every company.
     */
    protected function forEachCompany(Closure $callback, ?iterable $companies = null): void
    {
        foreach ($companies ?? Company::query()->orderBy('id')->lazyById() as $company) {
            $this->inCompany($company, $callback);
        }
    }
}
