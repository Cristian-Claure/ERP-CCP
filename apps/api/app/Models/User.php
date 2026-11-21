<?php

namespace App\Models;

use App\Models\Scopes\CompanyMemberScope;
use App\Support\Tenancy\CurrentCompany;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * - companies(): every company the user belongs to (company_user).
 * - company_id / company(): the ACTIVE company. Roles and permissions
 *   (spatie teams) are resolved against it.
 */
#[Fillable(['company_id', 'name', 'email', 'password', 'is_active'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    protected static function booted(): void
    {
        static::addGlobalScope(new CompanyMemberScope);

        static::creating(function (User $user): void {
            $user->company_id ??= app(CurrentCompany::class)->id();
        });

        // The active company is always a membership.
        static::saved(function (User $user): void {
            if ($user->wasRecentlyCreated || $user->wasChanged('company_id')) {
                $user->joinCompany($user->company_id);
            }
        });
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsToMany<Company, $this>
     */
    public function companies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class)
            ->withPivot('is_active')
            ->withTimestamps();
    }

    public function joinCompany(?int $companyId): void
    {
        if ($companyId !== null) {
            $this->companies()->syncWithoutDetaching([$companyId]);
        }
    }

    public function belongsToCompany(int $companyId): bool
    {
        return $this->companies()
            ->wherePivot('is_active', true)
            ->whereKey($companyId)
            ->exists();
    }
}
