<?php

use App\Domain\Inventory\Exceptions\VoidCostInconsistencyException;
use App\Domain\Inventory\Models\StockMovement;
use Tests\Support\InventoryScenario;

beforeEach(fn () => $this->s = InventoryScenario::make());

it('computes the moving average through entry -> entry -> exit -> void', function () {
    $s = $this->s;

    $s->entry('10', '10.00');
    expect($s->state())->toBe(['10.0000', '10.0000', '100.0000']);

    $second = $s->entry('10', '13.00');
    expect($s->state())->toBe(['20.0000', '11.5000', '230.0000']);

    $exit = $s->exit('5');
    expect($s->state())->toBe(['15.0000', '11.5000', '172.5000'])
        ->and($exit->lines->first()->unit_cost)->toBe('11.5000')
        ->and($exit->lines->first()->total_cost)->toBe('57.5000');

    // Reverting the 2nd entry at its ORIGINAL cost: 15 - 10 = 5 units, 172.5 - 130 = 42.5 -> avg 8.5
    $s->void($second);
    expect($s->state())->toBe(['5.0000', '8.5000', '42.5000']);

    $reversal = StockMovement::query()->withoutGlobalScopes()->whereNotNull('reverses_movement_id')->sole();
    expect($reversal->quantity)->toBe('-10.0000')
        ->and($reversal->unit_cost)->toBe('13.0000')
        ->and($reversal->quantity_after)->toBe('5.0000')
        ->and($reversal->avg_cost_after)->toBe('8.5000');
});

it('rejects a void that would leave positive quantity with negative value (void_cost_inconsistency)', function () {
    $s = $this->s;

    $s->entry('10', '10');         // 10 @ 10  -> value 100
    $second = $s->entry('10', '30'); // 20 @ 20  -> value 400
    $s->exit('9');                 // 11 @ 20  -> value 220

    // Undoing 10 @ 30 would leave 1 unit worth 220 - 300 = -80.
    expect(fn () => $s->void($second))->toThrow(function (VoidCostInconsistencyException $e) {
        expect($e->errorCode())->toBe('void_cost_inconsistency')
            ->and($e->details()['resulting_quantity'])->toBe('1.0000')
            ->and($e->details()['resulting_value'])->toBe('-80.0000')
            ->and($e->details()['suggestion'])->toBe('adjustment')
            ->and($e->getMessage())->toContain('ajuste');
    });

    // Nothing changed: still posted, balance intact, no reversal written.
    expect($second->fresh()->status->value)->toBe('posted')
        ->and($s->state())->toBe(['11.0000', '20.0000', '220.0000'])
        ->and(StockMovement::query()->withoutGlobalScopes()->whereNotNull('reverses_movement_id')->count())->toBe(0);
});

it('returns the void_cost_inconsistency envelope over HTTP', function () {
    $s = $this->s;
    $s->entry('10', '10');
    $second = $s->entry('10', '30');
    $s->exit('9');

    $this->actingAs($s->user)
        ->withHeaders(spaHeaders())
        ->postJson("/api/v1/inventory/documents/{$second->id}/void", ['reason' => 'Proveedor equivocado'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'void_cost_inconsistency')
        ->assertJsonPath('error.details.suggestion', 'adjustment');
});

it('transfers out at the origin average and in at that same cost', function () {
    $s = $this->s;
    $s->entry('10', '10');
    $s->entry('10', '13'); // avg 11.5

    $transfer = $s->post($s->draft('transfer', [['product_id' => $s->product->id, 'quantity' => '4']], [
        'destination_warehouse_id' => $s->branch->id,
    ]));

    expect($s->state())->toBe(['16.0000', '11.5000', '184.0000'])
        ->and($s->state($s->branch))->toBe(['4.0000', '11.5000', '46.0000'])
        ->and($transfer->movements()->withoutGlobalScopes()->count())->toBe(2);
});

it('computes count adjustments against the balance at posting time', function () {
    $s = $this->s;
    $s->entry('10', '10');

    $adjustment = $s->draft('adjustment', [['product_id' => $s->product->id, 'counted_quantity' => '7']], [
        'adjustment_reason' => 'shrinkage',
    ]);
    $s->exit('1'); // happens between drafting and posting: system is now 9
    $posted = $s->post($adjustment);

    $line = $posted->lines->first();
    expect($line->system_quantity)->toBe('9.0000')
        ->and($line->quantity)->toBe('-2.0000')
        ->and($s->state())->toBe(['7.0000', '10.0000', '70.0000']);
});
