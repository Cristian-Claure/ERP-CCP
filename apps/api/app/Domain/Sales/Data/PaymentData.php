<?php

namespace App\Domain\Sales\Data;

use App\Domain\Sales\Enums\PaymentMethod;
use Carbon\CarbonImmutable;

final readonly class PaymentData
{
    /**
     * @param  array<int, string>|null  $allocations  sales_document_id => amount; null = FIFO by due date
     */
    public function __construct(
        public int $customerId,
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
            foreach ($data['allocations'] as $row) {
                $allocations[(int) $row['sales_document_id']] = (string) $row['amount'];
            }
        }

        return new self(
            customerId: (int) $data['customer_id'],
            paymentDate: CarbonImmutable::parse($data['payment_date'])->startOfDay(),
            method: PaymentMethod::from($data['method']),
            amount: (string) $data['amount'],
            allocations: $allocations,
            reference: $data['reference'] ?? null,
            notes: $data['notes'] ?? null,
            idempotencyKey: $idempotencyKey,
        );
    }
}
