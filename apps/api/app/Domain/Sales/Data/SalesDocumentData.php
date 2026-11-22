<?php

namespace App\Domain\Sales\Data;

use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\PaymentTerms;
use App\Domain\Sales\Enums\SalesDocumentType;
use Carbon\CarbonImmutable;

final readonly class SalesDocumentData
{
    /**
     * @param  list<SalesLineData>  $lines
     */
    public function __construct(
        public SalesDocumentType $type,
        public int $customerId,
        public int $warehouseId,
        public CarbonImmutable $documentDate,
        public array $lines,
        public ?PaymentTerms $paymentTerms = null,
        public ?PaymentMethod $paymentMethod = null,
        public string $globalDiscount = '0',
        public ?CarbonImmutable $validUntil = null,
        public ?string $reference = null,
        public ?string $notes = null,
        public ?string $idempotencyKey = null,
        public ?int $quoteId = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated input
     */
    public static function fromArray(array $data, ?string $idempotencyKey = null): self
    {
        return new self(
            type: SalesDocumentType::from($data['type']),
            customerId: (int) $data['customer_id'],
            warehouseId: (int) $data['warehouse_id'],
            documentDate: CarbonImmutable::parse($data['document_date'])->startOfDay(),
            lines: array_map(SalesLineData::fromArray(...), array_values($data['lines'] ?? [])),
            paymentTerms: isset($data['payment_terms']) ? PaymentTerms::from($data['payment_terms']) : null,
            paymentMethod: isset($data['payment_method']) ? PaymentMethod::from($data['payment_method']) : null,
            globalDiscount: (string) ($data['global_discount'] ?? '0'),
            validUntil: isset($data['valid_until']) ? CarbonImmutable::parse($data['valid_until'])->startOfDay() : null,
            reference: $data['reference'] ?? null,
            notes: $data['notes'] ?? null,
            idempotencyKey: $idempotencyKey,
            quoteId: isset($data['quote_id']) ? (int) $data['quote_id'] : null,
        );
    }
}
