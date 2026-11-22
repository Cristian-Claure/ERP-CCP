<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Sales\Data\SalesDocumentData;
use App\Domain\Sales\Enums\PaymentTerms;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Services\SalesAmounts;
use App\Domain\Sales\Services\SalesDocumentValidator;
use App\Domain\Shared\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates or updates a DRAFT sales document (header + full replacement of
 * lines) and computes its amounts. Drafts never touch stock, receivables
 * nor numbering.
 */
class SaveSalesDraft
{
    public function __construct(
        private readonly SalesDocumentValidator $validator,
        private readonly SalesAmounts $amounts,
    ) {}

    /**
     * @throws InvalidSalesDocumentException
     */
    public function handle(SalesDocumentData $data, User $actor, ?SalesDocument $document = null): SalesDocument
    {
        if ($document === null && $data->idempotencyKey !== null) {
            $existing = SalesDocument::query()->where('idempotency_key', $data->idempotencyKey)->first();
            if ($existing !== null) {
                return $existing->load('lines');
            }
        }

        if ($document !== null && ! $document->isDraft()) {
            throw InvalidSalesDocumentException::state('Solo se pueden editar documentos en borrador.');
        }

        $company = $actor->company;

        // Validation runs on the persisted draft; any error rolls everything back.
        return DB::transaction(function () use ($data, $actor, $document, $company) {
            $customer = Customer::query()->find($data->customerId);
            $terms = $data->paymentTerms ?? $customer?->payment_terms ?? PaymentTerms::Cash;

            $document ??= new SalesDocument([
                'type' => $data->type,
                'created_by' => $actor->id,
                'idempotency_key' => $data->idempotencyKey,
                'quote_id' => $data->quoteId,
            ]);

            $document->fill([
                'customer_id' => $data->customerId,
                'warehouse_id' => $data->warehouseId,
                'document_date' => $data->documentDate->toDateString(),
                'payment_terms' => $terms,
                'payment_method' => $terms === PaymentTerms::Cash ? $data->paymentMethod : null,
                'valid_until' => $data->type === SalesDocumentType::Quote
                    ? ($data->validUntil ?? $data->documentDate->addDays($company->quote_validity_days))->toDateString()
                    : null,
                'due_date' => $data->type->isSale()
                    ? $data->documentDate->addDays($terms === PaymentTerms::Credit ? (int) $customer?->credit_days : 0)->toDateString()
                    : null,
                'global_discount' => $data->globalDiscount,
                'reference' => $data->reference,
                'notes' => $data->notes,
            ])->save();

            $document->lines()->delete();

            foreach ($data->lines as $position => $line) {
                $document->lines()->create([
                    'product_id' => $line->productId,
                    'position' => $position,
                    'quantity' => $line->quantity,
                    'unit_price' => $line->unitPrice,
                    'discount_amount' => $line->discountAmount,
                    'notes' => $line->notes,
                ]);
            }

            $document->load(['customer', 'warehouse', 'lines.product.unit']);
            $this->validator->assertValid($document, $company);
            $this->amounts->apply($document, $company);
            $document->save();

            return $document->load('lines');
        });
    }
}
