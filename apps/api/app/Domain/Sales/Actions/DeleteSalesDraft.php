<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Drafts (no number, no effects) may be discarded; audited with a snapshot.
 */
class DeleteSalesDraft
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(SalesDocument $document, User $actor): void
    {
        DB::transaction(function () use ($document, $actor) {
            /** @var SalesDocument $locked */
            $locked = SalesDocument::query()->lockForUpdate()->findOrFail($document->id);

            if (! $locked->isDraft()) {
                throw InvalidSalesDocumentException::state('Solo se pueden eliminar borradores. Los documentos confirmados se anulan.');
            }

            $locked->load('lines');

            $this->audit->log('sales.document.draft_deleted', actor: $actor, auditable: $locked, old: [
                'type' => $locked->type->value,
                'customer_id' => $locked->customer_id,
                'document_date' => $locked->document_date->toDateString(),
                'total' => $locked->total,
                'lines' => $locked->lines->map->only(['product_id', 'quantity', 'unit_price', 'discount_amount'])->all(),
            ]);

            $locked->lines()->delete();
            $locked->delete();
        });
    }
}
