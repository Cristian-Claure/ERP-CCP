<?php

namespace App\Domain\Sales\Policies;

use App\Domain\Sales\Models\Customer;
use App\Domain\Shared\Models\User;

class CustomerPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('customers.view');
    }

    public function view(User $user, Customer $customer): bool
    {
        return $user->can('customers.view');
    }

    public function create(User $user): bool
    {
        return $user->can('customers.manage');
    }

    public function update(User $user, Customer $customer): bool
    {
        return $user->can('customers.manage');
    }

    /** Statement, aging and balances. */
    public function viewReceivables(User $user, ?Customer $customer = null): bool
    {
        return $user->can('receivables.view');
    }
}
