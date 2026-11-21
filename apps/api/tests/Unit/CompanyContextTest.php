<?php

use App\Domain\Shared\Tenancy\CompanyContext;
use App\Domain\Shared\Tenancy\CurrentCompany;
use Tests\TestCase;

uses(TestCase::class);

it('sets tenant and permission team inside the callback and restores them after', function () {
    $result = CompanyContext::run(7, fn () => [app(CurrentCompany::class)->id(), getPermissionsTeamId()]);

    expect($result)->toBe([7, 7])
        ->and(app(CurrentCompany::class)->id())->toBeNull()
        ->and(getPermissionsTeamId())->toBeNull();
});

it('restores the outer context when nested or when the callback throws', function () {
    CompanyContext::run(1, function () {
        expect(fn () => CompanyContext::run(2, fn () => throw new RuntimeException('boom')))
            ->toThrow(RuntimeException::class);

        expect(app(CurrentCompany::class)->id())->toBe(1)
            ->and(getPermissionsTeamId())->toBe(1);
    });

    expect(getPermissionsTeamId())->toBeNull();
});
