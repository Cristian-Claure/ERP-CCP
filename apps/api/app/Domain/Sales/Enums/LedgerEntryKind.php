<?php

namespace App\Domain\Sales\Enums;

/**
 * Customer ledger: a charge increases the debt (+), a payment reduces it
 * (−) and a reversal undoes either one (opposite sign).
 */
enum LedgerEntryKind: string
{
    case Charge = 'charge';
    case Payment = 'payment';
    case Reversal = 'reversal';

    public function label(): string
    {
        return match ($this) {
            self::Charge => 'Cargo',
            self::Payment => 'Cobro',
            self::Reversal => 'Reversión',
        };
    }
}
