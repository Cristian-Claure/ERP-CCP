<?php

namespace App\Domain\Sales\Data;

use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Sales\Enums\SalesDocumentType;

/**
 * A counter sale as the POS sends it. Tenders carry the amount TENDERED: for
 * cash it may exceed what is due (change); every other method is applied as is.
 */
final readonly class PosCheckoutData
{
    /**
     * @param  array{id?: int|null, document_type?: string|null, document_number?: string|null, name?: string|null}  $customer
     * @param  list<SalesLineData>  $lines
     * @param  list<TenderData>  $tenders
     */
    public function __construct(
        public SalesDocumentType $type,
        public int $warehouseId,
        public array $customer,
        public array $lines,
        public array $tenders,
        public string $globalDiscount,
        public PostingAuthorization $authorization,
        public string $idempotencyKey,
        public ?string $notes = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated input
     */
    public static function fromArray(array $data, string $idempotencyKey): self
    {
        return new self(
            type: SalesDocumentType::from($data['type']),
            warehouseId: (int) $data['warehouse_id'],
            customer: $data['customer'] ?? [],
            lines: array_map(SalesLineData::fromArray(...), array_values($data['lines'])),
            tenders: array_map(
                fn (array $t) => new TenderData(PaymentMethod::from($t['method']), (string) $t['amount']),
                array_values($data['payments']),
            ),
            globalDiscount: (string) ($data['global_discount'] ?? '0'),
            authorization: PostingAuthorization::fromArray($data),
            idempotencyKey: substr($idempotencyKey, 0, 100),
            notes: $data['notes'] ?? null,
        );
    }
}
