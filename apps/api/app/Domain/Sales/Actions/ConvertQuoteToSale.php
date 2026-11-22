<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Sales\Data\SalesDocumentData;
use App\Domain\Sales\Data\SalesLineData;
use App\Domain\Sales\Enums\SalesDocumentStatus;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Models\SalesDocumentLine;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentDateWindow;
use Illuminate\Support\Facades\DB;

/**
 * Turns a posted, still valid quote into a DRAFT sale (invoice or sales
 * note) with the same customer, warehouse, lines, prices and discounts,
 * dated today and referencing the quote. A quote converts only once
 * (unless that sale is voided).
 */
class ConvertQuoteToSale
{
    public function __construct(
        private readonly SaveSalesDraft $saveDraft,
        private readonly DocumentDateWindow $dates,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @throws InvalidSalesDocumentException
     */
    public function handle(SalesDocument $quote, SalesDocumentType $target, User $actor): SalesDocument
    {
        if (! $target->isSale()) {
            throw InvalidSalesDocumentException::with(['type' => 'Una cotización se convierte en factura o nota de venta.']);
        }

        return DB::transaction(function () use ($quote, $target, $actor) {
            /** @var SalesDocument $locked */
            $locked = SalesDocument::query()->lockForUpdate()->findOrFail($quote->id);
            $today = $this->dates->today($actor->company);

            if ($locked->type !== SalesDocumentType::Quote || $locked->status !== SalesDocumentStatus::Posted) {
                throw InvalidSalesDocumentException::state('Solo se pueden convertir cotizaciones confirmadas.');
            }

            if ($locked->valid_until !== null && $locked->valid_until->lt($today)) {
                throw InvalidSalesDocumentException::with([
                    'valid_until' => sprintf('La cotización %s venció el %s.', $locked->number, $locked->valid_until->format('d/m/Y')),
                ], 'quote_expired');
            }

            $existing = $locked->conversions()->where('status', '!=', SalesDocumentStatus::Voided)->first();
            if ($existing !== null) {
                throw InvalidSalesDocumentException::with([
                    'quote_id' => sprintf('La cotización ya fue convertida (%s).', $existing->number ?? 'borrador #'.$existing->id),
                ], 'quote_already_converted');
            }

            $locked->load('lines');
            $sale = $this->saveDraft->handle(new SalesDocumentData(
                type: $target,
                customerId: $locked->customer_id,
                warehouseId: $locked->warehouse_id,
                documentDate: $today,
                lines: $locked->lines->map(fn (SalesDocumentLine $l) => new SalesLineData(
                    productId: $l->product_id,
                    quantity: (string) $l->quantity,
                    unitPrice: (string) $l->unit_price,
                    discountAmount: (string) $l->discount_amount,
                    notes: $l->notes,
                ))->values()->all(),
                paymentTerms: $locked->payment_terms,
                paymentMethod: $locked->payment_method,
                globalDiscount: (string) $locked->global_discount,
                reference: $locked->number,
                notes: $locked->notes,
                quoteId: $locked->id,
            ), $actor);

            $this->audit->log('sales.quote.converted', actor: $actor, auditable: $locked, new: [
                'sales_document_id' => $sale->id,
                'type' => $target->value,
            ]);

            return $sale;
        });
    }
}
