<?php

namespace App\Domain\Sales\Enums;

enum PaymentMethod: string
{
    case Cash = 'cash';
    case Transfer = 'transfer';
    case Qr = 'qr';
    case Card = 'card';
    case Check = 'check';

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Efectivo',
            self::Transfer => 'Transferencia',
            self::Qr => 'QR',
            self::Card => 'Tarjeta',
            self::Check => 'Cheque',
        };
    }
}
