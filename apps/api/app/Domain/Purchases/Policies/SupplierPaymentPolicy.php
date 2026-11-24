<?php

namespace App\Domain\Purchases\Policies;

use App\Domain\Purchases\Models\SupplierPayment;
use App\Domain\Shared\Models\User;

class SupplierPaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('payables.view');
    }

    public function view(User $user, SupplierPayment $payment): bool
    {
        return $user->can('payables.view');
    }

    public function create(User $user): bool
    {
        return $user->can('payables.pay');
    }

    public function void(User $user, SupplierPayment $payment): bool
    {
        return $user->can('payables.pay') && $user->can('purchases.void');
    }
}
