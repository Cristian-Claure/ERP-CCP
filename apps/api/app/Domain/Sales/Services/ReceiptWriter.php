<?php

namespace App\Domain\Sales\Services;

use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\CustomerPayment;
use App\Domain\Sales\Models\PaymentAllocation;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\DocumentNumberer;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Carbon\CarbonInterface;

/**
 * Writes and voids receipts (COB-): payment row, allocations, the sales'
 * paid_amount cache and the customer ledger entry.
 *
 * The caller must hold the CUSTOMER lock first (every sales write takes it
 * first, so work on one customer is serialized and cannot deadlock).
 */
class ReceiptWriter
{
    public const SEQUENCE_KEY = 'sales.payment';

    public const PREFIX = 'COB';

    public function __construct(
        private readonly DocumentNumberer $numberer,
        private readonly CustomerLedger $ledger,
    ) {}

    /**
     * @param  list<array{0: SalesDocument, 1: Number}>  $allocations  locked sales and the amount applied to each
     */
    public function create(
        Customer $customer,
        CarbonInterface $date,
        PaymentMethod $method,
        array $allocations,
        User $actor,
        ?string $reference = null,
        ?string $notes = null,
        ?SalesDocument $automaticFor = null,
        ?string $idempotencyKey = null,
    ): CustomerPayment {
        $amount = array_reduce($allocations, fn (Number $sum, array $a) => $sum + $a[1], new Number('0'));

        $payment = CustomerPayment::query()->create([
            'company_id' => $customer->company_id,
            'customer_id' => $customer->id,
            'number' => $this->numberer->next($customer->company_id, self::SEQUENCE_KEY, self::PREFIX),
            'payment_date' => $date->format('Y-m-d'),
            'method' => $method,
            'amount' => Decimal::money($amount),
            'reference' => $reference,
            'notes' => $notes,
            'sales_document_id' => $automaticFor?->id,
            'idempotency_key' => $idempotencyKey,
            'created_by' => $actor->id,
        ]);

        foreach ($allocations as [$sale, $applied]) {
            PaymentAllocation::query()->create([
                'company_id' => $customer->company_id,
                'payment_id' => $payment->id,
                'sales_document_id' => $sale->id,
                'amount' => Decimal::money($applied),
            ]);
            $sale->forceFill(['paid_amount' => Decimal::money(Decimal::of($sale->paid_amount) + $applied)])->save();
        }

        $this->ledger->payment($customer, $payment, $actor->id);

        return $payment;
    }

    /**
     * Voids a posted receipt: releases its allocations and reverses its
     * ledger entry. Expects the payment and the customer locked.
     */
    public function void(Customer $customer, CustomerPayment $payment, CarbonInterface $date, User $actor, string $reason): CustomerPayment
    {
        $payment->load('allocations');
        $sales = SalesDocument::query()
            ->whereIn('id', $payment->allocations->pluck('sales_document_id'))
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        foreach ($payment->allocations as $allocation) {
            $sale = $sales[$allocation->sales_document_id];
            $sale->forceFill(['paid_amount' => Decimal::money(Decimal::of($sale->paid_amount) - Decimal::of($allocation->amount))])->save();
        }

        $this->ledger->reverse($customer, $payment, $date, sprintf('Anulación del cobro %s', $payment->number), $actor->id);

        $payment->forceFill([
            'status' => PaymentStatus::Voided,
            'voided_by' => $actor->id,
            'voided_at' => now(),
            'void_reason' => $reason,
        ])->save();

        return $payment;
    }
}
