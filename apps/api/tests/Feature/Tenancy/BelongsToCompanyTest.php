<?php

use App\Domain\Shared\Models\AuditLog;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyMemberScope;

it('scopes users to members of the active company', function () {
    [$companyA, $companyB] = Company::factory()->count(2)->create();
    $userA = User::factory()->for($companyA)->create();
    User::factory()->count(2)->for($companyA)->create();
    User::factory()->count(3)->for($companyB)->create();

    $this->actingAs($userA);

    expect(User::count())->toBe(3)
        ->and(User::withoutGlobalScope(CompanyMemberScope::class)->count())->toBe(6);
});

it('shows a multi-company user in every company they belong to', function () {
    [$companyA, $companyB] = Company::factory()->count(2)->create();
    $shared = User::factory()->for($companyA)->create();
    $shared->joinCompany($companyB->id);
    $viewerB = User::factory()->for($companyB)->create();

    $this->actingAs($viewerB);

    expect(User::pluck('id')->all())->toEqualCanonicalizing([$shared->id, $viewerB->id]);
});

it('keeps the active company as a membership automatically', function () {
    [$companyA, $companyB] = Company::factory()->count(2)->create();
    $user = User::factory()->for($companyA)->create();

    expect($user->belongsToCompany($companyA->id))->toBeTrue()
        ->and($user->belongsToCompany($companyB->id))->toBeFalse();

    $user->update(['company_id' => $companyB->id]);

    expect($user->companies()->pluck('companies.id')->all())->toEqualCanonicalizing([$companyA->id, $companyB->id]);
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
