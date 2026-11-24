<?php

namespace App\Domain\Purchases\Data;

use App\Domain\Purchases\Enums\ReceiptCostKind;
use Carbon\CarbonImmutable;

/** Receipt of an OC (doubles as the supplier invoice in this phase, ADR 0006). */
final readonly class ReceiptData
{
    /**
     * @param  list<array{purchase_order_line_id: int, quantity: string, unit_price: string}>  $lines
     * @param  list<array{kind: ReceiptCostKind, description: ?string, amount: string}>  $costs
     */
    public function __construct(
        public CarbonImmutable $receiptDate,
        public array $lines,
        public array $costs = [],
        public ?string $supplierInvoiceNumber = null,
        public ?CarbonImmutable $supplierInvoiceDate = null,
        public ?string $priceVarianceReason = null,
        public ?string $notes = null,
        public ?string $idempotencyKey = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated input
     */
    public static function fromArray(array $data, ?string $idempotencyKey = null): self
    {
        $clean = fn (mixed $v) => ($v = trim((string) $v)) === '' ? null : $v;

        return new self(
            receiptDate: CarbonImmutable::parse($data['receipt_date']),
            lines: array_values(array_map(fn (array $l) => [
                'purchase_order_line_id' => (int) $l['purchase_order_line_id'],
                'quantity' => (string) $l['quantity'],
                'unit_price' => (string) $l['unit_price'],
            ], array_filter($data['lines'], fn (array $l) => (float) $l['quantity'] > 0))),
            costs: array_map(fn (array $c) => [
                'kind' => ReceiptCostKind::from($c['kind']),
                'description' => $clean($c['description'] ?? null),
                'amount' => (string) $c['amount'],
            ], array_values($data['costs'] ?? [])),
            supplierInvoiceNumber: $clean($data['supplier_invoice_number'] ?? null),
            supplierInvoiceDate: empty($data['supplier_invoice_date']) ? null : CarbonImmutable::parse($data['supplier_invoice_date']),
            priceVarianceReason: $clean($data['price_variance_reason'] ?? null),
            notes: $clean($data['notes'] ?? null),
            idempotencyKey: $idempotencyKey ? substr($idempotencyKey, 0, 100) : null,
        );
    }
}
