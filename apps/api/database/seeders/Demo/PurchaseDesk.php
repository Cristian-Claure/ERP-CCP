<?php

namespace Database\Seeders\Demo;

use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Purchases\Actions\ApprovePurchaseOrder;
use App\Domain\Purchases\Actions\PostPurchaseReceipt;
use App\Domain\Purchases\Actions\RegisterSupplierPayment;
use App\Domain\Purchases\Actions\SavePurchaseOrder;
use App\Domain\Purchases\Data\PurchaseOrderData;
use App\Domain\Purchases\Data\ReceiptData;
use App\Domain\Purchases\Data\SupplierPaymentData;
use App\Domain\Purchases\Enums\ReceiptCostKind;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Carbon\CarbonImmutable;

/**
 * Purchasing side of the demo simulation, through the REAL purchase engine:
 * the administrator raises OCs per supplier, the manager approves them (two
 * people: segregation of duties), the storekeeper receives them (a third of
 * them in two partial receipts, imports with freight) and the manager pays
 * by due date (a few suppliers are paid late, so payables show aging).
 */
final class PurchaseDesk
{
    /** @var array<string, Supplier> category => suppliers rotate per product */
    private array $byCategory = [];

    /** @var list<array{day: int, order: PurchaseOrder, lines: list<array{0: int, 1: string}>}> */
    private array $pendingParts = [];

    private int $orders = 0;

    public function __construct(
        private readonly User $buyer,
        private readonly User $approver,
        private readonly User $storekeeper,
    ) {}

    /** @return list<Supplier> */
    public function suppliers(int $companyId): array
    {
        $out = [];
        foreach (DemoSuppliers::LIST as [$taxId, $name, $contact, $country, $city, $lat, $lng, $terms, $lead, $invoice, $category]) {
            $supplier = Supplier::query()->updateOrCreate(['tax_id' => $taxId], [
                'company_id' => $companyId, 'name' => $name, 'contact_name' => $contact, 'country' => $country, 'city' => $city,
                'latitude' => $lat, 'longitude' => $lng, 'payment_terms_days' => $terms, 'lead_time_days' => $lead,
                'issues_invoice' => $invoice, 'is_active' => true,
                'email' => strtolower(preg_replace('/[^a-z]/i', '', explode(' ', $contact)[0] ?? 'compras')).'@'.strtolower(preg_replace('/[^a-z]/i', '', explode(' ', $name)[0])).'.example',
            ]);
            $this->byCategory[$category][] = $supplier;
            $out[] = $supplier;
        }

        return $out;
    }

    public function supplierFor(Product $product, string $category, int $index): Supplier
    {
        $pool = $this->byCategory[$category];

        return $pool[$index % count($pool)];
    }

    /**
     * One OC per supplier for the given needs, approved and received the same morning
     * (partially for some, the rest arrives 3 days later).
     *
     * @param  array<int, list<array{product: Product, quantity: string, cost: float, fractional: bool}>>  $needs  supplier id => lines
     */
    public function purchase(Warehouse $warehouse, array $needs, CarbonImmutable $date, int $day, bool $initial): void
    {
        foreach ($needs as $supplierId => $lines) {
            $supplier = Supplier::query()->findOrFail($supplierId);
            $order = app(SavePurchaseOrder::class)->handle(new PurchaseOrderData(
                supplierId: $supplier->id,
                warehouseId: $warehouse->id,
                orderDate: $date,
                lines: array_map(fn (array $l) => [
                    'product_id' => $l['product']->id,
                    'quantity' => $l['quantity'],
                    // Agreed price: with invoice the VAT goes on top of the net cost (net = price × 0.87).
                    'unit_price' => number_format($supplier->issues_invoice ? $l['cost'] / 0.87 : $l['cost'], 2, '.', ''),
                ], $lines),
                expectedDate: $date->addDays(min($supplier->lead_time_days, 3)),
                reference: $initial ? 'Inventario inicial' : null,
            ), $this->buyer);
            $order = app(ApprovePurchaseOrder::class)->handle($order, $this->approver);
            $this->orders++;

            $orderLines = $order->lines()->get()->values();
            $partial = ! $initial && $this->orders % 3 === 0;
            $now = $orderLines->map(fn ($l, $i) => [$i, $partial ? $this->part((string) $l->quantity, 0.6, $lines[$i]['fractional']) : (string) $l->quantity])->all();
            $this->receive($order, $now, $date, $supplier, $day);

            if ($partial) {
                $rest = $orderLines->map(fn ($l, $i) => [$i, (string) round((float) $l->quantity - (float) $now[$i][1], 4)])
                    ->filter(fn ($r) => (float) $r[1] > 0)->values()->all();
                $this->pendingParts[] = ['day' => $day + 3, 'order' => $order, 'lines' => $rest];
            }
        }
    }

    /** Receives the remainders due today. */
    public function receivePending(CarbonImmutable $date, int $day): void
    {
        foreach ($this->pendingParts as $i => $p) {
            if ($p['day'] === $day) {
                $this->receive($p['order']->refresh(), $p['lines'], $date, Supplier::query()->findOrFail($p['order']->supplier_id), $day);
                unset($this->pendingParts[$i]);
            }
        }
    }

    /** Suppliers paid late (days after the due date), so payables show aging. */
    private const LATE_DAYS = ['1020398025' => 20, '76.452.981-3' => 45, '1019874026' => 10];

    /** Pays the receipts due by $date; a few suppliers are paid late (aging). */
    public function payDue(CarbonImmutable $date): void
    {
        $due = PurchaseReceipt::query()->where('status', PaymentStatus::Posted)
            ->whereColumn('paid_amount', '<', 'invoice_total')
            ->whereDate('due_date', '<=', $date->toDateString())
            ->with('supplier')->orderBy('due_date')->get();

        foreach ($due->groupBy('supplier_id') as $receipts) {
            $supplier = $receipts->first()->supplier;
            $late = self::LATE_DAYS[$supplier->tax_id] ?? 0;
            $payable = $receipts->filter(fn (PurchaseReceipt $r) => $r->due_date->lte($date->subDays($late)));
            $amount = $payable->reduce(fn (Number $s, PurchaseReceipt $r) => $s + $r->openAmount(), new Number('0'));
            if ($amount <= 0) {
                continue;
            }
            app(RegisterSupplierPayment::class)->handle(new SupplierPaymentData(
                supplierId: $supplier->id, paymentDate: $date,
                method: PaymentMethod::Transfer,
                amount: Decimal::money($amount),
                reference: $supplier->country === 'BO' ? null : 'Transferencia al exterior',
            ), $this->approver);
        }
    }

    /**
     * Leaves the purchasing pipeline alive for the UI: two approved OCs in transit,
     * one large import awaiting the manager's approval and a small draft.
     *
     * @param  array<string, Product>  $products  sku => product
     */
    public function openOrders(Warehouse $warehouse, array $products, CarbonImmutable $today): void
    {
        $line = fn (string $sku, string $qty, string $price) => ['product_id' => $products[$sku]->id, 'quantity' => $qty, 'unit_price' => $price];
        $plans = [
            ['1021145024', [$line('ELE-003', '120', '15.90'), $line('ELE-004', '40', '20.50')], true, 'Reposición focos LED'],
            ['1023456027', [$line('ABA-008', '240', '9.80'), $line('ABA-001', '300', '10.30')], true, null],
            ['91440300MA5G8K2X7L', [$line('ELE-003', '1500', '9.40'), $line('ELE-001', '3000', '3.90')], false, 'Importación trimestral'],
            ['5871239', [$line('LIM-005', '60', '12.40')], false, null],
        ];

        foreach ($plans as [$taxId, $lines, $approve, $reference]) {
            $supplier = Supplier::query()->where('tax_id', $taxId)->firstOrFail();
            $order = app(SavePurchaseOrder::class)->handle(new PurchaseOrderData(
                supplierId: $supplier->id, warehouseId: $warehouse->id, orderDate: $today, lines: $lines,
                expectedDate: $today->addDays($supplier->lead_time_days), reference: $reference,
            ), $this->buyer);
            if ($approve) {
                app(ApprovePurchaseOrder::class)->handle($order, $this->approver);
            }
        }
    }

    /**
     * @param  list<array{0: int, 1: string}>  $lines  [OC line index, quantity]
     */
    private function receive(PurchaseOrder $order, array $lines, CarbonImmutable $date, Supplier $supplier, int $day): void
    {
        $orderLines = $order->lines()->get()->values();
        $value = $orderLines->sum(fn ($l) => (float) $l->line_total);
        $freightPct = collect(DemoSuppliers::LIST)->firstWhere(0, $supplier->tax_id)[11] ?? 0;
        // Occasional price change on the invoice (within 2 %, or +4 % with a reason every ~10th receipt).
        $bump = $day % 10 === 7 ? 1.04 : ($day % 4 === 1 ? 1.01 : 1.0);

        app(PostPurchaseReceipt::class)->handle($order, new ReceiptData(
            receiptDate: $date,
            lines: array_map(fn (array $l) => [
                'purchase_order_line_id' => $orderLines[$l[0]]->id,
                'quantity' => $l[1],
                'unit_price' => number_format((float) $orderLines[$l[0]]->unit_price * $bump, 2, '.', ''),
            ], array_values(array_filter($lines, fn ($l) => (float) $l[1] > 0))),
            costs: $freightPct > 0 ? [[
                'kind' => ReceiptCostKind::Freight,
                'description' => $supplier->country === 'BO' ? 'Transporte terrestre' : 'Flete internacional y despacho',
                'amount' => number_format($value * $freightPct / 100 * 0.6, 2, '.', ''),
            ]] : [],
            supplierInvoiceNumber: $supplier->issues_invoice ? sprintf('%06d', 4000 + $day * 7 + $order->id) : null,
            supplierInvoiceDate: $supplier->issues_invoice ? $date : null,
            priceVarianceReason: $bump > 1.02 ? 'Actualización de lista de precios del proveedor.' : null,
        ), $this->storekeeper);
    }

    private function part(string $quantity, float $share, bool $fractional): string
    {
        $q = (float) $quantity * $share;

        return $fractional ? number_format(floor($q * 4) / 4, 2, '.', '') : (string) max(1, (int) floor($q));
    }
}
