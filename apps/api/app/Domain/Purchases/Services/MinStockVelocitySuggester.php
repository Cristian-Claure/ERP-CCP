<?php

namespace App\Domain\Purchases\Services;

use App\Domain\Purchases\Contracts\PurchaseSuggestionProvider;
use App\Domain\Purchases\Data\PurchaseSuggestion;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Phase 3 heuristic, per product and warehouse:
 *
 *   suggested = min_stock + daily_sales × lead_time − stock − on_order
 *
 * daily_sales: posted sales of the last 30 days in that warehouse / 30.
 * lead_time: of the product's last supplier (last posted receipt), 7 days if none.
 * on_order: pending quantity of approved / partially received OCs (avoids ordering twice).
 * Whole units are rounded up; fractional units to 2 decimals.
 */
class MinStockVelocitySuggester implements PurchaseSuggestionProvider
{
    public const WINDOW_DAYS = 30;

    public const DEFAULT_LEAD_TIME = 7;

    public function suggest(int $companyId, ?int $warehouseId = null, ?int $supplierId = null): array
    {
        $since = CarbonImmutable::now(Company::query()->findOrFail($companyId)->timezone)->subDays(self::WINDOW_DAYS)->toDateString();
        $out = [];

        foreach ($this->rows($companyId, $since, $warehouseId, $supplierId) as $r) {
            $daily = Decimal::of((string) $r->sold)->div(new Number((string) self::WINDOW_DAYS), 4);
            $lead = (int) ($r->lead_time ?? self::DEFAULT_LEAD_TIME);
            $need = Decimal::of((string) $r->min_stock) + $daily * new Number((string) $lead)
                - Decimal::of((string) $r->stock) - Decimal::of((string) $r->on_order);
            if ($need <= 0) {
                continue;
            }
            $qty = $r->allows_decimals ? $need->round(2) : $need->ceil();

            $out[] = new PurchaseSuggestion(
                productId: (int) $r->product_id, sku: $r->sku, productName: $r->name, unit: $r->unit,
                warehouseId: (int) $r->warehouse_id, warehouseName: $r->warehouse,
                stock: (string) $r->stock, minStock: (string) $r->min_stock, dailySales: (string) $daily->round(2),
                leadTimeDays: $lead, onOrder: (string) $r->on_order, suggestedQuantity: (string) $qty,
                supplierId: $r->supplier_id ? (int) $r->supplier_id : null, supplierName: $r->supplier_name,
                lastPrice: $r->last_price !== null ? (string) $r->last_price : null, method: 'min_stock_velocity',
            );
        }

        return $out;
    }

    /** @return list<object> */
    private function rows(int $companyId, string $since, ?int $warehouseId, ?int $supplierId): array
    {
        return DB::select(<<<'SQL'
            WITH sold AS (
                SELECT d.warehouse_id, l.product_id, SUM(l.quantity) AS qty
                FROM sales_document_lines l JOIN sales_documents d ON d.id = l.document_id
                WHERE d.company_id = ? AND d.status = 'posted' AND d.type <> 'quote' AND d.document_date >= ?
                GROUP BY d.warehouse_id, l.product_id
            ), on_order AS (
                SELECT o.warehouse_id, l.product_id, SUM(GREATEST(l.quantity - l.received_quantity, 0)) AS qty
                FROM purchase_order_lines l JOIN purchase_orders o ON o.id = l.purchase_order_id
                WHERE o.company_id = ? AND o.status IN ('approved', 'partially_received')
                GROUP BY o.warehouse_id, l.product_id
            ), last_purchase AS (
                SELECT DISTINCT ON (rl.product_id) rl.product_id, r.supplier_id, rl.unit_price
                FROM purchase_receipt_lines rl JOIN purchase_receipts r ON r.id = rl.purchase_receipt_id AND r.status = 'posted'
                WHERE r.company_id = ?
                ORDER BY rl.product_id, r.receipt_date DESC, r.id DESC
            )
            SELECT p.id AS product_id, p.sku, p.name, u.code AS unit, u.allows_decimals, w.id AS warehouse_id, w.name AS warehouse,
                   COALESCE(b.quantity, 0) AS stock, p.min_stock, COALESCE(s.qty, 0) AS sold, COALESCE(oo.qty, 0) AS on_order,
                   lp.supplier_id, sp.name AS supplier_name, sp.lead_time_days AS lead_time, lp.unit_price AS last_price
            FROM products p
            JOIN warehouses w ON w.company_id = p.company_id AND w.is_active
            JOIN units u ON u.id = p.unit_id
            LEFT JOIN stock_balances b ON b.product_id = p.id AND b.warehouse_id = w.id
            LEFT JOIN sold s ON s.product_id = p.id AND s.warehouse_id = w.id
            LEFT JOIN on_order oo ON oo.product_id = p.id AND oo.warehouse_id = w.id
            LEFT JOIN last_purchase lp ON lp.product_id = p.id
            LEFT JOIN suppliers sp ON sp.id = lp.supplier_id
            WHERE p.company_id = ? AND p.is_active
              AND (CAST(? AS bigint) IS NULL OR w.id = CAST(? AS bigint))
              AND (CAST(? AS bigint) IS NULL OR lp.supplier_id = CAST(? AS bigint))
            ORDER BY w.id, p.name
        SQL, [$companyId, $since, $companyId, $companyId, $companyId, $warehouseId, $warehouseId, $supplierId, $supplierId]);
    }
}
