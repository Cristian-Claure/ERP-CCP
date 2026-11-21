<?php

namespace App\Domain\Inventory\Actions;

use App\Domain\Inventory\Data\MovementResult;
use App\Domain\Inventory\Enums\DocumentStatus;
use App\Domain\Inventory\Enums\DocumentType;
use App\Domain\Inventory\Enums\MovementKind;
use App\Domain\Inventory\Events\InventoryDocumentPosted;
use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Inventory\Exceptions\InvalidDocumentException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\InventoryDocumentLine;
use App\Domain\Inventory\Services\DocumentValidator;
use App\Domain\Inventory\Services\LedgerSession;
use App\Domain\Inventory\Services\StockLedger;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentNumberer;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Illuminate\Support\Facades\DB;

/**
 * Posts a draft: writes the stock movements, updates balances and assigns
 * the gapless number, all in ONE transaction.
 *
 * Idempotent: the document row is locked first; posting an already posted
 * document returns it unchanged (double click / retry never duplicates
 * movements). A DB unique index on stock_movements is the last safety net.
 */
class PostInventoryDocument
{
    public function __construct(
        private readonly DocumentValidator $validator,
        private readonly StockLedger $ledger,
        private readonly DocumentNumberer $numberer,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @throws InvalidDocumentException|InsufficientStockException
     */
    public function handle(InventoryDocument $document, User $actor): InventoryDocument
    {
        return DB::transaction(function () use ($document, $actor) {
            /** @var InventoryDocument $doc */
            $doc = InventoryDocument::query()->lockForUpdate()->findOrFail($document->id);

            if ($doc->status === DocumentStatus::Posted) {
                return $doc->load('lines');
            }

            if ($doc->status !== DocumentStatus::Draft) {
                throw InvalidDocumentException::state('El documento está anulado y no puede confirmarse.');
            }

            $doc->load(['lines.product.unit', 'warehouse', 'destinationWarehouse']);
            $company = $doc->company()->firstOrFail();

            $this->validator->assertPostable($doc, $company);

            $session = $this->ledger->begin($company, $doc, $this->pairs($doc), $actor->id);
            $total = new Number('0');

            foreach ($doc->lines as $line) {
                $total += Decimal::abs($this->applyLine($doc, $line, $session));
            }

            $session->commit();

            $doc->forceFill([
                'status' => DocumentStatus::Posted,
                'number' => $this->numberer->next($company->id, $doc->type->sequenceKey(), $doc->type->prefix()),
                'total_cost' => (string) $total,
                'posted_by' => $actor->id,
                'posted_at' => now(),
            ])->save();

            $this->audit->log('inventory.document.posted', actor: $actor, auditable: $doc, new: [
                'number' => $doc->number,
                'type' => $doc->type->value,
                'warehouse_id' => $doc->warehouse_id,
                'destination_warehouse_id' => $doc->destination_warehouse_id,
                'total_cost' => $doc->total_cost,
                'lines' => $doc->lines->count(),
            ]);

            InventoryDocumentPosted::dispatch($doc);

            return $doc->load('lines');
        });
    }

    /**
     * Applies one line to the ledger and snapshots costs on the line.
     * Returns the line's absolute cost.
     */
    private function applyLine(InventoryDocument $doc, InventoryDocumentLine $line, LedgerSession $session): Number
    {
        $productId = $line->product_id;
        $warehouseId = $doc->warehouse_id;

        $result = match ($doc->type) {
            DocumentType::Entry => $session->receive($line->id, $productId, $warehouseId, MovementKind::In, new Number($line->quantity), new Number($line->unit_cost)),
            DocumentType::Exit => $session->issue($line->id, $productId, $warehouseId, MovementKind::Out, new Number($line->quantity)),
            DocumentType::Transfer => $this->transfer($doc, $line, $session),
            DocumentType::Adjustment => $this->adjust($doc, $line, $session),
        };

        // Single write per line: cost snapshot (+ adjustment quantities set above).
        $line->forceFill($result === null
            ? ['total_cost' => '0'] // adjustment without difference
            : ['unit_cost' => (string) $result->unitCost, 'total_cost' => (string) Decimal::abs($result->totalCost)]
        )->save();

        return $result?->totalCost ?? new Number('0');
    }

    /**
     * Out of origin at its average cost; into destination at that same cost.
     */
    private function transfer(InventoryDocument $doc, InventoryDocumentLine $line, LedgerSession $session): MovementResult
    {
        $quantity = new Number($line->quantity);
        $out = $session->issue($line->id, $line->product_id, $doc->warehouse_id, MovementKind::TransferOut, $quantity);
        $session->receive($line->id, $line->product_id, $doc->destination_warehouse_id, MovementKind::TransferIn, $quantity, $out->unitCost);

        return $out;
    }

    /**
     * Difference computed against the balance AT POSTING TIME. Snapshots the
     * system and difference quantities on the line (persisted by applyLine).
     */
    private function adjust(InventoryDocument $doc, InventoryDocumentLine $line, LedgerSession $session): ?MovementResult
    {
        $balance = $session->balance($line->product_id, $doc->warehouse_id);
        $difference = new Number($line->counted_quantity) - $balance->quantity;

        $line->system_quantity = (string) $balance->quantity;
        $line->quantity = (string) $difference;

        if ($difference == 0) {
            return null;
        }

        if ($difference < 0) {
            return $session->issue($line->id, $line->product_id, $doc->warehouse_id, MovementKind::AdjustOut, Decimal::abs($difference));
        }

        return $session->receive($line->id, $line->product_id, $doc->warehouse_id, MovementKind::AdjustIn, $difference, $this->surplusUnitCost($line, $balance->avgCost));
    }

    /**
     * A surplus enters at the cost typed on the line or, if none, at the
     * current average. Without either there is no way to value it.
     *
     * @throws InvalidDocumentException
     */
    private function surplusUnitCost(InventoryDocumentLine $line, Number $avgCost): Number
    {
        if ($line->unit_cost !== null) {
            return new Number($line->unit_cost);
        }

        if ($avgCost == 0) {
            throw InvalidDocumentException::with([
                "lines.{$line->position}.unit_cost" => 'El producto no tiene costo previo: ingresa el costo unitario del sobrante.',
            ]);
        }

        return $avgCost;
    }

    /**
     * @return list<array{0: int, 1: int}>
     */
    private function pairs(InventoryDocument $doc): array
    {
        $pairs = [];
        foreach ($doc->lines as $line) {
            $pairs[] = [$line->product_id, $doc->warehouse_id];
            if ($doc->type === DocumentType::Transfer) {
                $pairs[] = [$line->product_id, $doc->destination_warehouse_id];
            }
        }

        return $pairs;
    }
}
