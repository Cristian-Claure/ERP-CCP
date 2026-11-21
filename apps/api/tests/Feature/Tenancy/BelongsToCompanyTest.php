<?php

use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Scopes\CompanyScope;
use App\Models\User;

it('scopes queries to the authenticated user company', function () {
    [$companyA, $companyB] = Company::factory()->count(2)->create();
    $userA = User::factory()->for($companyA)->create();
    User::factory()->count(2)->for($companyA)->create();
    User::factory()->count(3)->for($companyB)->create();

    $this->actingAs($userA);

    expect(User::count())->toBe(3)
        ->and(User::pluck('company_id')->unique()->all())->toBe([$companyA->id])
        ->and(User::withoutGlobalScope(CompanyScope::class)->count())->toBe(6);
});

it('fills company_id automatically on create', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $log = AuditLog::create(['event' => 'test.event']);

    expect($log->company_id)->toBe($user->company_id);
});

it('keeps audit logs immutable', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $log = AuditLog::create(['event' => 'test.event']);

    expect(fn () => $log->update(['event' => 'changed']))->toThrow(LogicException::class)
        ->and(fn () => $log->delete())->toThrow(LogicException::class);
});
