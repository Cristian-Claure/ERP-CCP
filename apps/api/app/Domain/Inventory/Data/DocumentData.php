<?php

namespace App\Domain\Inventory\Data;

use App\Domain\Inventory\Enums\AdjustmentReason;
use App\Domain\Inventory\Enums\DocumentType;
use Carbon\CarbonImmutable;

final readonly class DocumentData
{
    /**
     * @param  list<DocumentLineData>  $lines
     */
    public function __construct(
        public DocumentType $type,
        public int $warehouseId,
        public CarbonImmutable $documentDate,
        public array $lines,
        public ?int $destinationWarehouseId = null,
        public ?AdjustmentReason $adjustmentReason = null,
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
            type: DocumentType::from($data['type']),
            warehouseId: (int) $data['warehouse_id'],
            documentDate: CarbonImmutable::parse($data['document_date'])->startOfDay(),
            lines: array_map(DocumentLineData::fromArray(...), array_values($data['lines'] ?? [])),
            destinationWarehouseId: isset($data['destination_warehouse_id']) ? (int) $data['destination_warehouse_id'] : null,
            adjustmentReason: isset($data['adjustment_reason']) ? AdjustmentReason::from($data['adjustment_reason']) : null,
            reference: $data['reference'] ?? null,
            notes: $data['notes'] ?? null,
            idempotencyKey: $idempotencyKey,
        );
    }
}
