<?php

namespace App\Domain\Inventory\Enums;

enum DocumentType: string
{
    case Entry = 'entry';
    case Exit = 'exit';
    case Transfer = 'transfer';
    case Adjustment = 'adjustment';

    public function label(): string
    {
        return match ($this) {
            self::Entry => 'Entrada',
            self::Exit => 'Salida',
            self::Transfer => 'Transferencia',
            self::Adjustment => 'Ajuste por conteo',
        };
    }

    public function prefix(): string
    {
        return match ($this) {
            self::Entry => 'ENT',
            self::Exit => 'SAL',
            self::Transfer => 'TRF',
            self::Adjustment => 'AJU',
        };
    }

    /** Key in document_sequences. */
    public function sequenceKey(): string
    {
        return 'inventory.'.$this->value;
    }
}
