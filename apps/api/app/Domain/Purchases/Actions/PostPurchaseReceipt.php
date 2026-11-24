<?php

namespace App\Domain\Purchases\Actions;

use App\Domain\Inventory\Actions\PostInventoryDocument;
use App\Domain\Inventory\Actions\SaveInventoryDocumentDraft;
use App\Domain\Inventory\Data\DocumentData;
use App\Domain\Inventory\Data\DocumentLineData;
use App\Domain\Inventory\Enums\DocumentType;
use App\Domain\Purchases\Data\ReceiptData;
use App\Domain\Purchases\Events\PurchasingChanged;
use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Models\PurchaseOrder;
use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\Services\PurchaseCostCalculator;
use App\Domain\Purchases\Services\PurchaseOrderProgress;
use App\Domain\Purchases\Services\ReceiptValidator;
use App\Domain\Purchases\Services\SupplierLedger;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentNumberer;
use Illuminate\Support\Facades\DB;

/**
 * Posts a (partial or total) receipt of an approved OC in ONE transaction:
 * validations -> entry cost (VAT credit, prorated additional costs) -> REC-
 * number -> ENT- ONLY through the inventory Actions -> OC progress ->
 * payable charge (invoice total, due by the supplier's terms) -> audit.
 *
 * Lock order (shared with VoidPurchaseReceipt and supplier payments):
 * supplier -> purchase order -> stock balances. Two concurrent receipts of
 * the same OC serialize on the OC lock, so over-receipt cannot slip through.
 * Idempotent by key.
 */
class PostPurchaseReceipt
{
    public const SEQUENCE_KEY = 'purchases.receipt';

    public const PREFIX = 'REC';

    public function __construct(
        private readonly ReceiptValidator $validator,
        private readonly PurchaseCostCalculator $calculator,
        private readonly PurchaseOrderProgress $progress,
        private readonly SupplierLedger $ledger,
        private readonly DocumentNumberer $numberer,
        private readonly AuditLogger $audit,
        private readonly SaveInventoryDocumentDraft $saveEntry,
        private readonly PostInventoryDocument $postEntry,
    ) {}

    public function handle(PurchaseOrder $order, ReceiptData $data, User $actor): PurchaseReceipt
    {
        if ($data->idempotencyKey !== null && ($existing = PurchaseReceipt::query()->where('idempotency_key', $data->idempotencyKey)->first())) {
            return $existing->load('lines');
        }

        $this->validator->assertDates($data, $actor->company);

        $receipt = DB::transaction(function () use ($order, $data, $actor) {
            $supplier = Supplier::query()->lockForUpdate()->findOrFail(PurchaseOrder::query()->whereKey($order->id)->value('supplier_id'));
            /** @var PurchaseOrder $order */
            $order = PurchaseOrder::query()->lockForUpdate()->findOrFail($order->id);
            if ($order->supplier_id !== $supplier->id) {
                throw PurchaseException::state('La orden cambió mientras se recibía. Vuelve a intentarlo.');
            }
            if (! $order->status->canReceive()) {
                throw PurchaseException::state('Solo se reciben órdenes aprobadas con saldo pendiente.');
            }

            $company = $order->company()->firstOrFail();
            $orderLines = $order->lines()->with('product')->get()->keyBy('id');
            $this->validator->assertInvoiceUnique($supplier, $data);
            $this->validator->assertQuantities($orderLines, $data, (string) $company->purchase_receipt_tolerance_pct);
            $variances = $this->validator->priceVariances($orderLines, $data, (string) $company->purchase_price_variance_pct);

            $amounts = $this->calculator->compute($data->lines, array_column($data->costs, 'amount'), $supplier->issues_invoice);
            $receipt = $this->createReceipt($order, $supplier, $data, $amounts, $variances, $orderLines, $actor);

            $entry = $this->postEntry->handle($this->saveEntry->handle(new DocumentData(
                type: DocumentType::Entry,
                warehouseId: $order->warehouse_id,
                documentDate: $data->receiptDate,
                lines: $receipt->lines->map(fn ($l) => new DocumentLineData(
                    productId: $l->product_id, quantity: (string) $l->quantity, unitCost: (string) $l->unit_cost,
                ))->all(),
                reference: $receipt->number,
                notes: sprintf('Entrada por la recepción %s de %s.', $receipt->number, $order->number),
                source: $receipt,
            ), $actor), $actor);
            $receipt->forceFill(['inventory_document_id' => $entry->id])->save();

            $this->progress->apply($order, $receipt, +1);
            $this->ledger->charge($supplier, $receipt, $actor->id);
            $this->auditPosting($receipt, $order, $variances, $data, $actor);

            return $receipt;
        });

        PurchasingChanged::dispatch($receipt->company_id);

        return $receipt->load(['lines', 'costs']);
    }

    /**
     * @param  array<string, mixed>  $amounts
     * @param  array<int, string>  $variances
     */
    private function createReceipt(PurchaseOrder $order, Supplier $supplier, ReceiptData $data, array $amounts, array $variances, $orderLines, User $actor): PurchaseReceipt
    {
        $invoiceDate = $data->supplierInvoiceDate ?? $data->receiptDate;
        $receipt = PurchaseReceipt::query()->create([
            'company_id' => $order->company_id,
            'purchase_order_id' => $order->id,
            'supplier_id' => $supplier->id,
            'warehouse_id' => $order->warehouse_id,
            'number' => $this->numberer->next($order->company_id, self::SEQUENCE_KEY, self::PREFIX),
            'receipt_date' => $data->receiptDate->toDateString(),
            'supplier_invoice_number' => $data->supplierInvoiceNumber,
            'supplier_invoice_date' => $data->supplierInvoiceDate?->toDateString(),
            'issues_invoice' => $supplier->issues_invoice,
            'invoice_total' => $amounts['invoice_total'],
            'vat_credit' => $amounts['vat_credit'],
            'net_total' => $amounts['net_total'],
            'additional_costs_total' => $amounts['additional_costs_total'],
            'cost_total' => $amounts['cost_total'],
            'due_date' => $invoiceDate->addDays($supplier->payment_terms_days)->toDateString(),
            'price_variance_reason' => $variances === [] ? null : $data->priceVarianceReason,
            'notes' => $data->notes,
            'idempotency_key' => $data->idempotencyKey,
            'created_by' => $actor->id,
        ]);

        foreach ($data->lines as $i => $line) {
            $orderLine = $orderLines->get($line['purchase_order_line_id']);
            $receipt->lines()->create([
                ...$amounts['lines'][$i],
                'company_id' => $order->company_id,
                'purchase_order_line_id' => $orderLine->id,
                'product_id' => $orderLine->product_id,
                'quantity' => $line['quantity'],
                'unit_price' => $line['unit_price'],
                'order_unit_price' => $orderLine->unit_price,
                'price_variance_pct' => $this->calculator->variancePct($line['unit_price'], (string) $orderLine->unit_price),
                'price_variance_flag' => isset($variances[$i]),
            ]);
        }
        foreach ($data->costs as $cost) {
            $receipt->costs()->create([...$cost, 'company_id' => $order->company_id]);
        }

        return $receipt->load('lines');
    }

    /**
     * @param  array<int, string>  $variances
     */
    private function auditPosting(PurchaseReceipt $receipt, PurchaseOrder $order, array $variances, ReceiptData $data, User $actor): void
    {
        $this->audit->log('purchases.receipt.posted', actor: $actor, auditable: $receipt, new: [
            'number' => $receipt->number,
            'order' => $order->number,
            'supplier_invoice' => $receipt->supplier_invoice_number,
            'invoice_total' => $receipt->invoice_total,
            'vat_credit' => $receipt->vat_credit,
            'cost_total' => $receipt->cost_total,
            'inventory_document_id' => $receipt->inventory_document_id,
        ]);

        if ($variances !== []) {
            $this->audit->log('purchases.receipt.price_variance', actor: $actor, auditable: $receipt, new: [
                'lines' => $variances,
                'reason' => $data->priceVarianceReason,
            ]);
        }
    }
}
