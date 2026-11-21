<?php

namespace App\Domain\Inventory\Actions;

use App\Domain\Inventory\Data\DocumentData;
use App\Domain\Inventory\Enums\DocumentType;
use App\Domain\Inventory\Exceptions\InvalidDocumentException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Inventory\Services\DocumentValidator;
use App\Domain\Shared\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates or updates a DRAFT document (header + full replacement of lines).
 * Drafts never touch stock nor get a number.
 */
class SaveInventoryDocumentDraft
{
    public function __construct(private readonly DocumentValidator $validator) {}

    /**
     * @throws InvalidDocumentException
     */
    public function handle(DocumentData $data, User $actor, ?InventoryDocument $document = null): InventoryDocument
    {
        // Idempotent creation: the same Idempotency-Key returns the same draft.
        if ($document === null && $data->idempotencyKey !== null) {
            $existing = InventoryDocument::query()->where('idempotency_key', $data->idempotencyKey)->first();
            if ($existing !== null) {
                return $existing->load('lines');
            }
        }

        if ($document !== null && ! $document->isDraft()) {
            throw InvalidDocumentException::state('Solo se pueden editar documentos en borrador.');
        }

        $this->validate($data, $actor);

        return DB::transaction(function () use ($data, $actor, $document) {
            $document ??= new InventoryDocument([
                'type' => $data->type,
                'created_by' => $actor->id,
                'idempotency_key' => $data->idempotencyKey,
            ]);

            $document->fill([
                'type' => $data->type,
                'warehouse_id' => $data->warehouseId,
                'destination_warehouse_id' => $data->type === DocumentType::Transfer ? $data->destinationWarehouseId : null,
                'document_date' => $data->documentDate->toDateString(),
                'adjustment_reason' => $data->type === DocumentType::Adjustment ? $data->adjustmentReason : null,
                'reference' => $data->reference,
                'notes' => $data->notes,
            ])->save();

            $document->lines()->delete();

            foreach ($data->lines as $position => $line) {
                $isAdjustment = $data->type === DocumentType::Adjustment;
                $document->lines()->create([
                    'product_id' => $line->productId,
                    'position' => $position,
                    'quantity' => $isAdjustment ? null : $line->quantity,
                    'counted_quantity' => $isAdjustment ? $line->countedQuantity : null,
                    'unit_cost' => in_array($data->type, [DocumentType::Entry, DocumentType::Adjustment], true) ? $line->unitCost : null,
                    'notes' => $line->notes,
                ]);
            }

            return $document->load('lines');
        });
    }

    /**
     * @throws InvalidDocumentException
     */
    private function validate(DocumentData $data, User $actor): void
    {
        $company = $actor->company;
        $warehouses = Warehouse::query()
            ->whereIn('id', array_filter([$data->warehouseId, $data->destinationWarehouseId]))
            ->get()
            ->keyBy('id');
        $products = Product::query()
            ->with('unit')
            ->whereIn('id', array_map(fn ($l) => $l->productId, $data->lines))
            ->get()
            ->keyBy('id');

        $errors = $this->validator->dateErrors($company, $data->documentDate);
        $errors += $this->validator->headerErrors(
            $data->type,
            $warehouses->get($data->warehouseId),
            $data->destinationWarehouseId ? $warehouses->get($data->destinationWarehouseId) : null,
            $data->adjustmentReason?->requiresNotes() ?? false,
            $data->adjustmentReason !== null,
            $data->notes,
        );

        $seen = [];
        foreach ($data->lines as $i => $line) {
            $errors += $this->validator->lineErrors(
                $data->type,
                $i,
                $products->get($line->productId),
                $line->quantity,
                $line->countedQuantity,
                $line->unitCost,
            );

            if ($data->type === DocumentType::Adjustment && isset($seen[$line->productId])) {
                $errors["lines.{$i}.product_id"] = ['El producto está repetido en el ajuste.'];
            }
            $seen[$line->productId] = true;
        }

        if ($errors !== []) {
            throw new InvalidDocumentException($errors);
        }
    }
}
