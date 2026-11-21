<?php

use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoCompanySeeder;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
    $this->withHeaders(spaHeaders());
});

it('logs in the demo admin with valid credentials', function () {
    $response = $this->postJson('/api/v1/auth/login', [
        'email' => DemoCompanySeeder::ADMIN_EMAIL,
        'password' => 'password',
    ]);

    $response->assertOk()
        ->assertJsonPath('email', DemoCompanySeeder::ADMIN_EMAIL)
        ->assertJsonPath('company.legal_name', 'Comercial Demo S.R.L.')
        ->assertJsonPath('company.currency', 'BOB')
        ->assertJsonPath('roles', ['admin'])
        ->assertJsonMissingPath('password');

    expect($response->json('permissions'))->toContain('users.manage', 'inventory.manage');
    $this->assertAuthenticated('web');
    expect(AuditLog::where('event', 'auth.login')->count())->toBe(1);
});

it('rejects invalid credentials with the uniform 422 envelope', function () {
    $this->postJson('/api/v1/auth/login', [
        'email' => DemoCompanySeeder::ADMIN_EMAIL,
        'password' => 'wrong-password',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.status', 422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['status', 'code', 'message', 'details' => ['email']]]);

    $this->assertGuest('web');
});

it('validates the login payload', function () {
    $this->postJson('/api/v1/auth/login', ['email' => 'not-an-email'])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['email', 'password']]]);
});

it('blocks inactive users', function () {
    $user = User::factory()->inactive()->create(['password' => 'secret123']);

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'secret123'])
        ->assertStatus(422);

    $this->assertGuest('web');
});

it('blocks users of an inactive company', function () {
    $user = User::factory()->for(Company::factory()->inactive())->create(['password' => 'secret123']);

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'secret123'])
        ->assertStatus(422);
});

it('rate limits repeated login attempts', function () {
    RateLimiter::clear('login');

    foreach (range(1, 5) as $_) {
        $this->postJson('/api/v1/auth/login', [
            'email' => DemoCompanySeeder::ADMIN_EMAIL,
            'password' => 'wrong-password',
        ])->assertStatus(422);
    }

    $this->postJson('/api/v1/auth/login', [
        'email' => DemoCompanySeeder::ADMIN_EMAIL,
        'password' => 'wrong-password',
    ])
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'too_many_requests');
});

it('returns the authenticated user on /me', function () {
    $admin = User::where('email', DemoCompanySeeder::ADMIN_EMAIL)->firstOrFail();

    $this->actingAs($admin, 'web')
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('id', $admin->id)
        ->assertJsonPath('roles', ['admin']);
});

it('returns 401 with the uniform envelope when not authenticated', function () {
    $this->getJson('/api/v1/auth/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => [
            'status' => 401,
            'code' => 'unauthenticated',
            'message' => 'No has iniciado sesión o tu sesión expiró.',
        ]]);
});

it('logs out and invalidates the session', function () {
    $this->postJson('/api/v1/auth/login', [
        'email' => DemoCompanySeeder::ADMIN_EMAIL,
        'password' => 'password',
    ])->assertOk();

    $this->postJson('/api/v1/auth/logout')->assertNoContent();

    $this->assertGuest('web');
    expect(AuditLog::where('event', 'auth.logout')->count())->toBe(1);
});

it('returns 404 with the uniform envelope for unknown routes', function () {
    $this->getJson('/api/v1/does-not-exist')
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'not_found');
});
