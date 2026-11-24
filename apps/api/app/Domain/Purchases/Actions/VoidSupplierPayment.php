<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\Models\SupplierPayment;
use App\Domain\Purchases\Services\SupplierPaymentWriter;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentDateWindow;
use Illuminate\Support\Facades\DB;

/** Voids a supplier payment (supplier -> payment -> receipts). Idempotent. */
class VoidSupplierPayment
{
    public const MIN_REASON_LENGTH = 5;

    public function __construct(
        private readonly SupplierPaymentWriter $writer,
        private readonly DocumentDateWindow $dates,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(SupplierPayment $payment, User $actor, string $reason): SupplierPayment
    {
        if (mb_strlen(trim($reason)) < self::MIN_REASON_LENGTH) {
            throw PurchaseException::with(['reason' => sprintf('El motivo de anulación es obligatorio (mínimo %d caracteres).', self::MIN_REASON_LENGTH)]);
        }

        return DB::transaction(function () use ($payment, $actor, $reason) {
            $supplier = Supplier::query()->lockForUpdate()->findOrFail($payment->supplier_id);
            $locked = SupplierPayment::query()->lockForUpdate()->findOrFail($payment->id);
            if ($locked->status === PaymentStatus::Voided) {
                return $locked->load('allocations');
            }

            $this->writer->void($supplier, $locked, $this->dates->today($actor->company), $actor, trim($reason));
            $this->audit->log('payables.payment.voided', actor: $actor, auditable: $locked, old: ['status' => 'posted'], new: [
                'status' => 'voided',
                'number' => $locked->number,
                'reason' => trim($reason),
            ]);

            return $locked->load('allocations');
        });
    }
}
