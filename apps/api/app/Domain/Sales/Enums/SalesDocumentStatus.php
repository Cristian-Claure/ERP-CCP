<?php

namespace App\Domain\Sales\Enums;

enum SalesDocumentStatus: string
{
    case Draft = 'draft';
    case Posted = 'posted';
    case Voided = 'voided';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Borrador',
            self::Posted => 'Confirmado',
            self::Voided => 'Anulado',
        };
    }
}
