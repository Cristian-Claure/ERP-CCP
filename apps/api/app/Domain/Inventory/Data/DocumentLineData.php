<?php

namespace App\Domain\Inventory\Data;

final readonly class DocumentLineData
{
    public function __construct(
        public int $productId,
        public ?string $quantity = null,
        public ?string $countedQuantity = null,
        public ?string $unitCost = null,
        public ?string $notes = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $decimal = fn (string $key) => isset($data[$key]) && $data[$key] !== '' ? (string) $data[$key] : null;

        return new self(
            productId: (int) $data['product_id'],
            quantity: $decimal('quantity'),
            countedQuantity: $decimal('counted_quantity'),
            unitCost: $decimal('unit_cost'),
            notes: $data['notes'] ?? null,
        );
    }
}
