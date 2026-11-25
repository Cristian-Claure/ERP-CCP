<?php

namespace App\Domain\Purchases\Data;

use Carbon\CarbonImmutable;

/** Draft purchase order as the API receives it. */
final readonly class PurchaseOrderData
{
    /**
     * @param  list<array{product_id: int, quantity: string, unit_price: string}>  $lines
     */
    public function __construct(
        public int $supplierId,
        public int $warehouseId,
        public CarbonImmutable $orderDate,
        public array $lines,
        public ?CarbonImmutable $expectedDate = null,
        public ?string $reference = null,
        public ?string $notes = null,
        public ?string $idempotencyKey = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated input
     */
    public static function fromArray(array $data, ?string $idempotencyKey = null): self
    {
        return new self(
            supplierId: (int) $data['supplier_id'],
            warehouseId: (int) $data['warehouse_id'],
            orderDate: CarbonImmutable::parse($data['order_date']),
            lines: array_map(fn (array $l) => [
                'product_id' => (int) $l['product_id'],
                'quantity' => (string) $l['quantity'],
                'unit_price' => (string) $l['unit_price'],
            ], array_values($data['lines'])),
            expectedDate: empty($data['expected_date']) ? null : CarbonImmutable::parse($data['expected_date']),
            reference: $data['reference'] ?? null,
            notes: $data['notes'] ?? null,
            idempotencyKey: $idempotencyKey ? substr($idempotencyKey, 0, 100) : null,
        );
    }
}
