<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Sales\Events\PaymentVoided;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\CustomerPayment;
use App\Domain\Sales\Services\ReceiptWriter;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentDateWindow;
use Illuminate\Support\Facades\DB;

/**
 * Voids a manual receipt: its allocations stop counting and its ledger
 * entry is reversed. Automatic receipts of cash sales are voided only by
 * voiding the sale. The customer lock is taken first (as in every sales
 * write), which serializes all work on that customer. Idempotent.
 */
class VoidPayment
{
    public const MIN_REASON_LENGTH = 5;

    public function __construct(
        private readonly ReceiptWriter $receipts,
        private readonly DocumentDateWindow $dates,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(CustomerPayment $payment, User $actor, string $reason): CustomerPayment
    {
        $reason = trim($reason);

        return DB::transaction(function () use ($payment, $actor, $reason) {
            $customerId = CustomerPayment::query()->whereKey($payment->id)->value('customer_id');
            $customer = Customer::query()->lockForUpdate()->findOrFail($customerId);
            /** @var CustomerPayment $locked */
            $locked = CustomerPayment::query()->lockForUpdate()->findOrFail($payment->id);

            if ($locked->status === PaymentStatus::Voided) {
                return $locked->load('allocations');
            }

            if ($locked->isAutomatic()) {
                throw InvalidSalesDocumentException::state('Este cobro se generó con una venta al contado: se anula anulando la venta.');
            }

            if (mb_strlen($reason) < self::MIN_REASON_LENGTH) {
                throw InvalidSalesDocumentException::with(['reason' => sprintf('El motivo de anulación es obligatorio (mínimo %d caracteres).', self::MIN_REASON_LENGTH)]);
            }

            $this->receipts->void($customer, $locked, $this->dates->today($actor->company), $actor, $reason);

            $this->audit->log('receivables.payment.voided', actor: $actor, auditable: $locked, old: [
                'status' => PaymentStatus::Posted->value,
            ], new: [
                'status' => PaymentStatus::Voided->value,
                'number' => $locked->number,
                'amount' => $locked->amount,
                'reason' => $reason,
            ]);

            PaymentVoided::dispatch($locked);

            return $locked->load('allocations');
        });
    }
}
