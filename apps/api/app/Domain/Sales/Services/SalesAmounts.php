<?php

namespace App\Domain\Sales\Services;

use App\Domain\Sales\Data\SalesTotals;
use App\Domain\Sales\Enums\SalesDocumentType;
use App\Domain\Sales\Models\SalesDocument;
use App\Domain\Sales\Models\SalesDocumentLine;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Support\Decimal;

/**
 * Bridges SalesCalculator and the persisted document: computes the amounts
 * from the document lines and writes them on the header and each line.
 * Used on every draft save and, authoritatively, on posting.
 */
class SalesAmounts
{
    public function __construct(private readonly SalesCalculator $calculator) {}

    /**
     * ADR 0005: invoices (and quotes, informatively) break down VAT; sales
     * notes only when the company enables it.
     */
    public function breaksDownVat(Company $company, SalesDocumentType $type): bool
    {
        return $type !== SalesDocumentType::SalesNote || $company->sales_note_vat_breakdown;
    }

    /**
     * Expects `lines` loaded. Saves lines; the caller saves the header.
     */
    public function apply(SalesDocument $document, Company $company): SalesTotals
    {
        $totals = $this->calculator->compute(
            $document->lines->map(fn (SalesDocumentLine $l) => [
                'quantity' => (string) $l->quantity,
                'unit_price' => (string) $l->unit_price,
                'discount_amount' => (string) $l->discount_amount,
            ])->values()->all(),
            (string) ($document->global_discount ?? '0'),
            $this->breaksDownVat($company, $document->type),
        );

        foreach ($document->lines->values() as $i => $line) {
            $amounts = $totals->lines[$i];
            $line->forceFill([
                'gross_amount' => Decimal::money($amounts->gross),
                'global_discount_share' => Decimal::money($amounts->globalShare),
                'total' => Decimal::money($amounts->total),
                'iva_amount' => Decimal::money($amounts->vat),
                'net_amount' => Decimal::money($amounts->net),
            ])->save();
        }

        $document->forceFill([
            'subtotal' => Decimal::money($totals->subtotal),
            'line_discount_total' => Decimal::money($totals->lineDiscountTotal),
            'global_discount' => Decimal::money($totals->globalDiscount),
            'total' => Decimal::money($totals->total),
            'iva_amount' => Decimal::money($totals->vat),
            'net_amount' => Decimal::money($totals->net),
        ]);

        return $totals;
    }
}
