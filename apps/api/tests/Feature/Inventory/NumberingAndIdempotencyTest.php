<?php

use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Inventory\Models\StockMovement;
use App\Domain\Shared\Models\AuditLog;
use Tests\Support\InventoryScenario;

beforeEach(fn () => $this->s = InventoryScenario::make());

it('numbers posted documents correlatively per type without gaps', function () {
    $s = $this->s;

    $e1 = $s->draft('entry', [['product_id' => $s->product->id, 'quantity' => '50', 'unit_cost' => '5']]);
    $x1 = $s->draft('exit', [['product_id' => $s->product->id, 'quantity' => '1']]);
    $e2 = $s->draft('entry', [['product_id' => $s->product->id, 'quantity' => '5', 'unit_cost' => '5']]);
    $x2 = $s->draft('exit', [['product_id' => $s->product->id, 'quantity' => '1']]);

    // Drafts have no number.
    expect($e1->number)->toBeNull();

    // Posting order differs from creation order.
    expect($s->post($e2)->number)->toBe('ENT-000001')
        ->and($s->post($x2)->number)->toBe('SAL-000001')
        ->and($s->post($e1)->number)->toBe('ENT-000002')
        ->and($s->post($x1)->number)->toBe('SAL-000002');
});

it('does not consume a number when posting fails (rollback)', function () {
    $s = $this->s;

    $tooMuch = $s->draft('exit', [['product_id' => $s->product->id, 'quantity' => '999']]);
    expect(fn () => $s->post($tooMuch))->toThrow(InsufficientStockException::class);
    expect($tooMuch->fresh()->number)->toBeNull();

    $s->entry('10', '1');
    expect($s->exit('1')->number)->toBe('SAL-000001');
});

it('numbers independently per company', function () {
    $a = $this->s;
    $b = InventoryScenario::make();

    expect($a->entry('1', '1')->number)->toBe('ENT-000001')
        ->and($b->entry('1', '1')->number)->toBe('ENT-000001')
        ->and($a->entry('1', '1')->number)->toBe('ENT-000002');
});

it('is idempotent: posting twice returns the same document without duplicating movements', function () {
    $s = $this->s;
    $draft = $s->draft('entry', [['product_id' => $s->product->id, 'quantity' => '10', 'unit_cost' => '2']]);

    $first = $s->post($draft);
    $second = $s->post($draft);

    expect($second->number)->toBe($first->number)
        ->and(StockMovement::query()->withoutGlobalScopes()->count())->toBe(1)
        ->and($s->state())->toBe(['10.0000', '2.0000', '20.0000'])
        ->and(AuditLog::query()->withoutGlobalScopes()->where('event', 'inventory.document.posted')->count())->toBe(1);
});

it('is idempotent over HTTP (double click)', function () {
    $s = $this->s;
    $draft = $s->draft('entry', [['product_id' => $s->product->id, 'quantity' => '3', 'unit_cost' => '2']]);
    $this->actingAs($s->user)->withHeaders(spaHeaders());

    $one = $this->postJson("/api/v1/inventory/documents/{$draft->id}/post")->assertOk();
    $two = $this->postJson("/api/v1/inventory/documents/{$draft->id}/post")->assertOk();

    expect($two->json('number'))->toBe($one->json('number'))
        ->and(StockMovement::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('voiding is idempotent too', function () {
    $s = $this->s;
    $doc = $s->entry('10', '2');

    $s->void($doc);
    $s->void($doc);

    expect(StockMovement::query()->withoutGlobalScopes()->whereNotNull('reverses_movement_id')->count())->toBe(1)
        ->and($s->state())->toBe(['0.0000', '2.0000', '0.0000']);
});

it('reuses the draft for a repeated Idempotency-Key', function () {
    $s = $this->s;
    $payload = [
        'type' => 'entry',
        'warehouse_id' => $s->warehouse->id,
        'document_date' => now($s->company->timezone)->toDateString(),
        'lines' => [['product_id' => $s->product->id, 'quantity' => '1', 'unit_cost' => '1']],
    ];
    $this->actingAs($s->user)->withHeaders([...spaHeaders(), 'Idempotency-Key' => 'abc-123']);

    $one = $this->postJson('/api/v1/inventory/documents', $payload)->assertCreated();
    $two = $this->postJson('/api/v1/inventory/documents', $payload)->assertOk();

    expect($two->json('id'))->toBe($one->json('id'));
});
