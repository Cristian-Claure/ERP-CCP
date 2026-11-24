<?php

namespace App\Domain\Purchases\Data;

use App\Domain\Sales\Enums\PaymentMethod;
use Carbon\CarbonImmutable;

/** Payment to a supplier, applied to the given receipts or FIFO by due date. */
final readonly class SupplierPaymentData
{
    /**
     * @param  array<int, string>|null  $allocations  purchase_receipt_id => amount (null = FIFO)
     */
    public function __construct(
        public int $supplierId,
        public CarbonImmutable $paymentDate,
        public PaymentMethod $method,
        public string $amount,
        public ?array $allocations = null,
        public ?string $reference = null,
        public ?string $notes = null,
        public ?string $idempotencyKey = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated input
     */
    public static function fromArray(array $data, ?string $idempotencyKey = null): self
    {
        $allocations = null;
        if (! empty($data['allocations'])) {
            $allocations = [];
            foreach ($data['allocations'] as $a) {
                $allocations[(int) $a['purchase_receipt_id']] = (string) $a['amount'];
            }
        }

        return new self(
            supplierId: (int) $data['supplier_id'],
            paymentDate: CarbonImmutable::parse($data['payment_date']),
            method: PaymentMethod::from($data['method']),
            amount: (string) $data['amount'],
            allocations: $allocations,
            reference: $data['reference'] ?? null,
            notes: $data['notes'] ?? null,
            idempotencyKey: $idempotencyKey ? substr($idempotencyKey, 0, 100) : null,
        );
    }
}
