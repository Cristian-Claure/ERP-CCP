<?php

namespace App\Domain\Purchases\Services;

use App\Domain\Sales\Enums\PaymentStatus;
use Illuminate\Support\Facades\DB;

/**
 * Integrity check of accounts payable and purchase orders (mirror of
 * CustomerVerifier):
 *
 * - balance_mismatch:   suppliers.balance != SUM(ledger.amount)
 * - running_mismatch:   last ledger balance_after != suppliers.balance
 * - paid_mismatch:      receipts.paid_amount != SUM(allocations of posted payments)
 * - received_mismatch:  OC line received_quantity != SUM(posted receipt lines)
 * - missing_charge / missing_reversal: posted/voided receipts or voided payments without their entry
 *
 * The ledger is immutable: repair() only rebuilds the derived caches.
 */
class SupplierVerifier
{
    public const REPAIRABLE = ['balance_mismatch', 'running_mismatch', 'paid_mismatch', 'received_mismatch'];

    /**
     * @return list<array{type: string, reference: string, detail: string}>
     */
    public function verify(int $companyId): array
    {
        $issues = [];

        foreach ($this->balanceRows($companyId) as $r) {
            if (bccomp((string) $r->balance, (string) $r->ledger_sum, 2) !== 0) {
                $issues[] = $this->issue('balance_mismatch', "proveedor #{$r->id}", "saldo {$r->balance} vs ledger {$r->ledger_sum}");
            }
            if ($r->last_balance_after !== null && bccomp((string) $r->balance, (string) $r->last_balance_after, 2) !== 0) {
                $issues[] = $this->issue('running_mismatch', "proveedor #{$r->id}", "saldo {$r->balance} vs último saldo acumulado {$r->last_balance_after}");
            }
        }

        foreach ($this->paidRows($companyId) as $r) {
            if (bccomp((string) $r->paid_amount, (string) $r->allocated, 2) !== 0) {
                $issues[] = $this->issue('paid_mismatch', $r->number, "pagado {$r->paid_amount} vs asignado {$r->allocated}");
            }
        }

        foreach ($this->receivedRows($companyId) as $r) {
            $issues[] = $this->issue('received_mismatch', "{$r->number} línea #{$r->id}", "recibido {$r->received_quantity} vs recepciones {$r->received_sum}");
        }

        foreach ($this->missingEntries($companyId) as $r) {
            $issues[] = $this->issue($r->issue, $r->number, 'falta el asiento en el ledger de proveedores');
        }

        return $issues;
    }

    public function repair(int $companyId): void
    {
        DB::transaction(function () use ($companyId) {
            DB::update(<<<'SQL'
                UPDATE suppliers s
                SET balance = COALESCE((SELECT SUM(e.amount) FROM supplier_ledger_entries e WHERE e.supplier_id = s.id), 0),
                    updated_at = NOW()
                WHERE s.company_id = ?
            SQL, [$companyId]);

            DB::update(<<<'SQL'
                UPDATE purchase_receipts r
                SET paid_amount = COALESCE((
                        SELECT SUM(a.amount) FROM supplier_payment_allocations a
                        JOIN supplier_payments p ON p.id = a.payment_id AND p.status = ?
                        WHERE a.purchase_receipt_id = r.id), 0),
                    updated_at = NOW()
                WHERE r.company_id = ?
            SQL, [PaymentStatus::Posted->value, $companyId]);

            DB::update(<<<'SQL'
                UPDATE purchase_order_lines l
                SET received_quantity = COALESCE((
                        SELECT SUM(rl.quantity) FROM purchase_receipt_lines rl
                        JOIN purchase_receipts r ON r.id = rl.purchase_receipt_id AND r.status = 'posted'
                        WHERE rl.purchase_order_line_id = l.id), 0),
                    updated_at = NOW()
                WHERE l.company_id = ?
            SQL, [$companyId]);
        });
    }

    /** @return list<object> */
    private function balanceRows(int $companyId): array
    {
        return DB::select(<<<'SQL'
            SELECT s.id, s.balance,
                   COALESCE((SELECT SUM(e.amount) FROM supplier_ledger_entries e WHERE e.supplier_id = s.id), 0) AS ledger_sum,
                   (SELECT e.balance_after FROM supplier_ledger_entries e WHERE e.supplier_id = s.id ORDER BY e.id DESC LIMIT 1) AS last_balance_after
            FROM suppliers s
            WHERE s.company_id = ?
        SQL, [$companyId]);
    }

    /** @return list<object> */
    private function paidRows(int $companyId): array
    {
        return DB::select(<<<'SQL'
            SELECT r.id, r.number, r.paid_amount,
                   COALESCE((SELECT SUM(a.amount) FROM supplier_payment_allocations a
                             JOIN supplier_payments p ON p.id = a.payment_id AND p.status = ?
                             WHERE a.purchase_receipt_id = r.id), 0) AS allocated
            FROM purchase_receipts r
            WHERE r.company_id = ?
        SQL, [PaymentStatus::Posted->value, $companyId]);
    }

    /** @return list<object> */
    private function receivedRows(int $companyId): array
    {
        return DB::select(<<<'SQL'
            SELECT l.id, o.number, l.received_quantity, t.received_sum FROM purchase_order_lines l
            JOIN purchase_orders o ON o.id = l.purchase_order_id
            CROSS JOIN LATERAL (
                SELECT COALESCE(SUM(rl.quantity), 0) AS received_sum FROM purchase_receipt_lines rl
                JOIN purchase_receipts r ON r.id = rl.purchase_receipt_id AND r.status = 'posted'
                WHERE rl.purchase_order_line_id = l.id
            ) t
            WHERE l.company_id = ? AND l.received_quantity <> t.received_sum
        SQL, [$companyId]);
    }

    /** @return list<object> */
    private function missingEntries(int $companyId): array
    {
        return DB::select(<<<'SQL'
            SELECT 'missing_charge' AS issue, r.number FROM purchase_receipts r
            WHERE r.company_id = ?
              AND NOT EXISTS (SELECT 1 FROM supplier_ledger_entries e WHERE e.source_type = 'purchase_receipt' AND e.source_id = r.id AND e.kind = 'charge')
            UNION ALL
            SELECT 'missing_reversal', r.number FROM purchase_receipts r
            WHERE r.company_id = ? AND r.status = 'voided'
              AND NOT EXISTS (SELECT 1 FROM supplier_ledger_entries e WHERE e.source_type = 'purchase_receipt' AND e.source_id = r.id AND e.kind = 'reversal')
            UNION ALL
            SELECT 'missing_reversal', p.number FROM supplier_payments p
            WHERE p.company_id = ? AND p.status = 'voided'
              AND NOT EXISTS (SELECT 1 FROM supplier_ledger_entries e WHERE e.source_type = 'supplier_payment' AND e.source_id = p.id AND e.kind = 'reversal')
        SQL, [$companyId, $companyId, $companyId]);
    }

    /** @return array{type: string, reference: string, detail: string} */
    private function issue(string $type, string $reference, string $detail): array
    {
        return ['type' => $type, 'reference' => $reference, 'detail' => $detail];
    }
}
