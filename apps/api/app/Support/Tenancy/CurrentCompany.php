<?php

namespace App\Support\Tenancy;

use Illuminate\Support\Facades\Auth;

/**
 * Resolves the company the current request (or job) operates on.
 *
 * - HTTP: the authenticated user's company.
 * - Jobs / console: set explicitly with set(), or null (no tenant filter).
 *
 * Registered as a scoped binding: reset on every request / job.
 */
class CurrentCompany
{
    private ?int $override = null;

    public function id(): ?int
    {
        if ($this->override !== null) {
            return $this->override;
        }

        // hasUser() avoids resolving the user here, which would query `users`
        // (itself company scoped) and recurse.
        if (Auth::hasUser()) {
            return Auth::user()?->company_id;
        }

        return null;
    }

    public function set(?int $companyId): void
    {
        $this->override = $companyId;
    }
}
