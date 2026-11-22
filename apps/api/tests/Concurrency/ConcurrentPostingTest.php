<?php

use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\StockMovement;
use Tests\Support\ConcurrencyHarness;
use Tests\Support\InventoryScenario;

/**
 * Two REAL concurrent postings (separate PHP processes and DB connections)
 * over the same balance. Data is committed (DatabaseTruncation), not wrapped
 * in a test transaction, so both workers can see it.
 */
function postInventory(InventoryDocument $document, InventoryScenario $s): callable
{
    return fn () => ConcurrencyHarness::start('post-document', [(string) $document->id, (string) $s->user->id, (string) $s->company->id]);
}

it('never lets two simultaneous exits drive the same balance negative', function () {
    $s = InventoryScenario::make();
    $s->entry('10', '5');

    // Each exit alone is valid (6 <= 10); together they are not (12 > 10).
    $exitA = $s->draft('exit', [['product_id' => $s->product->id, 'quantity' => '6']]);
    $exitB = $s->draft('exit', [['product_id' => $s->product->id, 'quantity' => '6']]);

    $results = ConcurrencyHarness::race([postInventory($exitA, $s), postInventory($exitB, $s)]);

    $ok = array_values(array_filter($results, fn ($r) => $r['ok']));
    $failed = array_values(array_filter($results, fn ($r) => ! $r['ok']));

    expect($ok)->toHaveCount(1)
        ->and($ok[0]['number'])->toBe('SAL-000001')
        ->and($failed)->toHaveCount(1)
        ->and($failed[0]['code'])->toBe('insufficient_stock')
        ->and($failed[0]['details']['lines'][0]['available'])->toBe('4.0000')
        ->and($failed[0]['details']['lines'][0]['requested'])->toBe('6.0000');

    expect($s->state())->toBe(['4.0000', '5.0000', '20.0000'])
        ->and(StockMovement::query()->withoutGlobalScopes()->count())->toBe(2);

    $this->artisan('inventory:verify')->assertSuccessful();
});

it('serializes a double post of the SAME document into a single posting', function () {
    $s = InventoryScenario::make();
    $draft = $s->draft('entry', [['product_id' => $s->product->id, 'quantity' => '3', 'unit_cost' => '2']]);

    $numbers = array_map(
        fn (array $r) => $r['number'] ?? null,
        ConcurrencyHarness::race([postInventory($draft, $s), postInventory($draft, $s)]),
    );

    expect($numbers)->toBe(['ENT-000001', 'ENT-000001'])
        ->and(StockMovement::query()->withoutGlobalScopes()->count())->toBe(1)
        ->and($s->state())->toBe(['3.0000', '2.0000', '6.0000']);
});
