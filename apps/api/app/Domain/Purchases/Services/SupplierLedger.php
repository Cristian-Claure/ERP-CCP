<?php

namespace App\Domain\Purchases\Services;

use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\Models\SupplierLedgerEntry;
use App\Domain\Purchases\Models\SupplierPayment;
use App\Domain\Sales\Enums\LedgerEntryKind;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * The only writer of supplier_ledger_entries and suppliers.balance (mirror of
 * CustomerLedger). The caller MUST run inside a transaction holding the
 * supplier row lock: balance_after is computed from the locked balance.
 */
class SupplierLedger
{
    /** Receipt posted: we owe the supplier its invoice total. */
    public function charge(Supplier $supplier, PurchaseReceipt $receipt, int $userId): SupplierLedgerEntry
    {
        return $this->record($supplier, LedgerEntryKind::Charge, Decimal::of($receipt->invoice_total), $receipt,
            $receipt->receipt_date, $receipt->due_date, $this->receiptLabel($receipt), $userId);
    }

    public function payment(Supplier $supplier, SupplierPayment $payment, int $userId): SupplierLedgerEntry
    {
        return $this->record($supplier, LedgerEntryKind::Payment, Decimal::of($payment->amount) * -1, $payment,
            $payment->payment_date, null, sprintf('Pago %s (%s)', $payment->number, $payment->method->label()), $userId);
    }

    /** Undoes the original entry of a receipt or payment with the opposite sign. */
    public function reverse(Supplier $supplier, PurchaseReceipt|SupplierPayment $source, CarbonInterface $date, string $description, int $userId): SupplierLedgerEntry
    {
        /** @var SupplierLedgerEntry $original */
        $original = SupplierLedgerEntry::query()
            ->where('source_type', $source->getMorphClass())
            ->where('source_id', $source->getKey())
            ->whereIn('kind', [LedgerEntryKind::Charge, LedgerEntryKind::Payment])
            ->firstOrFail();

        return $this->record($supplier, LedgerEntryKind::Reversal, Decimal::of($original->amount) * -1, $source,
            $date, null, $description, $userId);
    }

    private function receiptLabel(PurchaseReceipt $receipt): string
    {
        return $receipt->supplier_invoice_number
            ? sprintf('Recepción %s · factura %s', $receipt->number, $receipt->supplier_invoice_number)
            : sprintf('Recepción %s', $receipt->number);
    }

    private function record(
        Supplier $supplier,
        LedgerEntryKind $kind,
        Number $amount,
        Model $source,
        CarbonInterface $date,
        ?CarbonInterface $dueDate,
        string $description,
        int $userId,
    ): SupplierLedgerEntry {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('SupplierLedger must run inside a database transaction.');
        }

        $balance = (Decimal::of($supplier->balance) + $amount)->round(2);

        $entry = SupplierLedgerEntry::query()->create([
            'company_id' => $supplier->company_id,
            'supplier_id' => $supplier->id,
            'kind' => $kind,
            'amount' => Decimal::money($amount),
            'balance_after' => Decimal::money($balance),
            'entry_date' => $date->format('Y-m-d'),
            'due_date' => $dueDate?->format('Y-m-d'),
            'source_type' => $source->getMorphClass(),
            'source_id' => $source->getKey(),
            'description' => $description,
            'created_by' => $userId,
        ]);

        $supplier->forceFill(['balance' => Decimal::money($balance)])->save();

        return $entry;
    }
}
