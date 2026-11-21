<?php

namespace App\Domain\Sales\Policies;

use App\Domain\Sales\Models\CustomerPayment;
use App\Domain\Shared\Models\User;

class CustomerPaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('receivables.view');
    }

    public function view(User $user, CustomerPayment $payment): bool
    {
        return $user->can('receivables.view');
    }

    public function create(User $user): bool
    {
        return $user->can('receivables.collect');
    }

    public function void(User $user, CustomerPayment $payment): bool
    {
        return $user->can('receivables.void');
    }
}
