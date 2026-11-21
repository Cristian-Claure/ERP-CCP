<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Runs after auth:sanctum. Validates that the user's active company is one of
 * their memberships and scopes spatie roles/permissions (teams) to it.
 */
class ResolveActiveCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user !== null) {
            if ($user->company_id === null || ! $user->belongsToCompany($user->company_id)) {
                throw new AccessDeniedHttpException('El usuario no pertenece a la empresa activa.');
            }

            setPermissionsTeamId($user->company_id);

            // Roles may have been loaded before the team was set.
            $user->unsetRelation('roles')->unsetRelation('permissions');
        }

        return $next($request);
    }
}
