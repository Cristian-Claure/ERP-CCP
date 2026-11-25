<?php

namespace App\Domain\Purchases\Services;

use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\Models\SupplierPayment;
use App\Domain\Purchases\Models\SupplierPaymentAllocation;
use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\DocumentNumberer;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Carbon\CarbonInterface;

/**
 * Writes and voids supplier payments (PAG-): payment row, allocations, the
 * receipts' paid_amount cache and the supplier ledger entry (mirror of
 * ReceiptWriter). The caller holds the SUPPLIER lock first.
 */
class SupplierPaymentWriter
{
    public const SEQUENCE_KEY = 'purchases.payment';

    public const PREFIX = 'PAG';

    public function __construct(
        private readonly DocumentNumberer $numberer,
        private readonly SupplierLedger $ledger,
    ) {}

    /**
     * @param  list<array{0: PurchaseReceipt, 1: Number}>  $allocations  locked receipts and the amount applied to each
     */
    public function create(
        Supplier $supplier,
        CarbonInterface $date,
        PaymentMethod $method,
        array $allocations,
        User $actor,
        ?string $reference = null,
        ?string $notes = null,
        ?string $idempotencyKey = null,
    ): SupplierPayment {
        $amount = array_reduce($allocations, fn (Number $sum, array $a) => $sum + $a[1], new Number('0'));

        $payment = SupplierPayment::query()->create([
            'company_id' => $supplier->company_id,
            'supplier_id' => $supplier->id,
            'number' => $this->numberer->next($supplier->company_id, self::SEQUENCE_KEY, self::PREFIX),
            'payment_date' => $date->format('Y-m-d'),
            'method' => $method,
            'amount' => Decimal::money($amount),
            'reference' => $reference,
            'notes' => $notes,
            'idempotency_key' => $idempotencyKey,
            'created_by' => $actor->id,
        ]);

        foreach ($allocations as [$receipt, $applied]) {
            SupplierPaymentAllocation::query()->create([
                'company_id' => $supplier->company_id,
                'payment_id' => $payment->id,
                'purchase_receipt_id' => $receipt->id,
                'amount' => Decimal::money($applied),
            ]);
            $receipt->forceFill(['paid_amount' => Decimal::money(Decimal::of($receipt->paid_amount) + $applied)])->save();
        }

        $this->ledger->payment($supplier, $payment, $actor->id);

        return $payment;
    }

    /** Voids a posted payment: releases its allocations and reverses its ledger entry. */
    public function void(Supplier $supplier, SupplierPayment $payment, CarbonInterface $date, User $actor, string $reason): SupplierPayment
    {
        $payment->load('allocations');
        $receipts = PurchaseReceipt::query()
            ->whereIn('id', $payment->allocations->pluck('purchase_receipt_id'))
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        foreach ($payment->allocations as $allocation) {
            $receipt = $receipts[$allocation->purchase_receipt_id];
            $receipt->forceFill(['paid_amount' => Decimal::money(Decimal::of($receipt->paid_amount) - Decimal::of($allocation->amount))])->save();
        }

        $this->ledger->reverse($supplier, $payment, $date, sprintf('Anulación del pago %s', $payment->number), $actor->id);

        $payment->forceFill([
            'status' => PaymentStatus::Voided,
            'voided_by' => $actor->id,
            'voided_at' => now(),
            'void_reason' => $reason,
        ])->save();

        return $payment;
    }
}
