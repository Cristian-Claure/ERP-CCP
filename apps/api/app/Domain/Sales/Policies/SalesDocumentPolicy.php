<?php

namespace App\Domain\Sales\Policies;

use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Models\User;
use Illuminate\Auth\Access\Response;

class SalesDocumentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('sales.view');
    }

    public function view(User $user, SalesDocument $document): bool
    {
        return $user->can('sales.view');
    }

    public function create(User $user): bool
    {
        return $user->can('sales.create');
    }

    public function update(User $user, SalesDocument $document): Response
    {
        if (! $user->can('sales.create')) {
            return Response::deny();
        }

        return $document->isDraft()
            ? Response::allow()
            : Response::deny('Solo se pueden editar documentos en borrador.');
    }

    public function delete(User $user, SalesDocument $document): Response
    {
        return $this->update($user, $document);
    }

    public function post(User $user, SalesDocument $document): bool
    {
        return $user->can('sales.post');
    }

    public function void(User $user, SalesDocument $document): bool
    {
        return $user->can('sales.void');
    }

    /** Costs and margins (Resources omit them without this permission). */
    public function viewMargin(User $user): bool
    {
        return $user->can('sales.view_margin');
    }
}
