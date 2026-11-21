<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Sales\Data\PaymentData;
use App\Domain\Sales\Enums\SalesDocumentStatus;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Events\PaymentRegistered;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\CustomerPayment;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Services\ReceiptWriter;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Registers a receipt (COB-) for a customer, applied to the given sales or,
 * if none are given, FIFO to the open sales that are due first. A receipt
 * cannot exceed the customer's open debt (no advances in this phase).
 *
 * Lock order: customer -> open sales (by due date, id). Idempotent by key.
 */
class RegisterPayment
{
    public function __construct(
        private readonly ReceiptWriter $receipts,
        private readonly DocumentDateWindow $dates,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @throws InvalidSalesDocumentException
     */
    public function handle(PaymentData $data, User $actor): CustomerPayment
    {
        $amount = Decimal::of($data->amount)->round(2);
        if ($amount <= 0) {
            throw InvalidSalesDocumentException::with(['amount' => 'El monto del cobro debe ser mayor a 0.']);
        }

        $errors = $this->dates->errors($actor->company, $data->paymentDate, 'payment_date');
        if ($errors !== []) {
            throw new InvalidSalesDocumentException($errors);
        }

        return DB::transaction(function () use ($data, $actor, $amount) {
            $customer = Customer::query()->lockForUpdate()->findOrFail($data->customerId);

            if ($data->idempotencyKey !== null) {
                $existing = CustomerPayment::query()->where('idempotency_key', $data->idempotencyKey)->first();
                if ($existing !== null) {
                    return $existing->load('allocations');
                }
            }

            $open = $this->lockOpenSales($customer);
            $allocations = $data->allocations === null
                ? $this->allocateFifo($open, $amount)
                : $this->allocateExplicit($open, $data->allocations, $amount);

            $payment = $this->receipts->create(
                $customer,
                $data->paymentDate,
                $data->method,
                $allocations,
                $actor,
                reference: $data->reference,
                notes: $data->notes,
                idempotencyKey: $data->idempotencyKey,
            );

            $this->audit->log('receivables.payment.registered', actor: $actor, auditable: $payment, new: [
                'number' => $payment->number,
                'customer_id' => $customer->id,
                'amount' => $payment->amount,
                'method' => $payment->method->value,
                'allocations' => array_map(fn (array $a) => ['sales_document_id' => $a[0]->id, 'amount' => Decimal::money($a[1])], $allocations),
            ]);

            PaymentRegistered::dispatch($payment);

            return $payment->load('allocations');
        });
    }

    /**
     * @return Collection<int, SalesDocument>
     */
    private function lockOpenSales(Customer $customer): Collection
    {
        return SalesDocument::query()
            ->where('customer_id', $customer->id)
            ->where('status', SalesDocumentStatus::Posted)
            ->where('type', '!=', SalesDocumentType::Quote)
            ->whereColumn('paid_amount', '<', 'total')
            ->orderBy('due_date')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
    }

    /**
     * @param  Collection<int, SalesDocument>  $open
     * @return list<array{0: SalesDocument, 1: Number}>
     */
    private function allocateFifo(Collection $open, Number $amount): array
    {
        $this->assertWithinDebt($open, $amount);

        $remaining = $amount;
        $allocations = [];
        foreach ($open as $sale) {
            if ($remaining <= 0) {
                break;
            }
            $applied = $sale->openAmount() < $remaining ? $sale->openAmount() : $remaining;
            $allocations[] = [$sale, $applied];
            $remaining -= $applied;
        }

        return $allocations;
    }

    /**
     * @param  Collection<int, SalesDocument>  $open
     * @param  array<int, string>  $requested  sales_document_id => amount
     * @return list<array{0: SalesDocument, 1: Number}>
     */
    private function allocateExplicit(Collection $open, array $requested, Number $amount): array
    {
        $byId = $open->keyBy('id');
        $errors = [];
        $allocations = [];
        $sum = new Number('0');

        foreach ($requested as $saleId => $value) {
            $applied = Decimal::of($value)->round(2);
            $sale = $byId->get($saleId);

            if ($sale === null) {
                $errors["allocations.{$saleId}"] = ['La venta no existe, no es de este cliente o ya está pagada.'];
            } elseif ($applied <= 0 || $applied > $sale->openAmount()) {
                $errors["allocations.{$saleId}"] = [sprintf('El monto para %s debe ser mayor a 0 y no superar su saldo (%s).', $sale->number, Decimal::money($sale->openAmount()))];
            } else {
                $allocations[] = [$sale, $applied];
            }
            $sum += $applied;
        }

        if ($errors === [] && $sum != $amount) {
            $errors['amount'] = ['La suma aplicada a las ventas debe ser igual al monto del cobro.'];
        }

        if ($errors !== []) {
            throw new InvalidSalesDocumentException($errors);
        }

        return $allocations;
    }

    /**
     * @param  Collection<int, SalesDocument>  $open
     */
    private function assertWithinDebt(Collection $open, Number $amount): void
    {
        $debt = $open->reduce(fn (Number $sum, SalesDocument $s) => $sum + $s->openAmount(), new Number('0'));

        if ($amount > $debt) {
            throw InvalidSalesDocumentException::with([
                'amount' => sprintf('El cobro (%s) supera la deuda pendiente del cliente (%s).', Decimal::money($amount), Decimal::money($debt)),
            ], 'payment_exceeds_debt');
        }
    }
}
