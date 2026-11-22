<?php

namespace App\Domain\Sales\Services;

use App\Domain\Sales\Enums\LedgerEntryKind;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\CustomerLedgerEntry;
use App\Domain\Sales\Models\CustomerPayment;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * The only writer of customer_ledger_entries and customers.balance.
 *
 * The caller MUST run inside a transaction and hold the customer row lock
 * (lockForUpdate): balance_after is computed from the locked balance.
 */
class CustomerLedger
{
    /** Sale posted: the customer owes its total (cash sales are paid right after). */
    public function charge(Customer $customer, SalesDocument $sale, int $userId): CustomerLedgerEntry
    {
        return $this->record(
            $customer,
            LedgerEntryKind::Charge,
            Decimal::of($sale->total),
            $sale,
            $sale->document_date,
            $sale->due_date,
            sprintf('%s %s', $sale->type->label(), $sale->number),
            $userId,
        );
    }

    public function payment(Customer $customer, CustomerPayment $payment, int $userId): CustomerLedgerEntry
    {
        return $this->record(
            $customer,
            LedgerEntryKind::Payment,
            Decimal::of($payment->amount) * -1,
            $payment,
            $payment->payment_date,
            null,
            sprintf('Cobro %s (%s)', $payment->number, $payment->method->label()),
            $userId,
        );
    }

    /**
     * Undoes the original entry of $source (charge of a sale or payment
     * entry of a receipt) with an entry of the opposite sign.
     */
    public function reverse(Customer $customer, SalesDocument|CustomerPayment $source, CarbonInterface $date, string $description, int $userId): CustomerLedgerEntry
    {
        /** @var CustomerLedgerEntry $original */
        $original = CustomerLedgerEntry::query()
            ->where('source_type', $source->getMorphClass())
            ->where('source_id', $source->getKey())
            ->whereIn('kind', [LedgerEntryKind::Charge, LedgerEntryKind::Payment])
            ->firstOrFail();

        return $this->record(
            $customer,
            LedgerEntryKind::Reversal,
            Decimal::of($original->amount) * -1,
            $source,
            $date,
            null,
            $description,
            $userId,
        );
    }

    private function record(
        Customer $customer,
        LedgerEntryKind $kind,
        Number $amount,
        Model $source,
        CarbonInterface $date,
        ?CarbonInterface $dueDate,
        string $description,
        int $userId,
    ): CustomerLedgerEntry {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('CustomerLedger must run inside a database transaction.');
        }

        $balance = (Decimal::of($customer->balance) + $amount)->round(2);

        $entry = CustomerLedgerEntry::query()->create([
            'company_id' => $customer->company_id,
            'customer_id' => $customer->id,
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

        $customer->forceFill(['balance' => Decimal::money($balance)])->save();

        return $entry;
    }
}
