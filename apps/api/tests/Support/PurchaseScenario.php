<?php

namespace Tests\Support;

use App\Domain\Inventory\Models\Product;
use App\Domain\Purchases\Actions\ApprovePurchaseOrder;
use App\Domain\Purchases\Actions\PostPurchaseReceipt;
use App\Domain\Purchases\Actions\RegisterSupplierPayment;
use App\Domain\Purchases\Actions\SavePurchaseOrder;
use App\Domain\Purchases\Actions\VoidPurchaseReceipt;
use App\Domain\Purchases\Data\PurchaseOrderData;
use App\Domain\Purchases\Data\ReceiptData;
use App\Domain\Purchases\Data\SupplierPaymentData;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\Models\SupplierPayment;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\CompanyContext;

/**
 * Company with two products, a supplier WITH invoice and one WITHOUT, and
 * helpers to create/approve OCs, receive them and pay (Phase 3 tests).
 */
final class PurchaseScenario
{
    public InventoryScenario $inv;

    public Product $other;

    public Supplier $supplier;

    public Supplier $informal;

    public static function make(array $companyAttributes = []): self
    {
        $s = new self;
        $s->inv = InventoryScenario::make(['purchase_approval_threshold' => '1000.00', ...$companyAttributes]);
        $c = $s->inv->company->id;
        $s->other = Product::factory()->create(['company_id' => $c, 'unit_id' => $s->inv->product->unit_id, 'name' => 'Azúcar', 'sku' => 'AZU-1']);
        $s->supplier = Supplier::factory()->create(['company_id' => $c, 'name' => 'Distribuidora con factura', 'payment_terms_days' => 30, 'lead_time_days' => 5]);
        $s->informal = Supplier::factory()->withoutInvoice()->create(['company_id' => $c, 'name' => 'Proveedor informal', 'payment_terms_days' => 0]);

        return $s;
    }

    public function as(callable $callback): mixed
    {
        return CompanyContext::run($this->inv->company->id, fn () => $callback($this));
    }

    public function today(): string
    {
        return now($this->inv->company->timezone)->toDateString();
    }

    /**
     * @param  list<array{0: Product, 1: string, 2: string}>  $lines  [product, quantity, unit price]
     */
    public function order(array $lines, ?Supplier $supplier = null, ?User $actor = null): PurchaseOrder
    {
        return $this->as(fn () => app(SavePurchaseOrder::class)->handle(PurchaseOrderData::fromArray([
            'supplier_id' => ($supplier ?? $this->supplier)->id,
            'warehouse_id' => $this->inv->warehouse->id,
            'order_date' => $this->today(),
            'lines' => array_map(fn (array $l) => ['product_id' => $l[0]->id, 'quantity' => $l[1], 'unit_price' => $l[2]], $lines),
        ]), $actor ?? $this->inv->user));
    }

    public function approve(PurchaseOrder $order, ?User $actor = null): PurchaseOrder
    {
        return $this->as(fn () => app(ApprovePurchaseOrder::class)->handle($order, $actor ?? $this->inv->user));
    }

    /** Small approved OC (below the 1000 threshold): 10 × 11.30 + 5 × 7.00 = 148.00. */
    public function approvedOrder(?Supplier $supplier = null): PurchaseOrder
    {
        return $this->approve($this->order([[$this->inv->product, '10', '11.30'], [$this->other, '5', '7.00']], $supplier));
    }

    /**
     * @param  list<array{0: int, 1: string, 2?: string}>  $lines  [OC line index, quantity, invoiced price]
     * @param  array<string, mixed>  $extra
     */
    public function receive(PurchaseOrder $order, array $lines, array $extra = [], ?User $actor = null): PurchaseReceipt
    {
        $orderLines = $order->lines()->get()->values();

        return $this->as(fn () => app(PostPurchaseReceipt::class)->handle($order, ReceiptData::fromArray([
            'receipt_date' => $this->today(),
            'lines' => array_map(fn (array $l) => [
                'purchase_order_line_id' => $orderLines[$l[0]]->id,
                'quantity' => $l[1],
                'unit_price' => $l[2] ?? (string) $orderLines[$l[0]]->unit_price,
            ], $lines),
            ...$extra,
        ]), $actor ?? $this->inv->user));
    }

    public function void(PurchaseReceipt $receipt, string $reason = 'Error de recepción'): PurchaseReceipt
    {
        return $this->as(fn () => app(VoidPurchaseReceipt::class)->handle($receipt, $this->inv->user, $reason));
    }

    public function pay(Supplier $supplier, string $amount, ?array $allocations = null): SupplierPayment
    {
        return $this->as(fn () => app(RegisterSupplierPayment::class)->handle(SupplierPaymentData::fromArray([
            'supplier_id' => $supplier->id,
            'payment_date' => $this->today(),
            'method' => 'transfer',
            'amount' => $amount,
            'allocations' => $allocations,
        ]), $this->inv->user));
    }
}
