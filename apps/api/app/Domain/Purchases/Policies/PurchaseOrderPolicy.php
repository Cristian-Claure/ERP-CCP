<?php

namespace App\Domain\Purchases\Policies;

use App\Domain\Purchases\Enums\PurchaseOrderStatus;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Shared\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Approval is decided by ApprovePurchaseOrder (amount threshold and
 * segregation of duties need the order total); here only the entry gate.
 */
class PurchaseOrderPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('purchases.view');
    }

    public function view(User $user, PurchaseOrder $order): bool
    {
        return $user->can('purchases.view');
    }

    public function create(User $user): bool
    {
        return $user->can('purchases.create');
    }

    public function update(User $user, PurchaseOrder $order): Response
    {
        if (! $user->can('purchases.create')) {
            return Response::deny();
        }

        return $order->status === PurchaseOrderStatus::Draft
            ? Response::allow()
            : Response::deny('Solo se editan órdenes en borrador.');
    }

    public function approve(User $user, PurchaseOrder $order): bool
    {
        return $user->can('purchases.create') || $user->can('purchases.approve');
    }

    public function cancel(User $user, PurchaseOrder $order): bool
    {
        return $user->can('purchases.void') || ($order->status === PurchaseOrderStatus::Draft && $user->can('purchases.create'));
    }

    public function receive(User $user, PurchaseOrder $order): bool
    {
        return $user->can('purchases.receive');
    }
}
