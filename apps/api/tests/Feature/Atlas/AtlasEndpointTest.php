<?php

use App\Domain\Atlas\Services\AtlasCache;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use Tests\Support\SalesScenario;

beforeEach(function () {
    $this->s = SalesScenario::make();
    $s = $this->s;
    $s->inv->warehouse->update(['latitude' => '-17.738012', 'longitude' => '-63.174521']);
    $s->customer->update(['latitude' => '-17.764200', 'longitude' => '-63.195800', 'segment' => 'retail']);
    $s->creditCustomer->update(['latitude' => '-16.495500', 'longitude' => '-68.133600', 'segment' => 'corporate']);
    // A customer without coordinates never appears on the globe.
    Customer::factory()->create(['company_id' => $s->inv->company->id, 'name' => 'Sin ubicación']);
});

function atlasUser(SalesScenario $s, array $permissions): User
{
    $role = Role::findOrCreate('atlas-'.md5(implode(',', $permissions)), 'web');
    $role->syncPermissions($permissions);
    $user = User::factory()->for($s->inv->company)->create();
    CompanyContext::run($s->inv->company->id, fn () => $user->assignRole($role));

    return $user;
}

it('returns geolocated customers with their sales of the period and serving warehouses', function () {
    $s = $this->s;
    $s->sale([['quantity' => '2', 'unit_price' => '20.00']]);
    $s->creditSale('3', '20.00');

    $response = $this->actingAs($s->inv->user)->withHeaders(spaHeaders())
        ->getJson('/api/v1/atlas/customers')
        ->assertOk()
        ->assertJsonPath('meta.period.key', '90d')
        ->assertJsonPath('meta.receivables', true);

    $rows = collect($response->json('data'))->keyBy('name');
    expect($rows->keys()->all())->toEqualCanonicalizing(['Cliente Contado', 'Cliente Crédito'])
        ->and($rows['Cliente Contado']['sales_total'])->toBe('40.00')
        ->and($rows['Cliente Contado']['lat'])->toBe(-17.7642)
        ->and($rows['Cliente Contado']['flows'][0])->toBe(['warehouse_id' => $s->inv->warehouse->id, 'total' => '40.00', 'count' => 1])
        ->and($rows['Cliente Crédito']['receivables'])->toBe(['balance' => '60.00', 'overdue' => '0.00', 'debt_status' => 'current']);

    $this->getJson('/api/v1/atlas/warehouses')->assertOk()
        ->assertJsonPath('data.0.code', 'CEN')
        ->assertJsonPath('data.0.lat', -17.738012);
});

it('requires customers.view and hides receivables without receivables.view', function () {
    $s = $this->s;
    $s->creditSale();

    $this->actingAs(atlasUser($s, ['dashboard.view']))->withHeaders(spaHeaders())
        ->getJson('/api/v1/atlas/customers')->assertForbidden();

    $viewer = atlasUser($s, ['customers.view']);
    $response = $this->actingAs($viewer)->getJson('/api/v1/atlas/customers?status=overdue')
        ->assertOk()
        ->assertJsonPath('meta.receivables', false);

    // The debt filter is ignored and no receivable data leaks.
    expect($response->json('data'))->toHaveCount(2)
        ->and(collect($response->json('data'))->every(fn ($c) => ! array_key_exists('receivables', $c)))->toBeTrue();
});

it('filters by segment, debt status and period', function () {
    $s = $this->s;
    $sale = $s->creditSale('1', '20.00');
    SalesDocument::query()->withoutGlobalScopes()->whereKey($sale->id)->update(['due_date' => now()->subDays(10)]);
    $old = $s->sale();
    SalesDocument::query()->withoutGlobalScopes()->whereKey($old->id)->update(['document_date' => now()->subDays(60)]);

    $this->actingAs($s->inv->user)->withHeaders(spaHeaders());

    expect(collect($this->getJson('/api/v1/atlas/customers?segment=corporate')->json('data'))->pluck('name')->all())
        ->toBe(['Cliente Crédito'])
        ->and(collect($this->getJson('/api/v1/atlas/customers?status=overdue')->json('data'))->pluck('name')->all())
        ->toBe(['Cliente Crédito']);

    $cash = fn (string $period) => collect($this->getJson("/api/v1/atlas/customers?period={$period}")->json('data'))
        ->firstWhere('name', 'Cliente Contado')['sales_total'];
    expect($cash('30d'))->toBe('0.00')->and($cash('90d'))->toBe('20.00');

    $this->getJson('/api/v1/atlas/customers?period=forever')->assertStatus(422);
    $this->getJson('/api/v1/atlas/customers?segment=vip')->assertStatus(422);
});

it('isolates companies', function () {
    $a = $this->s;
    $b = SalesScenario::make();
    $b->customer->update(['latitude' => '-12.046400', 'longitude' => '-77.042800']);

    $names = collect($this->actingAs($a->inv->user)->withHeaders(spaHeaders())
        ->getJson('/api/v1/atlas/customers')->json('data'))->pluck('id')->all();

    expect($names)->not->toContain($b->customer->id);
});

it('serves from cache and invalidates it on sales, receipts and customer changes', function () {
    $s = $this->s;
    $cache = app(AtlasCache::class);
    $companyId = $s->inv->company->id;
    $this->actingAs($s->inv->user)->withHeaders(spaHeaders());
    $total = fn () => collect($this->getJson('/api/v1/atlas/customers')->json('data'))->firstWhere('name', 'Cliente Contado')['sales_total'];

    expect($total())->toBe('0.00');
    $version = $cache->version($companyId);

    // A direct DB change (no domain event) is NOT seen: the response comes from the cache.
    DB::table('customers')->where('id', $s->customer->id)->update(['name' => 'Renombrado por SQL']);
    expect(collect($this->getJson('/api/v1/atlas/customers')->json('data'))->pluck('name')->all())
        ->toContain('Cliente Contado');
    DB::table('customers')->where('id', $s->customer->id)->update(['name' => 'Cliente Contado']);

    $s->sale(); // SalesDocumentPosted
    expect($cache->version($companyId))->toBe($version + 1)
        ->and($total())->toBe('20.00');

    $s->creditSale();
    $s->pay($s->creditCustomer, '5.00'); // PaymentRegistered
    $s->void($s->sale()); // SalesDocumentVoided
    expect($cache->version($companyId))->toBeGreaterThanOrEqual($version + 5);

    $this->putJson("/api/v1/customers/{$s->customer->id}", [
        'document_type' => 'nit', 'document_number' => $s->customer->document_number, 'name' => 'Cliente Renombrado',
        'payment_terms' => 'cash', 'segment' => 'retail', 'latitude' => '-17.700000', 'longitude' => '-63.100000',
    ])->assertOk(); // CustomerSaved

    expect(collect($this->getJson('/api/v1/atlas/customers')->json('data'))->pluck('name')->all())
        ->toContain('Cliente Renombrado');

});
