<?php

namespace App\Domain\Inventory\Services;

use App\Domain\Inventory\Models\StockBalance;
use Illuminate\Support\Facades\DB;

/**
 * Checks the ledger invariants for ONE company:
 *
 *  1. balance.quantity == SUM(movements.quantity)          (balance_quantity_mismatch)
 *  2. balance == snapshot of its last movement              (balance_snapshot_mismatch)
 *  3. every movement pair with movements has a balance      (missing_balance)
 *  4. running chain: quantity_after == prev + quantity      (broken_chain)
 *  5. valuation: value >= 0 and avg_cost >= 0 everywhere    (negative_valuation)
 *
 * Balances are a derived cache, so 1-3 are repairable from the ledger.
 * Movements are immutable: 4-5 on movements need manual investigation.
 */
class InventoryVerifier
{
    public const REPAIRABLE = ['balance_quantity_mismatch', 'balance_snapshot_mismatch', 'missing_balance'];

    /**
     * @return list<array{type: string, product_id: int, warehouse_id: int, detail: string}>
     */
    public function verify(int $companyId): array
    {
        $issues = [];

        $rows = DB::select(<<<'SQL'
            SELECT b.product_id, b.warehouse_id, b.quantity, b.avg_cost, b.total_value,
                   COALESCE(m.sum_qty, 0) AS sum_qty,
                   last.quantity_after, last.avg_cost_after, last.value_after
            FROM stock_balances b
            LEFT JOIN (
                SELECT product_id, warehouse_id, SUM(quantity) AS sum_qty
                FROM stock_movements WHERE company_id = ?
                GROUP BY product_id, warehouse_id
            ) m ON m.product_id = b.product_id AND m.warehouse_id = b.warehouse_id
            LEFT JOIN LATERAL (
                SELECT quantity_after, avg_cost_after, value_after
                FROM stock_movements sm
                WHERE sm.product_id = b.product_id AND sm.warehouse_id = b.warehouse_id
                ORDER BY sm.id DESC LIMIT 1
            ) last ON TRUE
            WHERE b.company_id = ?
            SQL, [$companyId, $companyId]);

        foreach ($rows as $r) {
            if (bccomp((string) $r->quantity, (string) $r->sum_qty, 4) !== 0) {
                $issues[] = $this->issue('balance_quantity_mismatch', $r, "saldo {$r->quantity} ≠ suma ledger {$r->sum_qty}");
            }

            $expected = $r->quantity_after === null
                ? ['0', (string) $r->avg_cost, '0'] // no movements: zero stock and value
                : [(string) $r->quantity_after, (string) $r->avg_cost_after, (string) $r->value_after];

            if (bccomp((string) $r->quantity, $expected[0], 4) !== 0
                || bccomp((string) $r->avg_cost, $expected[1], 4) !== 0
                || bccomp((string) $r->total_value, $expected[2], 4) !== 0) {
                $issues[] = $this->issue('balance_snapshot_mismatch', $r, sprintf(
                    'saldo (%s, %s, %s) ≠ último movimiento (%s, %s, %s)',
                    $r->quantity, $r->avg_cost, $r->total_value, ...$expected,
                ));
            }

            if (bccomp((string) $r->total_value, '0', 4) < 0 || bccomp((string) $r->avg_cost, '0', 4) < 0) {
                $issues[] = $this->issue('negative_valuation', $r, "saldo con valor {$r->total_value} / costo {$r->avg_cost}");
            }
        }

        foreach (DB::select(<<<'SQL'
            SELECT DISTINCT m.product_id, m.warehouse_id
            FROM stock_movements m
            LEFT JOIN stock_balances b ON b.product_id = m.product_id AND b.warehouse_id = m.warehouse_id
            WHERE m.company_id = ? AND b.id IS NULL
            SQL, [$companyId]) as $r) {
            $issues[] = $this->issue('missing_balance', $r, 'hay movimientos pero no existe el saldo');
        }

        foreach (DB::select(<<<'SQL'
            SELECT id, product_id, warehouse_id, quantity, quantity_after, prev_after, avg_cost_after, value_after
            FROM (
                SELECT id, product_id, warehouse_id, quantity, quantity_after, avg_cost_after, value_after,
                       LAG(quantity_after) OVER (PARTITION BY product_id, warehouse_id ORDER BY id) AS prev_after
                FROM stock_movements WHERE company_id = ?
            ) t
            WHERE quantity_after <> COALESCE(prev_after, 0) + quantity
               OR value_after < 0 OR avg_cost_after < 0
            SQL, [$companyId]) as $r) {
            $broken = bccomp((string) $r->quantity_after, bcadd((string) ($r->prev_after ?? '0'), (string) $r->quantity, 4), 4) !== 0;
            $issues[] = $broken
                ? $this->issue('broken_chain', $r, "movimiento #{$r->id}: saldo {$r->quantity_after} ≠ anterior ".($r->prev_after ?? '0')." + {$r->quantity}")
                : $this->issue('negative_valuation', $r, "movimiento #{$r->id}: valor {$r->value_after} / costo {$r->avg_cost_after}");
        }

        return $issues;
    }

    /**
     * Rebuilds a balance from the ledger (quantity = SUM, cost/value = last
     * movement snapshot), under a row lock.
     */
    public function repair(int $companyId, int $productId, int $warehouseId): void
    {
        DB::transaction(function () use ($companyId, $productId, $warehouseId) {
            DB::table('stock_balances')->insertOrIgnore([
                'company_id' => $companyId, 'product_id' => $productId, 'warehouse_id' => $warehouseId,
                'quantity' => 0, 'avg_cost' => 0, 'total_value' => 0, 'created_at' => now(), 'updated_at' => now(),
            ]);

            $balance = StockBalance::query()->withoutGlobalScopes()
                ->where('product_id', $productId)->where('warehouse_id', $warehouseId)
                ->lockForUpdate()->firstOrFail();

            $movements = DB::table('stock_movements')->where('product_id', $productId)->where('warehouse_id', $warehouseId);
            $last = (clone $movements)->orderByDesc('id')->first();

            $balance->forceFill([
                'quantity' => (string) ((clone $movements)->sum('quantity') ?: '0'),
                'avg_cost' => $last->avg_cost_after ?? $balance->avg_cost,
                'total_value' => $last->value_after ?? '0',
                'last_movement_id' => $last?->id,
            ])->save();
        });
    }

    /**
     * @return array{type: string, product_id: int, warehouse_id: int, detail: string}
     */
    private function issue(string $type, object $row, string $detail): array
    {
        return ['type' => $type, 'product_id' => (int) $row->product_id, 'warehouse_id' => (int) $row->warehouse_id, 'detail' => $detail];
    }
}
