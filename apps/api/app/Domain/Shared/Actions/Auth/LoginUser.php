<?php

namespace App\Domain\Shared\Actions\Auth;

use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class LoginUser
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @throws ValidationException
     */
    public function handle(string $email, string $password, bool $remember = false): User
    {
        $guard = Auth::guard('web');

        if (! $guard->attempt(['email' => $email, 'password' => $password], $remember)) {
            throw ValidationException::withMessages([
                'email' => 'Las credenciales no son correctas.',
            ]);
        }

        /** @var User $user */
        $user = $guard->user();
        $user->loadMissing('company');

        if (! $user->is_active || ! $user->company?->is_active || ! $user->belongsToCompany($user->company_id)) {
            $guard->logout();

            throw ValidationException::withMessages([
                'email' => 'Tu cuenta está desactivada. Contacta al administrador.',
            ]);
        }

        // Roles/permissions are resolved per active company (spatie teams).
        setPermissionsTeamId($user->company_id);
        $user->unsetRelation('roles')->unsetRelation('permissions');

        // Prevent session fixation.
        request()->session()->regenerate();

        $user->forceFill(['last_login_at' => now()])->save();

        $this->audit->log('auth.login', actor: $user, auditable: $user);

        return $user;
    }
}
