<?php

namespace App\Domain\Purchases\Enums;

/** Additional costs of a receipt, prorated into the unit cost by value (ADR 0006). */
enum ReceiptCostKind: string
{
    case Freight = 'freight';
    case Unloading = 'unloading';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Freight => 'Flete',
            self::Unloading => 'Descarga',
            self::Other => 'Otros',
        };
    }
}
