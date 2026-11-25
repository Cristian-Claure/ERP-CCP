<?php

namespace App\Domain\Purchases\Policies;

use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Shared\Models\User;

class PurchaseReceiptPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('purchases.view');
    }

    public function view(User $user, PurchaseReceipt $receipt): bool
    {
        return $user->can('purchases.view');
    }

    public function void(User $user, PurchaseReceipt $receipt): bool
    {
        return $user->can('purchases.void');
    }

    /** Invoiced prices, costs and fiscal credit. */
    public function viewCosts(User $user): bool
    {
        return $user->can('purchases.view');
    }
}
