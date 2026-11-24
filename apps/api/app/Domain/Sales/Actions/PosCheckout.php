<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Sales\Data\PosCheckoutData;
use App\Domain\Sales\Data\SalesDocumentData;
use App\Domain\Sales\Data\TenderData;
use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\PaymentTerms;
use App\Domain\Sales\Enums\SalesDocumentStatus;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Services\PosCustomerResolver;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Counter sale in ONE request and ONE transaction: customer (found or created
 * from its NIT/CI) -> SaveSalesDraft -> PostSalesDocument with the tenders.
 * No business rule lives here: stock, numbering, prices, receivables and
 * audit are the sales engine's. Any failure (insufficient stock, price below
 * cost without authorization...) rolls everything back, so no number is used.
 *
 * Idempotent by Idempotency-Key: a repeated request (double Enter, retry)
 * returns the sale already posted with that key.
 */
class PosCheckout
{
    public function __construct(
        private readonly PosCustomerResolver $customers,
        private readonly SaveSalesDraft $saveDraft,
        private readonly PostSalesDocument $post,
        private readonly DocumentDateWindow $dates,
    ) {}

    public function handle(PosCheckoutData $data, User $actor): SalesDocument
    {
        if ($done = $this->alreadyPosted($data->idempotencyKey)) {
            return $done;
        }

        try {
            return DB::transaction(fn () => $this->checkout($data, $actor));
        } catch (UniqueConstraintViolationException $e) {
            // A concurrent request with the same key won the race: return its sale.
            return $this->alreadyPosted($data->idempotencyKey) ?? throw $e;
        }
    }

    private function checkout(PosCheckoutData $data, User $actor): SalesDocument
    {
        $company = $actor->company()->firstOrFail();
        $customer = $this->customers->resolve($data->customer, $company, $actor);

        $draft = $this->saveDraft->handle(new SalesDocumentData(
            type: $data->type,
            customerId: $customer->id,
            warehouseId: $data->warehouseId,
            documentDate: $this->dates->today($company),
            lines: $data->lines,
            paymentTerms: PaymentTerms::Cash,
            paymentMethod: $this->mainMethod($data->tenders),
            globalDiscount: $data->globalDiscount,
            notes: $data->notes,
            idempotencyKey: $data->idempotencyKey,
        ), $actor);

        [$tenders, $received, $change] = $this->applyTenders($data->tenders, Decimal::of($draft->total));

        $sale = $this->post->handle($draft, $actor, $data->authorization, $tenders);
        $sale->forceFill([
            'channel' => 'pos',
            'cash_received' => $received === null ? null : Decimal::money($received),
            'change_amount' => $change === null ? null : Decimal::money($change),
        ])->save();
        // PostSalesDocument returns a re-fetched (locked) instance: flag it as new for a 201.
        $sale->wasRecentlyCreated = true;

        return $sale;
    }

    /**
     * Turns tendered amounts into applied amounts: every non-cash tender is applied
     * as is; cash covers the rest and any excess is change.
     *
     * @param  list<TenderData>  $tendered
     * @return array{0: list<TenderData>, 1: ?Number, 2: ?Number} applied tenders, cash received, change
     */
    public function applyTenders(array $tendered, Number $total): array
    {
        $zero = new Number('0');
        $cash = array_values(array_filter($tendered, fn (TenderData $t) => $t->method === PaymentMethod::Cash));
        $other = array_values(array_filter($tendered, fn (TenderData $t) => $t->method !== PaymentMethod::Cash && $t->amount() > $zero));
        $otherSum = array_reduce($other, fn (Number $s, TenderData $t) => $s + $t->amount(), $zero);
        $received = array_reduce($cash, fn (Number $s, TenderData $t) => $s + $t->amount(), $zero);
        $cashDue = $total - $otherSum;

        $fail = fn (string $message) => throw InvalidSalesDocumentException::with(['payments' => $message]);
        if ($cashDue < $zero) {
            $fail(sprintf('Los pagos sin efectivo (%s) superan el total (%s).', Decimal::money($otherSum), Decimal::money($total)));
        }
        if ($received < $cashDue) {
            $fail(sprintf('Falta cobrar %s.', Decimal::money($cashDue - $received)));
        }

        $applied = $other;
        if ($cashDue > $zero) {
            $applied[] = new TenderData(PaymentMethod::Cash, Decimal::money($cashDue));
        }

        return $cash === []
            ? [$applied, null, null]
            : [$applied, $received, $received - $cashDue];
    }

    /** @param list<TenderData> $tenders */
    private function mainMethod(array $tenders): PaymentMethod
    {
        usort($tenders, fn (TenderData $a, TenderData $b) => $b->amount() <=> $a->amount());

        return $tenders[0]->method ?? PaymentMethod::Cash;
    }

    private function alreadyPosted(string $key): ?SalesDocument
    {
        return SalesDocument::query()
            ->where('idempotency_key', $key)
            ->where('status', SalesDocumentStatus::Posted)
            ->first();
    }
}
