<?php

namespace App\Domain\Shared\Tenancy;

use Closure;

/**
 * Runs code "as" a company outside HTTP (jobs, commands, seeders, tests):
 * sets the tenant scope (CurrentCompany) and the spatie permission team,
 * then restores the previous context even if the callback throws.
 */
final class CompanyContext
{
    /**
     * @template T
     *
     * @param  Closure(): T  $callback
     * @return T
     */
    public static function run(int $companyId, Closure $callback): mixed
    {
        $current = app(CurrentCompany::class);
        $previousCompany = $current->overrideId();
        $previousTeam = getPermissionsTeamId();

        $current->set($companyId);
        setPermissionsTeamId($companyId);

        try {
            return $callback();
        } finally {
            $current->set($previousCompany);
            setPermissionsTeamId($previousTeam);
        }
    }
}
