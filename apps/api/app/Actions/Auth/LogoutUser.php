<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LogoutUser
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(Request $request): void
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user !== null) {
            $this->audit->log('auth.logout', actor: $user, auditable: $user);
        }

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
