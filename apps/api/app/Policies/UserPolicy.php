<?php

namespace App\Policies;

use App\Models\User;

/**
 * Base policy for user management (endpoints arrive in a later phase).
 * Always checks permission AND same company.
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
            || ($actor->can('users.manage') && $actor->company_id === $target->company_id);
    }

    public function update(User $actor, User $target): bool
    {
        return $actor->can('users.manage') && $actor->company_id === $target->company_id;
    }
}
