<?php

use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Inventory\Exceptions\VoidCostInconsistencyException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\StockBalance;
use App\Domain\Inventory\Services\InventoryVerifier;
use Illuminate\Support\Facades\DB;
use Tests\Support\InventoryScenario;

/**
 * Property-style test: a long seeded random sequence of real operations must
 * keep every invariant for every product and warehouse.
 */
function assertLedgerInvariants(InventoryScenario $s): void
{
    $rows = DB::select(<<<'SQL'
        SELECT b.product_id, b.warehouse_id, b.quantity, b.avg_cost, b.total_value, COALESCE(SUM(m.quantity), 0) AS ledger
        FROM stock_balances b
        LEFT JOIN stock_movements m ON m.product_id = b.product_id AND m.warehouse_id = b.warehouse_id
        WHERE b.company_id = ?
        GROUP BY b.id
        SQL, [$s->company->id]);

    foreach ($rows as $r) {
        expect(bccomp((string) $r->quantity, (string) $r->ledger, 4))->toBe(0, "balance != ledger for {$r->product_id}:{$r->warehouse_id}")
            ->and(bccomp((string) $r->total_value, '0', 4))->toBeGreaterThanOrEqual(0)
            ->and(bccomp((string) $r->avg_cost, '0', 4))->toBeGreaterThanOrEqual(0)
            ->and(bccomp((string) $r->quantity, '0', 4))->toBeGreaterThanOrEqual(0); // negative stock not allowed here
    }

    expect(app(InventoryVerifier::class)->verify($s->company->id))->toBe([]);
}

it('keeps balances == SUM(movements) and value/avg >= 0 across a random sequence', function () {
    $s = InventoryScenario::make();
    $products = collect([$s->product])->merge(
        Product::factory()->count(3)->create(['company_id' => $s->company->id, 'unit_id' => $s->product->unit_id])
    );
    $warehouses = [$s->warehouse, $s->branch];
    $posted = [];
    mt_srand(424242);

    for ($i = 0; $i < 120; $i++) {
        $product = $products[mt_rand(0, $products->count() - 1)];
        $warehouse = $warehouses[mt_rand(0, 1)];
        $op = mt_rand(1, 100);

        try {
            if ($op <= 40) {
                $posted[] = $s->entry((string) mt_rand(1, 20), (string) (mt_rand(500, 3000) / 100), $warehouse, $product);
            } elseif ($op <= 70) {
                $posted[] = $s->exit((string) mt_rand(1, 15), $warehouse, $product);
            } elseif ($op <= 82) {
                $posted[] = $s->post($s->draft('transfer', [['product_id' => $product->id, 'quantity' => (string) mt_rand(1, 8)]], [
                    'warehouse_id' => $warehouse->id,
                    'destination_warehouse_id' => ($warehouse->is($s->warehouse) ? $s->branch : $s->warehouse)->id,
                ]));
            } elseif ($op <= 90) {
                $posted[] = $s->post($s->draft('adjustment', [['product_id' => $product->id, 'counted_quantity' => (string) mt_rand(0, 25), 'unit_cost' => '10']], [
                    'warehouse_id' => $warehouse->id, 'adjustment_reason' => 'shrinkage',
                ]));
            } elseif ($posted !== []) {
                $s->void($posted[mt_rand(0, count($posted) - 1)]);
            }
        } catch (InsufficientStockException|VoidCostInconsistencyException) {
            // Expected business rejections: nothing must have been written.
        }

        if ($i % 20 === 0) {
            assertLedgerInvariants($s);
        }
    }

    assertLedgerInvariants($s);
    expect(InventoryDocument::query()->withoutGlobalScopes()->where('status', 'posted')->count())->toBeGreaterThan(30);
});

it('inventory:verify passes on a consistent ledger', function () {
    $s = InventoryScenario::make();
    $s->entry('10', '5');
    $s->exit('3');

    $this->artisan('inventory:verify')->assertSuccessful();
});

it('inventory:verify detects a corrupted balance and --repair rebuilds it from the ledger', function () {
    $s = InventoryScenario::make();
    $s->entry('10', '5');
    $s->entry('10', '7');
    $s->exit('4'); // 16 @ 6 = 96

    StockBalance::query()->withoutGlobalScopes()->where('product_id', $s->product->id)
        ->update(['quantity' => '999', 'total_value' => '1', 'avg_cost' => '3']);

    $this->artisan('inventory:verify', ['--company' => $s->company->id])
        ->expectsOutputToContain('balance_quantity_mismatch')
        ->assertFailed();

    $this->artisan('inventory:verify', ['--company' => $s->company->id, '--repair' => true])
        ->expectsOutputToContain('Reparados 1 saldo(s).')
        ->assertSuccessful();

    expect($s->state())->toBe(['16.0000', '6.0000', '96.0000']);
});

it('inventory:verify recreates a missing balance', function () {
    $s = InventoryScenario::make();
    $s->entry('5', '2');
    StockBalance::query()->withoutGlobalScopes()->delete();

    $this->artisan('inventory:verify', ['--repair' => true])->assertSuccessful();

    expect($s->state())->toBe(['5.0000', '2.0000', '10.0000']);
});
