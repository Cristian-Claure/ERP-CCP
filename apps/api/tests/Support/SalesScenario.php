<?php

namespace Tests\Support;

use App\Domain\Sales\Actions\PostSalesDocument;
use App\Domain\Sales\Actions\RegisterPayment;
use App\Domain\Sales\Actions\SaveSalesDraft;
use App\Domain\Sales\Actions\VoidPayment;
use App\Domain\Sales\Actions\VoidSalesDocument;
use App\Domain\Sales\Data\PaymentData;
use App\Domain\Sales\Data\PostingAuthorization;
use App\Domain\Sales\Data\SalesDocumentData;
use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\CustomerPayment;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Models\User;

/**
 * Fluent fixture to drive the sales engine through its real Actions, on
 * top of an InventoryScenario (company, warehouses, product with stock).
 */
final class SalesScenario
{
    public InventoryScenario $inv;

    public Customer $customer;

    public Customer $creditCustomer;

    public static function make(array $companyAttributes = [], string $stock = '100', string $unitCost = '10.00'): self
    {
        $s = new self;
        $s->inv = InventoryScenario::make($companyAttributes);
        $s->inv->product->update(['sale_price' => '20.00', 'min_price' => '12.00']);

        if ($stock !== '0') {
            $s->inv->entry($stock, $unitCost);
        }

        $s->customer = Customer::factory()->create(['company_id' => $s->inv->company->id, 'name' => 'Cliente Contado']);
        $s->creditCustomer = Customer::factory()->credit('1000.00', 30)->create(['company_id' => $s->inv->company->id, 'name' => 'Cliente Crédito']);

        return $s;
    }

    public function as(callable $callback): mixed
    {
        return $this->inv->as(fn () => $callback($this));
    }

    /**
     * @param  list<array<string, mixed>>  $lines  defaults: product, quantity 1, price 20
     */
    public function draft(string $type = 'invoice', array $lines = [[]], array $header = [], ?User $actor = null): SalesDocument
    {
        $lines = array_map(fn (array $l) => [
            'product_id' => $this->inv->product->id,
            'quantity' => '1',
            'unit_price' => '20.00',
            ...$l,
        ], $lines);

        return $this->as(fn () => app(SaveSalesDraft::class)->handle(SalesDocumentData::fromArray([
            'type' => $type,
            'customer_id' => $this->customer->id,
            'warehouse_id' => $this->inv->warehouse->id,
            'document_date' => now($this->inv->company->timezone)->toDateString(),
            'lines' => $lines,
            ...$header,
        ]), $actor ?? $this->inv->user));
    }

    public function post(SalesDocument $document, ?PostingAuthorization $auth = null, ?User $actor = null): SalesDocument
    {
        return $this->as(fn () => app(PostSalesDocument::class)->handle($document, $actor ?? $this->inv->user, $auth));
    }

    /**
     * @param  list<array<string, mixed>>  $lines
     */
    public function sale(array $lines = [[]], array $header = [], string $type = 'invoice'): SalesDocument
    {
        return $this->post($this->draft($type, $lines, $header));
    }

    public function creditSale(string $quantity = '1', string $price = '20.00'): SalesDocument
    {
        return $this->sale([['quantity' => $quantity, 'unit_price' => $price]], [
            'customer_id' => $this->creditCustomer->id,
            'payment_terms' => 'credit',
        ]);
    }

    public function void(SalesDocument $document, string $reason = 'Error de facturación'): SalesDocument
    {
        return $this->as(fn () => app(VoidSalesDocument::class)->handle($document, $this->inv->user, $reason));
    }

    /**
     * @param  array<int, string>|null  $allocations
     */
    public function pay(Customer $customer, string $amount, ?array $allocations = null, string $method = 'transfer'): CustomerPayment
    {
        return $this->as(fn () => app(RegisterPayment::class)->handle(new PaymentData(
            customerId: $customer->id,
            paymentDate: now($this->inv->company->timezone)->startOfDay()->toImmutable(),
            method: PaymentMethod::from($method),
            amount: $amount,
            allocations: $allocations,
        ), $this->inv->user));
    }

    public function voidPayment(CustomerPayment $payment, string $reason = 'Cobro mal registrado'): CustomerPayment
    {
        return $this->as(fn () => app(VoidPayment::class)->handle($payment, $this->inv->user, $reason));
    }

    public function fresh(Customer $customer): Customer
    {
        return Customer::query()->withoutGlobalScopes()->findOrFail($customer->id);
    }
}
