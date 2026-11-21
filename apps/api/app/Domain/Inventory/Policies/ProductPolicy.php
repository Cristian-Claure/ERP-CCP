<?php

namespace App\Domain\Inventory\Policies;

use App\Domain\Inventory\Models\Product;
use App\Domain\Shared\Models\User;

/**
 * Tenant isolation comes from BelongsToCompany (route model binding never
 * resolves another company's product); policies only check permissions.
 */
class ProductPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('inventory.view');
    }

    public function view(User $user, Product $product): bool
    {
        return $user->can('inventory.view');
    }

    public function create(User $user): bool
    {
        return $user->can('products.manage');
    }

    public function update(User $user, Product $product): bool
    {
        return $user->can('products.manage');
    }
}
