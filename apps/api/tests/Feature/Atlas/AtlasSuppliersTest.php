<?php

use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Tests\Support\PurchaseScenario;

it('serves the supplier layer with inbound flows per warehouse, refreshed after a receipt', function () {
    $s = PurchaseScenario::make();
    $s->supplier->update(['latitude' => '-17.76', 'longitude' => '-63.15']);
    $this->actingAs($s->inv->user)->withHeaders(spaHeaders());

    $empty = $this->getJson('/api/v1/atlas/suppliers')->assertOk();
    expect($empty->json('data'))->toHaveCount(1)->and($empty->json('data.0.purchases_total'))->toBe('0.00');

    $s->receive($s->approvedOrder(), [[0, '10']]);

    $this->getJson('/api/v1/atlas/suppliers')->assertOk()
        ->assertJsonPath('data.0.purchases_total', '98.31')
        ->assertJsonPath('data.0.flows.0.warehouse_id', $s->inv->warehouse->id)
        ->assertJsonPath('data.0.balance', '113.00');

    $seller = User::factory()->for($s->inv->company)->create();
    CompanyContext::run($s->inv->company->id, fn () => $seller->assignRole('vendedor'));
    $this->actingAs($seller)->getJson('/api/v1/atlas/suppliers')->assertForbidden();
});
