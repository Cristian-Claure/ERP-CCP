<?php

namespace Database\Seeders\Demo;

use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Sales\Actions\ConvertQuoteToSale;
use App\Domain\Sales\Actions\DeleteSalesDraft;
use App\Domain\Sales\Actions\PostSalesDocument;
use App\Domain\Sales\Actions\RegisterPayment;
use App\Domain\Sales\Actions\SaveSalesDraft;
use App\Domain\Sales\Actions\VoidSalesDocument;
use App\Domain\Sales\Data\PaymentData;
use App\Domain\Sales\Data\PostingAuthorization;
use App\Domain\Sales\Data\SalesDocumentData;
use App\Domain\Sales\Data\SalesLineData;
use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Exceptions\CreditLimitExceededException;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Exceptions\LinkedInventoryException;
use App\Domain\Sales\Exceptions\PriceBelowCostException;
use App\Domain\Sales\Exceptions\SaleHasPaymentsException;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Models\User;
use BcMath\Number;
use Carbon\CarbonImmutable;

/**
 * Sales counter for the demo simulation. Every sale goes through the REAL
 * engine (draft -> post), so each one generates its SAL-, its receivable
 * and its audit trail. Business exceptions are handled like people would:
 *
 * - below cost / min price: the manager authorizes it with a reason;
 * - credit limit exceeded: usually not sold, sometimes overridden;
 * - no stock: not sold.
 *
 * Credit sales get a planned payment date according to the customer's
 * payment profile; settle() registers the receipts as days go by.
 */
final class SalesDesk
{
    /** @var array<string, list<array{sale_id: int, customer_id: int, amount: string}>> date => planned receipts */
    private array $planned = [];

    /** @var array<int, string> customer id => payment profile */
    private array $profiles = [];

    public int $posted = 0;

    public int $skipped = 0;

    public function __construct(
        private readonly User $seller,
        private readonly User $manager,
        private readonly int $simulationEnd,
    ) {}

    public function profile(Customer $customer, string $profile): void
    {
        $this->profiles[$customer->id] = $profile;
    }

    /**
     * @param  list<array{product_id: int, quantity: string, unit_price: string, discount_amount?: string}>  $lines
     */
    public function sell(Customer $customer, int $warehouseId, array $lines, CarbonImmutable $date, int $day, string $globalDiscount = '0'): ?SalesDocument
    {
        if ($lines === []) {
            return null;
        }

        $credit = $customer->payment_terms->value === 'credit';
        $draft = app(SaveSalesDraft::class)->handle(new SalesDocumentData(
            type: $customer->segment->value === 'retail' && ! $credit && $day % 3 !== 0 ? SalesDocumentType::SalesNote : SalesDocumentType::Invoice,
            customerId: $customer->id,
            warehouseId: $warehouseId,
            documentDate: $date,
            lines: array_map(fn (array $l) => new SalesLineData(
                productId: $l['product_id'],
                quantity: $l['quantity'],
                unitPrice: $l['unit_price'],
                discountAmount: $l['discount_amount'] ?? '0',
            ), $lines),
            paymentMethod: $credit ? null : $this->method(),
            globalDiscount: $globalDiscount,
        ), $this->seller);

        $sale = $this->post($draft, $day);
        if ($sale === null) {
            app(DeleteSalesDraft::class)->handle($draft, $this->seller);
            $this->skipped++;

            return null;
        }

        $this->posted++;
        if ($credit) {
            $this->plan($sale, $customer, $day);
        }

        return $sale;
    }

    /**
     * Registers the receipts planned for $date (FIFO per sale).
     */
    public function settle(CarbonImmutable $date): void
    {
        foreach ($this->planned[$date->toDateString()] ?? [] as $receipt) {
            $sale = SalesDocument::query()->find($receipt['sale_id']);
            if ($sale === null || ! $sale->isPosted()) {
                continue;
            }

            $open = $sale->openAmount();
            $amount = new Number($receipt['amount']);
            $amount = $amount > $open ? $open : $amount;
            if ($amount <= 0) {
                continue;
            }

            try {
                app(RegisterPayment::class)->handle(new PaymentData(
                    customerId: $receipt['customer_id'],
                    paymentDate: $date,
                    method: mt_rand(1, 10) <= 7 ? PaymentMethod::Transfer : (mt_rand(0, 1) ? PaymentMethod::Qr : PaymentMethod::Check),
                    amount: (string) $amount->round(2),
                    allocations: [$sale->id => (string) $amount->round(2)],
                    reference: sprintf('TRX-%06d', mt_rand(1, 999999)),
                ), $this->seller);
            } catch (InvalidSalesDocumentException) {
                continue;
            }
        }
        unset($this->planned[$date->toDateString()]);
    }

    /** Voids a cash sale the way a manager fixes a duplicated sale. */
    public function void(SalesDocument $sale, string $reason): void
    {
        try {
            app(VoidSalesDocument::class)->handle($sale, $this->manager, $reason);
        } catch (SaleHasPaymentsException|InvalidSalesDocumentException|LinkedInventoryException) {
            return;
        }
    }

    /**
     * @param  list<array{product_id: int, quantity: string, unit_price: string, discount_amount?: string}>  $lines
     */
    public function quote(Customer $customer, int $warehouseId, array $lines, CarbonImmutable $date, int $validityDays, bool $post = true): SalesDocument
    {
        $draft = app(SaveSalesDraft::class)->handle(new SalesDocumentData(
            type: SalesDocumentType::Quote,
            customerId: $customer->id,
            warehouseId: $warehouseId,
            documentDate: $date,
            lines: array_map(fn (array $l) => new SalesLineData(
                productId: $l['product_id'],
                quantity: $l['quantity'],
                unitPrice: $l['unit_price'],
                discountAmount: $l['discount_amount'] ?? '0',
            ), $lines),
            validUntil: $date->addDays($validityDays),
        ), $this->seller);

        return $post ? app(PostSalesDocument::class)->handle($draft, $this->seller) : $draft;
    }

    public function convert(SalesDocument $quote): ?SalesDocument
    {
        try {
            $draft = app(ConvertQuoteToSale::class)->handle($quote, SalesDocumentType::Invoice, $this->seller);
        } catch (InvalidSalesDocumentException) {
            return null;
        }

        return $this->post($draft, 0) ?? $draft;
    }

    private function post(SalesDocument $draft, int $day): ?SalesDocument
    {
        try {
            return app(PostSalesDocument::class)->handle($draft, $this->seller);
        } catch (InsufficientStockException) {
            return null;
        } catch (PriceBelowCostException) {
            return $this->postAuthorized($draft, new PostingAuthorization(belowCostReason: 'Precio promocional autorizado por gerencia.'));
        } catch (CreditLimitExceededException) {
            // Most of the time the sale is lost; now and then the manager approves it.
            return $day % 6 === 0
                ? $this->postAuthorized($draft, new PostingAuthorization(creditOverrideReason: 'Cliente con buen historial; gerencia aprueba exceso temporal.'))
                : null;
        }
    }

    private function postAuthorized(SalesDocument $draft, PostingAuthorization $auth): ?SalesDocument
    {
        try {
            return app(PostSalesDocument::class)->handle($draft, $this->manager, $auth);
        } catch (InsufficientStockException|CreditLimitExceededException|PriceBelowCostException) {
            return null;
        }
    }

    /**
     * Plans when (and how much of) a credit sale is paid.
     */
    private function plan(SalesDocument $sale, Customer $customer, int $day): void
    {
        $due = $sale->due_date->toImmutable();
        $profile = $this->profiles[$customer->id] ?? 'punctual';
        $total = (string) $sale->total;

        $plans = match ($profile) {
            'punctual' => [[$due->subDays(mt_rand(0, 6)), $total]],
            'late' => [[$due->addDays(mt_rand(12, 40)), $total]],
            'partial' => [
                [$due->subDays(mt_rand(0, 3)), bcdiv($total, '2', 2)],
                [$due->addDays(mt_rand(10, 30)), $total],
            ],
            // Pays the first week, then stops: leaves debt overdue up to ~80 days.
            'defaulter' => $day < 8 ? [[$due->addDays(mt_rand(5, 15)), $total]] : [],
            default => [],
        };

        $start = $sale->document_date->toImmutable();
        $simulationStart = $start->subDays($day);
        foreach ($plans as [$when, $amount]) {
            $when = $when->lessThan($start) ? $start : $when;
            if ($simulationStart->diffInDays($when) > $this->simulationEnd) {
                continue; // beyond the simulated period: stays open
            }
            $this->planned[$when->toDateString()][] = ['sale_id' => $sale->id, 'customer_id' => $customer->id, 'amount' => $amount];
        }
    }

    private function method(): PaymentMethod
    {
        $r = mt_rand(1, 100);

        return match (true) {
            $r <= 55 => PaymentMethod::Cash,
            $r <= 82 => PaymentMethod::Qr,
            $r <= 94 => PaymentMethod::Card,
            default => PaymentMethod::Transfer,
        };
    }
}
