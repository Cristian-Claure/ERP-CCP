<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Auth\LoginUser;
use App\Actions\Auth\LogoutUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AuthController extends Controller
{
    public function login(LoginRequest $request, LoginUser $login): UserResource
    {
        $user = $login->handle(
            $request->string('email')->lower()->toString(),
            $request->string('password')->toString(),
            $request->boolean('remember'),
        );

        return $this->resource($user);
    }

    public function logout(Request $request, LogoutUser $logout): Response
    {
        $logout->handle($request);

        return response()->noContent();
    }

    public function me(Request $request): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        return $this->resource($user);
    }

    private function resource(User $user): UserResource
    {
        return UserResource::make($user->loadMissing(['company', 'roles.permissions', 'permissions']));
    }
}
