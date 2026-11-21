<?php

namespace App\Domain\Inventory\Actions;

use App\Domain\Inventory\Exceptions\InvalidDocumentException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Drafts (no number, no movements) may be discarded. The deletion is
 * audited with a snapshot of the draft.
 */
class DeleteInventoryDocumentDraft
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(InventoryDocument $document, User $actor): void
    {
        DB::transaction(function () use ($document, $actor) {
            /** @var InventoryDocument $locked */
            $locked = InventoryDocument::query()->lockForUpdate()->findOrFail($document->id);

            if (! $locked->isDraft()) {
                throw InvalidDocumentException::state('Solo se pueden eliminar borradores. Los documentos confirmados se anulan.');
            }

            $locked->load('lines');

            $this->audit->log(
                'inventory.document.draft_deleted',
                actor: $actor,
                auditable: $locked,
                old: [
                    'type' => $locked->type->value,
                    'warehouse_id' => $locked->warehouse_id,
                    'destination_warehouse_id' => $locked->destination_warehouse_id,
                    'document_date' => $locked->document_date->toDateString(),
                    'reference' => $locked->reference,
                    'lines' => $locked->lines->map->only(['product_id', 'quantity', 'counted_quantity', 'unit_cost'])->all(),
                ],
            );

            $locked->lines()->delete();
            $locked->delete();
        });
    }
}
