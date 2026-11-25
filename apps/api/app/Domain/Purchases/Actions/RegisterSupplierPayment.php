<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Purchases\Data\SupplierPaymentData;
use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\Models\SupplierPayment;
use App\Domain\Purchases\Services\SupplierPaymentWriter;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Registers a payment to a supplier (PAG-), applied to the given receipts or
 * FIFO by due date. It cannot exceed the open debt (no advances yet; cash
 * and bank accounts arrive in Phase 4). Lock order: supplier -> receipts.
 */
class RegisterSupplierPayment
{
    public function __construct(
        private readonly SupplierPaymentWriter $writer,
        private readonly DocumentDateWindow $dates,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(SupplierPaymentData $data, User $actor): SupplierPayment
    {
        $amount = Decimal::of($data->amount)->round(2);
        $errors = $this->dates->errors($actor->company, $data->paymentDate, 'payment_date');
        if ($amount <= 0) {
            $errors['amount'] = ['El monto del pago debe ser mayor a 0.'];
        }
        if ($errors !== []) {
            throw new PurchaseException($errors);
        }

        return DB::transaction(function () use ($data, $actor, $amount) {
            $supplier = Supplier::query()->lockForUpdate()->findOrFail($data->supplierId);

            if ($data->idempotencyKey !== null && ($existing = SupplierPayment::query()->where('idempotency_key', $data->idempotencyKey)->first())) {
                return $existing->load('allocations');
            }

            $open = PurchaseReceipt::query()
                ->where('supplier_id', $supplier->id)
                ->where('status', PaymentStatus::Posted)
                ->whereColumn('paid_amount', '<', 'invoice_total')
                ->orderBy('due_date')->orderBy('id')
                ->lockForUpdate()
                ->get();

            $allocations = $data->allocations === null ? $this->fifo($open, $amount) : $this->explicit($open, $data->allocations, $amount);
            $payment = $this->writer->create($supplier, $data->paymentDate, $data->method, $allocations, $actor,
                reference: $data->reference, notes: $data->notes, idempotencyKey: $data->idempotencyKey);

            $this->audit->log('payables.payment.registered', actor: $actor, auditable: $payment, new: [
                'number' => $payment->number,
                'supplier_id' => $supplier->id,
                'amount' => $payment->amount,
                'method' => $payment->method->value,
                'allocations' => array_map(fn (array $a) => ['purchase_receipt_id' => $a[0]->id, 'amount' => Decimal::money($a[1])], $allocations),
            ]);

            return $payment->load('allocations');
        });
    }

    /**
     * @param  Collection<int, PurchaseReceipt>  $open
     * @return list<array{0: PurchaseReceipt, 1: Number}>
     */
    private function fifo(Collection $open, Number $amount): array
    {
        $debt = $open->reduce(fn (Number $s, PurchaseReceipt $r) => $s + $r->openAmount(), new Number('0'));
        if ($amount > $debt) {
            throw PurchaseException::with(['amount' => sprintf(
                'El pago (%s) supera la deuda pendiente con el proveedor (%s).', Decimal::money($amount), Decimal::money($debt),
            )], 'payment_exceeds_debt');
        }

        $remaining = $amount;
        $allocations = [];
        foreach ($open as $receipt) {
            if ($remaining <= 0) {
                break;
            }
            $applied = $receipt->openAmount() < $remaining ? $receipt->openAmount() : $remaining;
            $allocations[] = [$receipt, $applied];
            $remaining -= $applied;
        }

        return $allocations;
    }

    /**
     * @param  Collection<int, PurchaseReceipt>  $open
     * @param  array<int, string>  $requested
     * @return list<array{0: PurchaseReceipt, 1: Number}>
     */
    private function explicit(Collection $open, array $requested, Number $amount): array
    {
        $byId = $open->keyBy('id');
        $errors = [];
        $allocations = [];
        $sum = new Number('0');
        foreach ($requested as $id => $value) {
            $applied = Decimal::of($value)->round(2);
            $receipt = $byId->get($id);
            if ($receipt === null || $applied <= 0 || $applied > $receipt->openAmount()) {
                $errors["allocations.{$id}"] = ['La recepción no existe, ya está pagada o el monto supera su saldo.'];
            } else {
                $allocations[] = [$receipt, $applied];
            }
            $sum += $applied;
        }
        if ($errors === [] && $sum != $amount) {
            $errors['amount'] = ['La suma aplicada a las recepciones debe ser igual al monto del pago.'];
        }
        if ($errors !== []) {
            throw new PurchaseException($errors);
        }

        return $allocations;
    }
}
