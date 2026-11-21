<?php

namespace App\Domain\Shared;

use App\Domain\Shared\Models\AuditLog;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Models\User;

/**
 * Polymorphic aliases. Every model that can appear in a morph column
 * (audit_logs.auditable_type, model_has_roles.model_type, ...) must be here.
 * Aliases are part of the data contract: never rename one.
 */
final class MorphMap
{
    public const MAP = [
        'user' => User::class,
        'company' => Company::class,
        'audit_log' => AuditLog::class,
    ];
}
