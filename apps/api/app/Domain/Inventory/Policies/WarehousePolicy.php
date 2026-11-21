<?php

namespace App\Domain\Inventory\Policies;

use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Shared\Models\User;

/** Warehouses, categories and units are catalog data: managed with products.manage. */
class WarehousePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('inventory.view');
    }

    public function create(User $user): bool
    {
        return $user->can('products.manage');
    }

    public function update(User $user, Warehouse $warehouse): bool
    {
        return $user->can('products.manage');
    }
}
