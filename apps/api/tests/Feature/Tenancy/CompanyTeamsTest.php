<?php

use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Database\Seeders\RolesAndPermissionsSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $this->withHeaders(spaHeaders());

    [$this->companyA, $this->companyB] = Company::factory()->count(2)->create();

    // Same person: admin in A, vendedor in B.
    $this->user = User::factory()->for($this->companyA)->create();
    $this->user->joinCompany($this->companyB->id);

    CompanyContext::run($this->companyA->id, fn () => $this->user->assignRole('admin'));
    CompanyContext::run($this->companyB->id, fn () => $this->user->unsetRelation('roles')->assignRole('vendedor'));
});

it('creates roles as global templates shared by every company', function () {
    expect(Role::whereNull('company_id')->pluck('name')->sort()->values()->all())
        ->toBe(['admin', 'almacenero', 'gerente', 'vendedor']);
});

it('resolves roles and permissions per active company', function () {
    $this->actingAs($this->user)
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('company.id', $this->companyA->id)
        ->assertJsonPath('roles', ['admin'])
        ->assertJsonFragment(['users.manage']);

    $this->user->update(['company_id' => $this->companyB->id]);

    $response = $this->actingAs($this->user->fresh())
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('company.id', $this->companyB->id)
        ->assertJsonPath('roles', ['vendedor']);

    expect($response->json('permissions'))->toContain('sales.create')
        ->not->toContain('users.manage');
});

it('grants nothing in a company where the user has no role', function () {
    $companyC = Company::factory()->create();
    $this->user->joinCompany($companyC->id);
    $this->user->update(['company_id' => $companyC->id]);

    $this->actingAs($this->user->fresh())
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('roles', [])
        ->assertJsonPath('permissions', []);
});

it('rejects requests when the active company is not a membership', function () {
    $this->user->companies()->updateExistingPivot($this->companyA->id, ['is_active' => false]);

    $this->actingAs($this->user)
        ->getJson('/api/v1/auth/me')
        ->assertForbidden()
        ->assertJsonPath('error.code', 'forbidden');
});

it('sets the team on login so the response carries active-company roles', function () {
    $this->postJson('/api/v1/auth/login', ['email' => $this->user->email, 'password' => 'password'])
        ->assertOk()
        ->assertJsonPath('roles', ['admin']);
});
