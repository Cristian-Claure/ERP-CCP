<?php

namespace App\Domain\Purchases\Services;

use App\Domain\Purchases\Data\ReceiptData;
use App\Domain\Purchases\Exceptions\PurchaseException;
use App\Domain\Purchases\Models\PurchaseOrderLine;
use App\Domain\Purchases\Models\PurchaseReceipt;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Services\DocumentDateWindow;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Illuminate\Support\Collection;

/**
 * Business validations of a receipt against its (locked) OC: dates, supplier
 * invoice uniqueness, pending quantities with tolerance and price variance.
 */
class ReceiptValidator
{
    public function __construct(
        private readonly DocumentDateWindow $dates,
        private readonly PurchaseCostCalculator $calculator,
    ) {}

    public function assertDates(ReceiptData $data, Company $company): void
    {
        $errors = $this->dates->errors($company, $data->receiptDate, 'receipt_date');
        $today = $this->dates->today($company);
        if ($data->supplierInvoiceDate !== null && $data->supplierInvoiceDate->startOfDay()->gt($today)) {
            $errors['supplier_invoice_date'] = ['La fecha de la factura no puede ser futura.'];
        }
        if ($data->supplierInvoiceNumber !== null && $data->supplierInvoiceDate === null) {
            $errors['supplier_invoice_date'] = ['Indica la fecha de la factura del proveedor.'];
        }
        if ($data->lines === []) {
            $errors['lines'] = ['Indica al menos una cantidad recibida.'];
        }
        if ($errors !== []) {
            throw new PurchaseException($errors);
        }
    }

    /** One invoice number per supplier (a voided receipt frees it). */
    public function assertInvoiceUnique(Supplier $supplier, ReceiptData $data): void
    {
        if ($data->supplierInvoiceNumber === null) {
            return;
        }
        $existing = PurchaseReceipt::query()
            ->where('supplier_id', $supplier->id)
            ->where('supplier_invoice_number', $data->supplierInvoiceNumber)
            ->where('status', '!=', PaymentStatus::Voided)
            ->value('number');
        if ($existing !== null) {
            throw PurchaseException::duplicateInvoice($data->supplierInvoiceNumber, $existing);
        }
    }

    /**
     * received_quantity + quantity <= ordered × (1 + tolerance %).
     *
     * @param  Collection<int, PurchaseOrderLine>  $orderLines  keyed by id
     */
    public function assertQuantities(Collection $orderLines, ReceiptData $data, string $tolerancePct): void
    {
        $factor = new Number('1') + Decimal::of($tolerancePct)->div(new Number('100'), 6);
        $errors = [];
        $seen = [];

        foreach ($data->lines as $i => $line) {
            $orderLine = $orderLines->get($line['purchase_order_line_id']);
            $qty = Decimal::of($line['quantity']);
            if ($orderLine === null || isset($seen[$line['purchase_order_line_id']])) {
                $errors["lines.{$i}.purchase_order_line_id"] = ['La línea no pertenece a la orden o está repetida.'];

                continue;
            }
            $seen[$line['purchase_order_line_id']] = true;

            $max = (Decimal::of($orderLine->quantity) * $factor)->round(4) - Decimal::of($orderLine->received_quantity);
            if ($qty > $max) {
                $errors["lines.{$i}.quantity"] = [sprintf(
                    '%s: se intenta recibir %s y lo pendiente es %s%s.',
                    $orderLine->product?->name ?? 'Producto',
                    $this->qty($qty),
                    $this->qty($orderLine->pending()),
                    Decimal::of($tolerancePct) > 0 ? " (+{$tolerancePct} % de tolerancia)" : '',
                )];
            }
        }

        if ($errors !== []) {
            throw PurchaseException::overReceipt($errors);
        }
    }

    /**
     * Lines whose invoiced price differs from the OC price beyond the company threshold.
     *
     * @param  Collection<int, PurchaseOrderLine>  $orderLines
     * @return array<int, string> line index => variance %
     */
    public function priceVariances(Collection $orderLines, ReceiptData $data, string $thresholdPct): array
    {
        $flagged = [];
        foreach ($data->lines as $i => $line) {
            $orderLine = $orderLines->get($line['purchase_order_line_id']);
            $pct = $this->calculator->variancePct($line['unit_price'], (string) $orderLine->unit_price);
            if (Decimal::of($pct) > Decimal::of($thresholdPct)) {
                $flagged[$i] = $pct;
            }
        }

        if ($flagged !== [] && $data->priceVarianceReason === null) {
            throw PurchaseException::with(['price_variance_reason' => sprintf(
                'El precio facturado difiere del de la orden en más de %s %% en %d línea(s). Indica el motivo.',
                $thresholdPct,
                count($flagged),
            )], 'price_variance_reason_required');
        }

        return $flagged;
    }

    private function qty(Number $value): string
    {
        return rtrim(rtrim((string) $value->round(4), '0'), '.');
    }
}
