<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Services\AuditLogger;
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

        if (! $user->is_active || ! $user->company->is_active) {
            $guard->logout();

            throw ValidationException::withMessages([
                'email' => 'Tu cuenta está desactivada. Contacta al administrador.',
            ]);
        }

        // Prevent session fixation.
        request()->session()->regenerate();

        $user->forceFill(['last_login_at' => now()])->save();

        $this->audit->log('auth.login', actor: $user, auditable: $user);

        return $user;
    }
}
