<?php

namespace App\Domain\Sales\Actions;

use App\Domain\Inventory\Actions\PostInventoryDocument;
use App\Domain\Inventory\Actions\SaveInventoryDocumentDraft;
use App\Domain\Inventory\Data\DocumentData;
use App\Domain\Inventory\Data\DocumentLineData;
use App\Domain\Inventory\Enums\DocumentType;
use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Sales\Data\PostingAuthorization;
use App\Domain\Sales\Data\TenderData;
use App\Domain\Sales\Enums\PaymentTerms;
use App\Domain\Sales\Enums\SalesDocumentStatus;
use App\Domain\Sales\Events\SalesDocumentPosted;
use App\Domain\Sales\Exceptions\CreditLimitExceededException;
use App\Domain\Sales\Exceptions\InvalidSalesDocumentException;
use App\Domain\Sales\Exceptions\PriceBelowCostException;
use App\Domain\Sales\Models\Customer;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Models\SalesDocumentLine;
use App\Domain\Sales\Services\CustomerLedger;
use App\Domain\Sales\Services\ReceiptWriter;
use App\Domain\Sales\Services\SalesAmounts;
use App\Domain\Sales\Services\SalesDocumentValidator;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Services\AuditLogger;
use App\Domain\Shared\Services\DocumentNumberer;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

/**
 * Posts a draft quote, invoice or sales note in ONE transaction.
 *
 * For a sale: credit check -> number -> SAL- through the inventory Actions
 * (insufficient_stock aborts everything, no number consumed) -> cost and
 * margin per line from the SAL- -> price check (below cost / min price) ->
 * receivable charge (+ automatic receipt when cash; one receipt per tender
 * for mixed payments, e.g. part cash and part QR) -> audit.
 *
 * Lock order (shared with VoidSalesDocument, RegisterPayment and
 * VoidPayment): customer -> sales document -> stock balances.
 * Idempotent: posting an already posted document returns it unchanged.
 */
class PostSalesDocument
{
    public function __construct(
        private readonly SalesDocumentValidator $validator,
        private readonly SalesAmounts $amounts,
        private readonly CustomerLedger $ledger,
        private readonly ReceiptWriter $receipts,
        private readonly DocumentNumberer $numberer,
        private readonly AuditLogger $audit,
        private readonly SaveInventoryDocumentDraft $saveInventoryDraft,
        private readonly PostInventoryDocument $postInventory,
    ) {}

    /**
     * @param  list<TenderData>  $tenders  split of a cash sale by method (default: one tender for the total)
     *
     * @throws InvalidSalesDocumentException|CreditLimitExceededException|PriceBelowCostException|InsufficientStockException|AuthorizationException
     */
    public function handle(SalesDocument $document, User $actor, ?PostingAuthorization $authorization = null, array $tenders = []): SalesDocument
    {
        $authorization ??= PostingAuthorization::none();
        $this->assertCanAuthorize($authorization, $actor);

        return DB::transaction(function () use ($document, $actor, $authorization, $tenders) {
            [$customer, $doc] = $this->lock($document);

            if ($doc->status === SalesDocumentStatus::Posted) {
                return $doc->load('lines');
            }

            if ($doc->status !== SalesDocumentStatus::Draft) {
                throw InvalidSalesDocumentException::state('El documento está anulado y no puede confirmarse.');
            }

            $company = $doc->company()->firstOrFail();
            $doc->load(['warehouse', 'lines.product.unit'])->setRelation('customer', $customer);

            $this->validator->assertValid($doc, $company);
            $this->amounts->apply($doc, $company);

            if ($doc->type->isSale()) {
                $this->postSale($doc, $customer, $company, $actor, $authorization, $tenders);
            } else {
                $doc->forceFill(['number' => $this->nextNumber($doc, $company)]);
            }

            $doc->forceFill([
                'status' => SalesDocumentStatus::Posted,
                'posted_by' => $actor->id,
                'posted_at' => now(),
            ])->save();

            $this->audit->log('sales.document.posted', actor: $actor, auditable: $doc, new: [
                'number' => $doc->number,
                'type' => $doc->type->value,
                'customer_id' => $doc->customer_id,
                'total' => $doc->total,
                'payment_terms' => $doc->payment_terms->value,
                'inventory_document_id' => $doc->inventory_document_id,
            ]);

            SalesDocumentPosted::dispatch($doc);

            return $doc->load('lines');
        });
    }

    /**
     * @param  list<TenderData>  $tenders
     */
    private function postSale(SalesDocument $doc, Customer $customer, Company $company, User $actor, PostingAuthorization $authorization, array $tenders): void
    {
        $isCredit = $doc->payment_terms === PaymentTerms::Credit;
        if ($isCredit && $tenders !== []) {
            throw InvalidSalesDocumentException::with(['payments' => 'Una venta a crédito no se cobra al confirmarla.']);
        }
        $doc->due_date = $doc->document_date->copy()->addDays($isCredit ? $customer->credit_days : 0);

        // 1. Credit first: the total is already known, no need to touch stock.
        if ($isCredit) {
            $this->checkCredit($doc, $customer, $actor, $authorization);
        }

        // 2. Number inside the transaction: a later failure rolls it back.
        $doc->forceFill(['number' => $this->nextNumber($doc, $company)]);

        // 3. Stock exit through the public inventory Actions.
        $exit = $this->postStockExit($doc, $actor);

        // 4. Cost and margin per line, from the costs the SAL- actually used.
        $this->snapshotCosts($doc, $exit);

        // 5. Price rules need the real cost, so they run after the exit.
        $this->checkPrices($doc, $actor, $authorization);

        $doc->forceFill(['inventory_document_id' => $exit->id])->save();

        // 6. Receivable: charge, and its immediate payment when cash.
        $this->ledger->charge($customer, $doc, $actor->id);

        if (! $isCredit) {
            $this->receipts->collectCashSale($doc, $customer, $actor, $tenders);
        }
    }

    /**
     * Customer first, then the document: same order as payments and voids.
     *
     * @return array{0: Customer, 1: SalesDocument}
     */
    private function lock(SalesDocument $document): array
    {
        $customerId = SalesDocument::query()->whereKey($document->id)->value('customer_id');
        $customer = Customer::query()->lockForUpdate()->findOrFail($customerId);
        /** @var SalesDocument $doc */
        $doc = SalesDocument::query()->lockForUpdate()->findOrFail($document->id);

        if ($doc->customer_id !== $customer->id) {
            throw InvalidSalesDocumentException::state('El documento cambió mientras se confirmaba. Vuelve a intentarlo.');
        }

        return [$customer, $doc];
    }

    private function checkCredit(SalesDocument $doc, Customer $customer, User $actor, PostingAuthorization $authorization): void
    {
        $balance = Decimal::of($customer->balance);
        $limit = Decimal::of($customer->credit_limit);
        $total = Decimal::of($doc->total);

        if ($balance + $total <= $limit) {
            return;
        }

        if ($authorization->creditOverrideReason === null) {
            throw new CreditLimitExceededException($customer->id, $customer->name, $balance, $limit, $total);
        }

        $doc->forceFill([
            'credit_override_by' => $actor->id,
            'credit_override_at' => now(),
            'credit_override_reason' => $authorization->creditOverrideReason,
        ]);

        $this->audit->log('sales.credit_limit.overridden', actor: $actor, auditable: $doc, new: [
            'customer_id' => $customer->id,
            'balance' => Decimal::money($balance),
            'credit_limit' => Decimal::money($limit),
            'total' => Decimal::money($total),
            'reason' => $authorization->creditOverrideReason,
        ]);
    }

    private function postStockExit(SalesDocument $doc, User $actor): InventoryDocument
    {
        $draft = $this->saveInventoryDraft->handle(new DocumentData(
            type: DocumentType::Exit,
            warehouseId: $doc->warehouse_id,
            documentDate: CarbonImmutable::parse($doc->document_date->toDateString()),
            lines: $doc->lines->map(fn (SalesDocumentLine $l) => new DocumentLineData(
                productId: $l->product_id,
                quantity: (string) $l->quantity,
            ))->values()->all(),
            reference: $doc->number,
            notes: sprintf('Salida generada por %s %s.', $doc->type->label(), $doc->number),
            source: $doc,
        ), $actor);

        return $this->postInventory->handle($draft, $actor)->load('lines');
    }

    private function snapshotCosts(SalesDocument $doc, InventoryDocument $exit): void
    {
        $exitLines = $exit->lines->values();
        $cost = new Number('0');
        $margin = new Number('0');

        foreach ($doc->lines->values() as $i => $line) {
            $lineCost = Decimal::of($exitLines[$i]->total_cost)->round(2);
            $lineMargin = Decimal::of($line->net_amount) - $lineCost;

            $line->forceFill([
                'unit_cost' => $exitLines[$i]->unit_cost,
                'cost_total' => Decimal::money($lineCost),
                'margin' => Decimal::money($lineMargin),
            ])->save();

            $cost += $lineCost;
            $margin += $lineMargin;
        }

        $doc->forceFill(['cost_total' => Decimal::money($cost), 'margin_total' => Decimal::money($margin)]);
    }

    private function checkPrices(SalesDocument $doc, User $actor, PostingAuthorization $authorization): void
    {
        $violations = [];

        foreach ($doc->lines->values() as $i => $line) {
            $product = $line->product;
            $total = Decimal::of($line->total);
            $minPrice = $product->min_price !== null ? Decimal::of($product->min_price) : null;
            $base = [
                'position' => $i,
                'product_id' => $product->id,
                'product' => $product->name,
                'unit_price' => (string) $line->unit_price,
                'min_price' => $product->min_price,
            ];

            if (Decimal::of($line->net_amount) < Decimal::of($line->cost_total)) {
                $violations[] = [...$base, 'rule' => 'below_cost'];
            } elseif ($minPrice !== null && $total < ($minPrice * new Number((string) $line->quantity))->round(2)) {
                $violations[] = [...$base, 'rule' => 'below_min_price'];
            }
        }

        if ($violations === []) {
            return;
        }

        if ($authorization->belowCostReason === null) {
            throw new PriceBelowCostException($violations);
        }

        $doc->forceFill([
            'below_cost_authorized_by' => $actor->id,
            'below_cost_authorized_at' => now(),
            'below_cost_reason' => $authorization->belowCostReason,
        ]);

        $this->audit->log('sales.below_cost.authorized', actor: $actor, auditable: $doc, new: [
            'lines' => $violations,
            'reason' => $authorization->belowCostReason,
        ]);
    }

    private function nextNumber(SalesDocument $doc, Company $company): string
    {
        return $this->numberer->next($company->id, $doc->type->sequenceKey(), $doc->type->prefix());
    }

    /**
     * An authorization reason is only accepted from someone allowed to give it.
     *
     * @throws AuthorizationException|InvalidSalesDocumentException
     */
    private function assertCanAuthorize(PostingAuthorization $authorization, User $actor): void
    {
        $checks = [
            'below_cost_reason' => [$authorization->belowCostReason, 'sales.authorize_below_cost'],
            'credit_override_reason' => [$authorization->creditOverrideReason, 'sales.override_credit_limit'],
        ];

        foreach ($checks as $field => [$reason, $permission]) {
            if ($reason === null) {
                continue;
            }

            if (! $actor->can($permission)) {
                throw new AuthorizationException('No tienes permiso para autorizar esta excepción.');
            }

            if (mb_strlen($reason) < PostingAuthorization::MIN_REASON_LENGTH) {
                throw InvalidSalesDocumentException::with([$field => sprintf('El motivo debe tener al menos %d caracteres.', PostingAuthorization::MIN_REASON_LENGTH)]);
            }
        }
    }
}
