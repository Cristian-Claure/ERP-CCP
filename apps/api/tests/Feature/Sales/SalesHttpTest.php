<?php

use App\Domain\Sales\Models\Customer;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Spatie\Permission\Models\Role;
use Tests\Support\SalesScenario;

beforeEach(fn () => $this->s = SalesScenario::make());

function salesUser(SalesScenario $s, string $role): User
{
    $user = User::factory()->for($s->inv->company)->create();
    CompanyContext::run($s->inv->company->id, fn () => $user->assignRole($role));

    return $user;
}

function saleBody(SalesScenario $s, array $overrides = [], array $line = []): array
{
    return [
        'type' => 'invoice',
        'customer_id' => $s->customer->id,
        'warehouse_id' => $s->inv->warehouse->id,
        'document_date' => now($s->inv->company->timezone)->toDateString(),
        'lines' => [['product_id' => $s->inv->product->id, 'quantity' => '1', 'unit_price' => '20.00', ...$line]],
        ...$overrides,
    ];
}

it('enforces per-action sales permissions for each demo role', function (string $role, array $expected) {
    $s = $this->s;
    $user = salesUser($s, $role);
    $this->actingAs($user)->withHeaders(spaHeaders());

    expect($this->getJson('/api/v1/sales/documents')->status())->toBe($expected['view'] ? 200 : 403)
        ->and($this->getJson('/api/v1/customers')->status())->toBe($expected['view'] ? 200 : 403);

    $create = $this->postJson('/api/v1/sales/documents', saleBody($s));
    expect($create->status())->toBe($expected['create'] ? 201 : 403);

    $draftId = $expected['create'] ? $create->json('id') : $s->draft()->id;
    expect($this->postJson("/api/v1/sales/documents/{$draftId}/post")->status())->toBe($expected['post'] ? 200 : 403);

    $posted = $s->creditSale();
    expect($this->postJson("/api/v1/sales/documents/{$posted->id}/void", ['reason' => 'Prueba de permisos'])->status())
        ->toBe($expected['void'] ? 200 : 403);

    $s->creditSale(); // gives the credit customer something to pay
    expect($this->postJson('/api/v1/receivables/payments', [
        'customer_id' => $s->creditCustomer->id, 'payment_date' => now($s->inv->company->timezone)->toDateString(),
        'method' => 'cash', 'amount' => '5.00',
    ])->status())->toBe($expected['collect'] ? 201 : 403);

    // Authorizing a below-cost sale needs its own permission.
    $cheap = $s->draft('invoice', [['unit_price' => '5.00']]);
    $authorize = $this->postJson("/api/v1/sales/documents/{$cheap->id}/post", ['below_cost_reason' => 'Liquidación autorizada']);
    expect($authorize->status())->toBe(match (true) {
        ! $expected['post'] => 403,
        $expected['authorize'] => 200,
        default => 403,
    });

})->with([
    'admin' => ['admin', ['view' => true, 'create' => true, 'post' => true, 'void' => true, 'collect' => true, 'authorize' => true]],
    'gerente' => ['gerente', ['view' => true, 'create' => true, 'post' => true, 'void' => true, 'collect' => true, 'authorize' => true]],
    'vendedor' => ['vendedor', ['view' => true, 'create' => true, 'post' => true, 'void' => false, 'collect' => true, 'authorize' => false]],
    'almacenero' => ['almacenero', ['view' => false, 'create' => false, 'post' => false, 'void' => false, 'collect' => false, 'authorize' => false]],
]);

it('omits cost and margin without sales.view_margin, and receivables without receivables.view', function () {
    $s = $this->s;
    $sale = $s->sale();

    $seller = salesUser($s, 'vendedor');
    $manager = salesUser($s, 'gerente');

    $asSeller = $this->actingAs($seller)->withHeaders(spaHeaders())->getJson("/api/v1/sales/documents/{$sale->id}")->assertOk();
    expect($asSeller->json())->not->toHaveKeys(['cost_total', 'margin_total'])
        ->and($asSeller->json('lines.0'))->not->toHaveKeys(['unit_cost', 'cost_total', 'margin']);

    $asManager = $this->actingAs($manager)->getJson("/api/v1/sales/documents/{$sale->id}")->assertOk();
    expect($asManager->json('margin_total'))->toBe($sale->margin_total)
        ->and($asManager->json('lines.0.margin'))->not->toBeNull();

    // Receivables: a role with customers.view but without receivables.view.
    $role = Role::findOrCreate('consulta', 'web');
    $role->syncPermissions(['customers.view']);
    $viewer = salesUser($s, 'consulta');

    $asViewer = $this->actingAs($viewer)->getJson("/api/v1/customers/{$s->creditCustomer->id}")->assertOk();
    expect($asViewer->json('id'))->toBe($s->creditCustomer->id)
        ->and($asViewer->json())->not->toHaveKeys(['receivables', 'aging', 'data']);

    $asManagerCustomer = $this->actingAs($manager)->getJson("/api/v1/customers/{$s->creditCustomer->id}")->assertOk();
    expect($asManagerCustomer->json('name'))->toBe('Cliente Crédito')
        ->and($asManagerCustomer->json('receivables.balance'))->not->toBeNull()
        ->and($asManagerCustomer->json('aging.total'))->not->toBeNull();

    $this->actingAs($viewer);
    $this->getJson('/api/v1/customers/undefined')->assertNotFound();
    $this->getJson("/api/v1/customers/{$s->creditCustomer->id}/statement")->assertForbidden();
    $this->getJson('/api/v1/customers?filter[debt_status]=overdue')->assertOk(); // filter silently ignored
});

it('returns the uniform error envelope for business rules', function () {
    $s = $this->s;
    $this->actingAs($s->inv->user)->withHeaders(spaHeaders());

    $noStock = $this->postJson('/api/v1/sales/documents', saleBody($s, line: ['quantity' => '500']))->json('id');
    $this->postJson("/api/v1/sales/documents/{$noStock}/post")
        ->assertStatus(422)->assertJsonPath('error.code', 'insufficient_stock');

    $overLimit = $this->postJson('/api/v1/sales/documents', saleBody($s, ['customer_id' => $s->creditCustomer->id, 'payment_terms' => 'credit'], ['quantity' => '60']))->json('id');
    $this->postJson("/api/v1/sales/documents/{$overLimit}/post")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'credit_limit_exceeded')
        ->assertJsonPath('error.details.credit_limit', '1000.00');

    $cheap = $this->postJson('/api/v1/sales/documents', saleBody($s, line: ['unit_price' => '1.00']))->json('id');
    $this->postJson("/api/v1/sales/documents/{$cheap}/post")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'price_below_cost')
        ->assertJsonPath('error.details.lines.0.rule', 'below_cost');
});

it('isolates customers, sales and receipts between companies', function () {
    $a = $this->s;
    $b = SalesScenario::make();
    $saleB = $b->creditSale();
    $paymentB = $b->pay($b->creditCustomer, '5.00');

    $this->actingAs($a->inv->user)->withHeaders(spaHeaders());

    $this->getJson("/api/v1/customers/{$b->customer->id}")->assertNotFound();
    $this->getJson("/api/v1/sales/documents/{$saleB->id}")->assertNotFound();
    $this->getJson("/api/v1/receivables/payments/{$paymentB->id}")->assertNotFound();
    $this->postJson('/api/v1/sales/documents', saleBody($a, ['customer_id' => $b->customer->id]))->assertStatus(422);

    expect(collect($this->getJson('/api/v1/customers?per_page=100')->json('data'))->pluck('id')->all())
        ->toEqualCanonicalizing([$a->customer->id, $a->creditCustomer->id]);
});

it('converts a valid quote into a draft sale once, and rejects an expired one', function () {
    $s = $this->s;
    $this->actingAs($s->inv->user)->withHeaders(spaHeaders());

    $quote = $s->sale([['quantity' => '2', 'unit_price' => '25.00', 'discount_amount' => '5.00']], ['global_discount' => '3.00'], 'quote');

    $draft = $this->postJson("/api/v1/sales/documents/{$quote->id}/convert", ['type' => 'invoice'])->assertCreated();
    expect($draft->json('status'))->toBe('draft')
        ->and($draft->json('quote.number'))->toBe('COT-000001')
        ->and($draft->json('total'))->toBe($quote->total)
        ->and($draft->json('lines.0.discount_amount'))->toBe('5.00');

    $this->postJson("/api/v1/sales/documents/{$quote->id}/convert", ['type' => 'invoice'])
        ->assertStatus(422)->assertJsonPath('error.code', 'quote_already_converted');

    $expired = $s->sale(header: ['valid_until' => now($s->inv->company->timezone)->toDateString()], type: 'quote');
    $this->travel(2)->days();
    $this->postJson("/api/v1/sales/documents/{$expired->id}/convert", ['type' => 'sales_note'])
        ->assertStatus(422)->assertJsonPath('error.code', 'quote_expired');
});

it('serves the customer statement with running balance and the sales dashboard', function () {
    $s = $this->s;
    $s->creditSale('5', '20.00');
    $s->pay($s->creditCustomer, '30.00');
    $s->sale([['quantity' => '2']]);

    $this->actingAs($s->inv->user)->withHeaders(spaHeaders());

    $statement = $this->getJson("/api/v1/customers/{$s->creditCustomer->id}/statement")->assertOk();
    expect(collect($statement->json('data'))->pluck('balance_after')->all())->toBe(['100.00', '70.00'])
        ->and($statement->json('opening_balance'))->toBe('0.00')
        ->and($statement->json('aging.total'))->toBe('70.00');

    $dash = $this->getJson('/api/v1/dashboard/sales')->assertOk();
    expect($dash->json('month.current.total'))->toBe('140.00')
        ->and($dash->json('month.current.count'))->toBe(2)
        ->and($dash->json('daily'))->toHaveCount(90)
        ->and($dash->json('top_products.metric'))->toBe('margin')
        ->and($dash->json('receivables.total'))->toBe('70.00')
        ->and($dash->json('top_customers.0.name'))->toBe('Cliente Crédito');
});

it('creates customers with unique documents per company and validates coordinates', function () {
    $s = $this->s;
    $this->actingAs($s->inv->user)->withHeaders(spaHeaders());

    $body = [
        'document_type' => 'ci_complement', 'document_number' => '1234567', 'complement' => '1a',
        'name' => 'Juana Pérez', 'payment_terms' => 'credit', 'credit_days' => 15, 'credit_limit' => '2500',
        'segment' => 'retail', 'latitude' => '-17.783327', 'longitude' => '-63.182140',
    ];

    $created = $this->postJson('/api/v1/customers', $body)->assertCreated();
    expect($created->json('document_label'))->toBe('CI con complemento 1234567-1A')
        ->and($created->json('latitude'))->toBe('-17.783327');

    $this->postJson('/api/v1/customers', $body)->assertStatus(422)->assertJsonPath('error.code', 'validation_failed')->assertJsonStructure(['error' => ['details' => ['document_number']]]);
    $this->postJson('/api/v1/customers', [...$body, 'complement' => '2B'])->assertCreated();
    $this->postJson('/api/v1/customers', [...$body, 'document_number' => '999', 'latitude' => '95'])
        ->assertStatus(422)->assertJsonStructure(['error' => ['details' => ['latitude']]]);

    expect(Customer::query()->withoutGlobalScopes()->where('company_id', $s->inv->company->id)->count())->toBe(4);
});
