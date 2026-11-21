<?php

namespace App\Domain\Inventory\Policies;

use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Shared\Models\User;
use Illuminate\Auth\Access\Response;

class InventoryDocumentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('inventory.view');
    }

    public function view(User $user, InventoryDocument $document): bool
    {
        return $user->can('inventory.view');
    }

    public function create(User $user): bool
    {
        return $user->can('movements.create');
    }

    public function update(User $user, InventoryDocument $document): Response
    {
        if (! $user->can('movements.create')) {
            return Response::deny();
        }

        return $document->isDraft()
            ? Response::allow()
            : Response::deny('Solo se pueden editar documentos en borrador.');
    }

    public function delete(User $user, InventoryDocument $document): Response
    {
        return $this->update($user, $document);
    }

    public function post(User $user, InventoryDocument $document): bool
    {
        return $user->can('movements.post');
    }

    public function void(User $user, InventoryDocument $document): bool
    {
        return $user->can('movements.void');
    }
}
