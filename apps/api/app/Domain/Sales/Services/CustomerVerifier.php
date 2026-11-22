<?php

namespace App\Domain\Sales\Services;

use App\Domain\Sales\Enums\PaymentStatus;
use Illuminate\Support\Facades\DB;

/**
 * Integrity check of accounts receivable (same pattern as InventoryVerifier):
 *
 * - balance_mismatch:  customers.balance != SUM(ledger.amount)
 * - running_mismatch:  last ledger balance_after != customers.balance
 * - paid_mismatch:     sales.paid_amount != SUM(allocations of posted payments)
 * - missing_charge:    posted/voided sale without its charge entry
 * - missing_reversal:  voided sale (or payment) without its reversal entry
 *
 * The ledger is immutable: repair() only rebuilds the derived caches
 * (customers.balance, sales_documents.paid_amount).
 */
class CustomerVerifier
{
    public const REPAIRABLE = ['balance_mismatch', 'running_mismatch', 'paid_mismatch'];

    /**
     * @return list<array{type: string, reference: string, detail: string}>
     */
    public function verify(int $companyId): array
    {
        $issues = [];

        foreach ($this->balanceRows($companyId) as $r) {
            if (bccomp((string) $r->balance, (string) $r->ledger_sum, 2) !== 0) {
                $issues[] = $this->issue('balance_mismatch', "cliente #{$r->id}", "saldo {$r->balance} vs ledger {$r->ledger_sum}");
            }
            if ($r->last_balance_after !== null && bccomp((string) $r->balance, (string) $r->last_balance_after, 2) !== 0) {
                $issues[] = $this->issue('running_mismatch', "cliente #{$r->id}", "saldo {$r->balance} vs último saldo acumulado {$r->last_balance_after}");
            }
        }

        foreach ($this->paidRows($companyId) as $r) {
            if (bccomp((string) $r->paid_amount, (string) $r->allocated, 2) !== 0) {
                $issues[] = $this->issue('paid_mismatch', $r->number ?? "venta #{$r->id}", "pagado {$r->paid_amount} vs asignado {$r->allocated}");
            }
        }

        foreach ($this->missingEntries($companyId) as $r) {
            $issues[] = $this->issue($r->issue, $r->number ?? "#{$r->id}", 'falta el asiento en el ledger de clientes');
        }

        return $issues;
    }

    public function repair(int $companyId): void
    {
        DB::transaction(function () use ($companyId) {
            DB::update(<<<'SQL'
                UPDATE customers c
                SET balance = COALESCE((SELECT SUM(e.amount) FROM customer_ledger_entries e WHERE e.customer_id = c.id), 0),
                    updated_at = NOW()
                WHERE c.company_id = ?
            SQL, [$companyId]);

            DB::update(<<<'SQL'
                UPDATE sales_documents s
                SET paid_amount = COALESCE((
                        SELECT SUM(a.amount) FROM payment_allocations a
                        JOIN customer_payments p ON p.id = a.payment_id AND p.status = ?
                        WHERE a.sales_document_id = s.id), 0),
                    updated_at = NOW()
                WHERE s.company_id = ?
            SQL, [PaymentStatus::Posted->value, $companyId]);
        });
    }

    /**
     * @return list<object>
     */
    private function balanceRows(int $companyId): array
    {
        return DB::select(<<<'SQL'
            SELECT c.id, c.balance,
                   COALESCE((SELECT SUM(e.amount) FROM customer_ledger_entries e WHERE e.customer_id = c.id), 0) AS ledger_sum,
                   (SELECT e.balance_after FROM customer_ledger_entries e WHERE e.customer_id = c.id ORDER BY e.id DESC LIMIT 1) AS last_balance_after
            FROM customers c
            WHERE c.company_id = ?
        SQL, [$companyId]);
    }

    /**
     * @return list<object>
     */
    private function paidRows(int $companyId): array
    {
        return DB::select(<<<'SQL'
            SELECT s.id, s.number, s.paid_amount,
                   COALESCE((SELECT SUM(a.amount) FROM payment_allocations a
                             JOIN customer_payments p ON p.id = a.payment_id AND p.status = ?
                             WHERE a.sales_document_id = s.id), 0) AS allocated
            FROM sales_documents s
            WHERE s.company_id = ? AND s.type <> 'quote'
        SQL, [PaymentStatus::Posted->value, $companyId]);
    }

    /**
     * @return list<object>
     */
    private function missingEntries(int $companyId): array
    {
        return DB::select(<<<'SQL'
            SELECT 'missing_charge' AS issue, s.id, s.number FROM sales_documents s
            WHERE s.company_id = ? AND s.type <> 'quote' AND s.status IN ('posted', 'voided')
              AND NOT EXISTS (SELECT 1 FROM customer_ledger_entries e WHERE e.source_type = 'sales_document' AND e.source_id = s.id AND e.kind = 'charge')
            UNION ALL
            SELECT 'missing_reversal', s.id, s.number FROM sales_documents s
            WHERE s.company_id = ? AND s.type <> 'quote' AND s.status = 'voided'
              AND NOT EXISTS (SELECT 1 FROM customer_ledger_entries e WHERE e.source_type = 'sales_document' AND e.source_id = s.id AND e.kind = 'reversal')
            UNION ALL
            SELECT 'missing_reversal', p.id, p.number FROM customer_payments p
            WHERE p.company_id = ? AND p.status = 'voided'
              AND NOT EXISTS (SELECT 1 FROM customer_ledger_entries e WHERE e.source_type = 'customer_payment' AND e.source_id = p.id AND e.kind = 'reversal')
        SQL, [$companyId, $companyId, $companyId]);
    }

    /**
     * @return array{type: string, reference: string, detail: string}
     */
    private function issue(string $type, string $reference, string $detail): array
    {
        return ['type' => $type, 'reference' => $reference, 'detail' => $detail];
    }
}
