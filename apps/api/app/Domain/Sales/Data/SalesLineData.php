<?php

namespace App\Domain\Sales\Data;

final readonly class SalesLineData
{
    public function __construct(
        public int $productId,
        public string $quantity,
        public string $unitPrice,
        public string $discountAmount = '0',
        public ?string $notes = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            productId: (int) $data['product_id'],
            quantity: (string) $data['quantity'],
            unitPrice: (string) $data['unit_price'],
            discountAmount: (string) ($data['discount_amount'] ?? '0'),
            notes: $data['notes'] ?? null,
        );
    }
}
