<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Inventory\Actions\VoidInventoryDocument;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Sales\Enums\PaymentStatus;
use App\Domain\Sales\Enums\SalesDocumentStatus;
use App\Domain\Sales\Events\SalesDocumentVoided;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Exceptions\LinkedInventoryException;
use App\Domain\Sales\Exceptions\SaleHasPaymentsException;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\CustomerPayment;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Services\CustomerLedger;
use App\Domain\Sales\Services\ReceiptWriter;
use App\Domain\Shared\Exceptions\DomainException;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentDateWindow;
use Illuminate\Support\Facades\DB;

/**
 * Voids a posted sales document in ONE transaction, in cascade:
 * automatic receipt (cash sale) -> its SAL- (through VoidInventoryDocument,
 * at the original cost) -> reversal of the receivable charge.
 *
 * Blocked while manual receipts are applied to the sale. If the stock exit
 * cannot be reversed (e.g. void_cost_inconsistency) nothing is voided.
 * Idempotent.
 */
class VoidSalesDocument
{
    public const MIN_REASON_LENGTH = 5;

    public function __construct(
        private readonly VoidInventoryDocument $voidInventory,
        private readonly CustomerLedger $ledger,
        private readonly ReceiptWriter $receipts,
        private readonly DocumentDateWindow $dates,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @throws InvalidSalesDocumentException|SaleHasPaymentsException|LinkedInventoryException
     */
    public function handle(SalesDocument $document, User $actor, string $reason): SalesDocument
    {
        $reason = trim($reason);

        return DB::transaction(function () use ($document, $actor, $reason) {
            $customerId = SalesDocument::query()->whereKey($document->id)->value('customer_id');
            $customer = Customer::query()->lockForUpdate()->findOrFail($customerId);
            /** @var SalesDocument $doc */
            $doc = SalesDocument::query()->lockForUpdate()->findOrFail($document->id);

            if ($doc->status === SalesDocumentStatus::Voided) {
                return $doc->load('lines');
            }

            if ($doc->status !== SalesDocumentStatus::Posted) {
                throw InvalidSalesDocumentException::state('Solo se pueden anular documentos confirmados. Los borradores se eliminan.');
            }

            if (mb_strlen($reason) < self::MIN_REASON_LENGTH) {
                throw InvalidSalesDocumentException::with(['reason' => sprintf('El motivo de anulación es obligatorio (mínimo %d caracteres).', self::MIN_REASON_LENGTH)]);
            }

            if ($doc->type->isSale()) {
                $this->reverseSale($doc, $customer, $actor, $reason);
            }

            $doc->forceFill([
                'status' => SalesDocumentStatus::Voided,
                'voided_by' => $actor->id,
                'voided_at' => now(),
                'void_reason' => $reason,
            ])->save();

            $this->audit->log('sales.document.voided', actor: $actor, auditable: $doc, old: [
                'status' => SalesDocumentStatus::Posted->value,
            ], new: [
                'status' => SalesDocumentStatus::Voided->value,
                'number' => $doc->number,
                'reason' => $reason,
                'inventory_document_id' => $doc->inventory_document_id,
            ]);

            SalesDocumentVoided::dispatch($doc);

            return $doc->load('lines');
        });
    }

    private function reverseSale(SalesDocument $doc, Customer $customer, User $actor, string $reason): void
    {
        $this->assertNoManualPayments($doc);

        $today = $this->dates->today($customer->company()->firstOrFail());

        // 1. The automatic receipt(s) of a cash sale go with it (one per tender in mixed payments).
        $automatic = CustomerPayment::query()
            ->where('sales_document_id', $doc->id)
            ->where('status', PaymentStatus::Posted)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($automatic as $receipt) {
            $this->receipts->void($customer, $receipt, $today, $actor, "Anulación de {$doc->number}: {$reason}");
        }

        // 2. The stock exit, at its original cost. Any failure aborts the whole void.
        /** @var InventoryDocument $exit */
        $exit = InventoryDocument::query()->findOrFail($doc->inventory_document_id);
        try {
            $this->voidInventory->handle($exit, $actor, "Anulación de {$doc->number}: {$reason}");
        } catch (DomainException $e) {
            throw new LinkedInventoryException($e, $doc->number, (string) $exit->number);
        }

        // 3. The receivable charge.
        $this->ledger->reverse($customer, $doc, $today, sprintf('Anulación de %s %s', $doc->type->label(), $doc->number), $actor->id);
    }

    /**
     * @throws SaleHasPaymentsException
     */
    private function assertNoManualPayments(SalesDocument $doc): void
    {
        $numbers = CustomerPayment::query()
            ->where('status', PaymentStatus::Posted)
            ->where(fn ($q) => $q->whereNull('sales_document_id')->orWhere('sales_document_id', '!=', $doc->id))
            ->whereHas('allocations', fn ($q) => $q->where('sales_document_id', $doc->id))
            ->orderBy('id')
            ->pluck('number')
            ->all();

        if ($numbers !== []) {
            throw new SaleHasPaymentsException((string) $doc->number, $numbers);
        }
    }
}
