<?php

namespace App\Domain\Purchases\Policies;

use App\Domain\Purchases\Models\Supplier;
use App\Domain\Shared\Models\User;

class SupplierPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('suppliers.view');
    }

    public function view(User $user, Supplier $supplier): bool
    {
        return $user->can('suppliers.view');
    }

    public function create(User $user): bool
    {
        return $user->can('suppliers.manage');
    }

    public function update(User $user, Supplier $supplier): bool
    {
        return $user->can('suppliers.manage');
    }

    /** Balances, aging and statements (accounts payable). */
    public function viewPayables(User $user, ?Supplier $supplier = null): bool
    {
        return $user->can('payables.view');
    }
}
