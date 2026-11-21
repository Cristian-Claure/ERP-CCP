<?php

namespace App\Domain\Sales\Enums;

/**
 * Invoice and sales note are the same document with a different fiscal
 * nature (ADR 0005); a quote has no effect on stock nor receivables.
 */
enum SalesDocumentType: string
{
    case Quote = 'quote';
    case Invoice = 'invoice';
    case SalesNote = 'sales_note';

    public function label(): string
    {
        return match ($this) {
            self::Quote => 'Cotización',
            self::Invoice => 'Factura',
            self::SalesNote => 'Nota de venta',
        };
    }

    public function prefix(): string
    {
        return match ($this) {
            self::Quote => 'COT',
            self::Invoice => 'VTA',
            self::SalesNote => 'NV',
        };
    }

    public function sequenceKey(): string
    {
        return 'sales.'.$this->value;
    }

    /** Invoices and sales notes move stock and create a receivable. */
    public function isSale(): bool
    {
        return $this !== self::Quote;
    }
}
