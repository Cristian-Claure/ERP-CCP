<?php

namespace App\Domain\Shared\Policies;

use App\Domain\Shared\Models\User;

/**
 * Base policy for user management (endpoints arrive in a later phase).
 * Permissions are already team-scoped to the actor's active company; the
 * target must also be a member of that company.
 */
class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->can('users.manage');
    }

    public function view(User $actor, User $target): bool
    {
        return $actor->id === $target->id
            || ($actor->can('users.manage') && $target->belongsToCompany($actor->company_id));
    }

    public function update(User $actor, User $target): bool
    {
        return $actor->can('users.manage') && $target->belongsToCompany($actor->company_id);
    }
}
