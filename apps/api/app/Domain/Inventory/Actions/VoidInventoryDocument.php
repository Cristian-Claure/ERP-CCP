<?php

namespace App\Domain\Inventory\Actions;

use App\Domain\Inventory\Enums\DocumentStatus;
use App\Domain\Inventory\Events\InventoryDocumentVoided;
use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Inventory\Exceptions\InvalidDocumentException;
use App\Domain\Inventory\Exceptions\VoidCostInconsistencyException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\StockMovement;
use App\Domain\Inventory\Services\StockLedger;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Voids a posted document by creating the reverse of each of its movements
 * at the ORIGINAL cost. Blocked when it would leave negative stock (unless
 * allowed) or break the valuation invariant. Idempotent.
 */
class VoidInventoryDocument
{
    public const MIN_REASON_LENGTH = 5;

    public function __construct(
        private readonly StockLedger $ledger,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @throws InvalidDocumentException|InsufficientStockException|VoidCostInconsistencyException
     */
    public function handle(InventoryDocument $document, User $actor, string $reason): InventoryDocument
    {
        $reason = trim($reason);

        return DB::transaction(function () use ($document, $actor, $reason) {
            /** @var InventoryDocument $doc */
            $doc = InventoryDocument::query()->lockForUpdate()->findOrFail($document->id);

            if ($doc->status === DocumentStatus::Voided) {
                return $doc->load('lines');
            }

            if ($doc->status !== DocumentStatus::Posted) {
                throw InvalidDocumentException::state('Solo se pueden anular documentos confirmados. Los borradores se eliminan.');
            }

            if (mb_strlen($reason) < self::MIN_REASON_LENGTH) {
                throw InvalidDocumentException::with(['reason' => sprintf('El motivo de anulación es obligatorio (mínimo %d caracteres).', self::MIN_REASON_LENGTH)]);
            }

            $company = $doc->company()->firstOrFail();

            // Reverse in the opposite order they were created (e.g. a transfer
            // first takes stock back out of the destination).
            $movements = $doc->movements()
                ->whereNull('reverses_movement_id')
                ->orderByDesc('id')
                ->get();

            $session = $this->ledger->begin(
                $company,
                $doc,
                $movements->map(fn (StockMovement $m) => [$m->product_id, $m->warehouse_id])->all(),
                $actor->id,
            );

            foreach ($movements as $movement) {
                $session->reverse($movement);
            }

            $session->commit();

            $doc->forceFill([
                'status' => DocumentStatus::Voided,
                'voided_by' => $actor->id,
                'voided_at' => now(),
                'void_reason' => $reason,
            ])->save();

            $this->audit->log('inventory.document.voided', actor: $actor, auditable: $doc, old: [
                'status' => DocumentStatus::Posted->value,
            ], new: [
                'status' => DocumentStatus::Voided->value,
                'number' => $doc->number,
                'reason' => $reason,
            ]);

            InventoryDocumentVoided::dispatch($doc);

            return $doc->load('lines');
        });
    }
}
