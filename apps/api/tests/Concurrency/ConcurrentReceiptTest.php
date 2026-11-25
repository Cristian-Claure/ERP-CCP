<?php

use App\Domain\Inventory\Models\StockMovement;
use App\Domain\Purchases\Models\PurchaseReceipt;
use Tests\Support\ConcurrencyHarness;
use Tests\Support\PurchaseScenario;

/**
 * Two REAL concurrent receipts (separate processes and connections) of the
 * same OC line: each alone fits the pending quantity, together they do not.
 * The supplier -> OC lock order serializes them; the second sees the first.
 */
it('never lets two simultaneous receipts of the same OC exceed the ordered quantity', function () {
    $s = PurchaseScenario::make();
    $order = $s->approvedOrder(); // line 0: 10 units
    $start = fn (string $qty) => fn () => ConcurrencyHarness::start('post-receipt', [
        (string) $order->id, $qty, (string) $s->inv->user->id, (string) $s->inv->company->id,
    ]);

    $results = ConcurrencyHarness::race([$start('7'), $start('7')]);
    $ok = array_values(array_filter($results, fn ($r) => $r['ok']));
    $failed = array_values(array_filter($results, fn ($r) => ! $r['ok']));

    expect($ok)->toHaveCount(1)
        ->and($ok[0]['number'])->toBe('REC-000001')
        ->and($failed)->toHaveCount(1)
        ->and($failed[0]['code'])->toBe('over_receipt');

    expect($order->lines()->first()->received_quantity)->toBe('7.0000')
        ->and(PurchaseReceipt::query()->withoutGlobalScopes()->count())->toBe(1)
        ->and(StockMovement::query()->withoutGlobalScopes()->count())->toBe(1)
        ->and($s->inv->state()[0])->toBe('7.0000');

    $this->artisan('suppliers:verify')->assertSuccessful();
    $this->artisan('inventory:verify')->assertSuccessful();
});
