<?php

use App\Domain\Inventory\Exceptions\InvalidDocumentException;
use App\Domain\Shared\Models\AuditLog;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;
use Illuminate\Support\Carbon;
use Tests\Support\InventoryScenario;

beforeEach(fn () => $this->s = InventoryScenario::make());

function userWithRole(InventoryScenario $s, string $role): User
{
    $user = User::factory()->for($s->company)->create();
    CompanyContext::run($s->company->id, fn () => $user->assignRole($role));

    return $user;
}

it('enforces per-action permissions for each demo role', function (string $role, array $expected) {
    $s = $this->s;
    $s->entry('20', '5');
    $user = userWithRole($s, $role);
    $this->actingAs($user)->withHeaders(spaHeaders());

    $draft = fn () => $this->postJson('/api/v1/inventory/documents', [
        'type' => 'exit', 'warehouse_id' => $s->warehouse->id,
        'document_date' => now($s->company->timezone)->toDateString(),
        'lines' => [['product_id' => $s->product->id, 'quantity' => '1']],
    ]);

    $create = $draft();
    expect($create->status())->toBe($expected['create'] ? 201 : 403);

    $docId = $expected['create'] ? $create->json('id') : $s->draft('exit', [['product_id' => $s->product->id, 'quantity' => '1']])->id;
    expect($this->postJson("/api/v1/inventory/documents/{$docId}/post")->status())->toBe($expected['post'] ? 200 : 403);

    $posted = $s->exit('1');
    expect($this->postJson("/api/v1/inventory/documents/{$posted->id}/void", ['reason' => 'Prueba de permisos'])->status())
        ->toBe($expected['void'] ? 200 : 403);

    expect($this->postJson('/api/v1/inventory/products', ['sku' => 'NEW-'.$role, 'name' => 'Nuevo', 'unit_id' => $s->product->unit_id])->status())
        ->toBe($expected['products'] ? 201 : 403);

    expect($this->getJson('/api/v1/inventory/products')->status())->toBe(200);
})->with([
    'admin' => ['admin', ['create' => true, 'post' => true, 'void' => true, 'products' => true]],
    'gerente' => ['gerente', ['create' => true, 'post' => true, 'void' => true, 'products' => true]],
    'almacenero' => ['almacenero', ['create' => true, 'post' => true, 'void' => false, 'products' => false]],
    'vendedor' => ['vendedor', ['create' => false, 'post' => false, 'void' => false, 'products' => false]],
]);

it('rejects exits beyond stock with a clear 422 (product, warehouse, available, requested)', function () {
    $s = $this->s;
    $s->entry('3', '5');
    $draft = $s->draft('exit', [['product_id' => $s->product->id, 'quantity' => '5']]);

    $this->actingAs($s->user)->withHeaders(spaHeaders())
        ->postJson("/api/v1/inventory/documents/{$draft->id}/post")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'insufficient_stock')
        ->assertJsonPath('error.details.lines.0.sku', 'ARR-1')
        ->assertJsonPath('error.details.lines.0.warehouse', 'Central')
        ->assertJsonPath('error.details.lines.0.available', '3.0000')
        ->assertJsonPath('error.details.lines.0.requested', '5.0000')
        ->assertJsonPath('error.message', 'Stock insuficiente de "Arroz" en Central: disponible 3, solicitado 5.');
});

it('allows negative stock when the company enables it, keeping value at zero', function () {
    $s = InventoryScenario::make(['allow_negative_stock' => true]);
    $s->entry('2', '10');
    $s->exit('5');

    expect($s->state())->toBe(['-3.0000', '10.0000', '0.0000']);

    $s->entry('5', '12'); // covers the deficit at the new cost
    expect($s->state())->toBe(['2.0000', '12.0000', '24.0000']);
});

it('blocks a void that would leave negative stock', function () {
    $s = $this->s;
    $entry = $s->entry('10', '5');
    $s->exit('8');

    $this->actingAs($s->user)->withHeaders(spaHeaders())
        ->postJson("/api/v1/inventory/documents/{$entry->id}/void", ['reason' => 'Entrada duplicada'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'insufficient_stock');
});

it('requires a void reason and stores who voided, when and why', function () {
    $s = $this->s;
    $doc = $s->entry('5', '5');
    $this->actingAs($s->user)->withHeaders(spaHeaders());

    $this->postJson("/api/v1/inventory/documents/{$doc->id}/void", ['reason' => ''])->assertStatus(422);

    $this->postJson("/api/v1/inventory/documents/{$doc->id}/void", ['reason' => 'Proveedor anuló la factura'])
        ->assertOk()
        ->assertJsonPath('status', 'voided')
        ->assertJsonPath('void_reason', 'Proveedor anuló la factura')
        ->assertJsonPath('voided_by.id', $s->user->id);

    $log = AuditLog::query()->withoutGlobalScopes()->where('event', 'inventory.document.voided')->sole();
    expect($log->new_values['reason'])->toBe('Proveedor anuló la factura');
});

it('enforces the document date window (no future, max N days back)', function () {
    $s = InventoryScenario::make(['document_backdate_days' => 10]);
    $today = now($s->company->timezone);
    $line = [['product_id' => $s->product->id, 'quantity' => '1', 'unit_cost' => '1']];

    expect(fn () => $s->draft('entry', $line, ['document_date' => $today->copy()->addDay()->toDateString()]))
        ->toThrow(InvalidDocumentException::class, 'no puede ser futura');

    expect(fn () => $s->draft('entry', $line, ['document_date' => $today->copy()->subDays(11)->toDateString()]))
        ->toThrow(InvalidDocumentException::class, 'ventana de 10 días');

    expect($s->draft('entry', $line, ['document_date' => $today->copy()->subDays(10)->toDateString()])->id)->toBeInt();
});

it('re-checks the date window at posting time', function () {
    $s = InventoryScenario::make(['document_backdate_days' => 5]);
    $draft = $s->draft('entry', [['product_id' => $s->product->id, 'quantity' => '1', 'unit_cost' => '1']], [
        'document_date' => now($s->company->timezone)->subDays(5)->toDateString(),
    ]);

    Carbon::setTestNow(now()->addDays(2)); // the draft is now 7 days old
    try {
        expect(fn () => $s->post($draft))->toThrow(InvalidDocumentException::class);
    } finally {
        Carbon::setTestNow();
    }
});

it('audits draft deletion and forbids deleting posted documents', function () {
    $s = $this->s;
    $draft = $s->draft('entry', [['product_id' => $s->product->id, 'quantity' => '4', 'unit_cost' => '2']], ['reference' => 'FAC-77']);
    $this->actingAs($s->user)->withHeaders(spaHeaders());

    $this->deleteJson("/api/v1/inventory/documents/{$draft->id}")->assertNoContent();

    $log = AuditLog::query()->withoutGlobalScopes()->where('event', 'inventory.document.draft_deleted')->sole();
    expect($log->old_values['reference'])->toBe('FAC-77')
        ->and($log->old_values['lines'][0]['quantity'])->toBe('4.0000')
        ->and($log->user_id)->toBe($s->user->id);

    $posted = $s->entry('1', '1');
    $this->deleteJson("/api/v1/inventory/documents/{$posted->id}")->assertForbidden();
});

it('audits every posting', function () {
    $s = $this->s;
    $doc = $s->entry('1', '1');

    $log = AuditLog::query()->withoutGlobalScopes()->where('event', 'inventory.document.posted')->sole();
    expect($log->auditable_type)->toBe('inventory_document')
        ->and($log->auditable_id)->toBe($doc->id)
        ->and($log->new_values['number'])->toBe('ENT-000001');
});

it('rejects decimals for non-fractional units and requires a reason for "other" adjustments', function () {
    $s = $this->s;

    expect(fn () => $s->draft('exit', [['product_id' => $s->product->id, 'quantity' => '1.5']]))
        ->toThrow(InvalidDocumentException::class, 'no admite decimales');

    expect(fn () => $s->draft('adjustment', [['product_id' => $s->product->id, 'counted_quantity' => '1']], ['adjustment_reason' => 'other']))
        ->toThrow(InvalidDocumentException::class, 'Otro');
});

it('isolates documents between companies', function () {
    $a = $this->s;
    $b = InventoryScenario::make();
    $docB = $b->entry('1', '1');

    $this->actingAs($a->user)->withHeaders(spaHeaders())
        ->getJson("/api/v1/inventory/documents/{$docB->id}")
        ->assertNotFound();
});

it('returns the kardex with both dates, running balance and opening balance', function () {
    $s = $this->s;
    $s->entry('10', '10');
    $s->entry('10', '13');
    $s->exit('5');

    $response = $this->actingAs($s->user)->withHeaders(spaHeaders())
        ->getJson("/api/v1/inventory/products/{$s->product->id}/kardex?warehouse_id={$s->warehouse->id}")
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('data.2.quantity_out', '5.0000')
        ->assertJsonPath('data.2.quantity_after', '15.0000')
        ->assertJsonPath('data.2.avg_cost_after', '11.5000')
        ->assertJsonPath('data.2.document.number', 'SAL-000001')
        ->assertJsonPath('meta.opening.quantity', '0.0000');

    expect($response->json('data.0'))->toHaveKeys(['posted_at', 'document_date']);
});

it('exports the kardex as CSV', function () {
    $s = $this->s;
    $s->entry('10', '10');

    $response = $this->actingAs($s->user)->withHeaders(spaHeaders())
        ->get("/api/v1/inventory/products/{$s->product->id}/kardex/export?warehouse_id={$s->warehouse->id}");

    $response->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    $csv = $response->streamedContent();
    expect($csv)->toContain('"Fecha confirmación";"Fecha documento";Documento')
        ->toContain('ENT-000001')
        ->toContain('10,0000');
});

it('lists products with stock, filters below minimum and reports dashboard data', function () {
    $s = $this->s;
    $s->product->update(['min_stock' => '50']);
    $s->entry('10', '3');
    $this->actingAs($s->user)->withHeaders(spaHeaders());

    $this->getJson('/api/v1/inventory/products?filter[below_min]=1&sort=-stock')
        ->assertOk()
        ->assertJsonPath('data.0.sku', 'ARR-1')
        ->assertJsonPath('data.0.stock.quantity', '10.0000')
        ->assertJsonPath('data.0.stock.below_min', true)
        ->assertJsonPath('meta.total', 1);

    $this->getJson('/api/v1/dashboard/inventory')
        ->assertOk()
        ->assertJsonPath('low_stock.count', 1)
        ->assertJsonPath('valuation.total', '30.0000');
});
