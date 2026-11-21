<?php

namespace App\Domain\Sales\Enums;

/**
 * Identity document of a customer (Bolivia). CEX: cédula de extranjero.
 */
enum CustomerDocumentType: string
{
    case Ci = 'ci';
    case CiComplement = 'ci_complement';
    case Nit = 'nit';
    case Passport = 'passport';
    case Cex = 'cex';

    public function label(): string
    {
        return match ($this) {
            self::Ci => 'CI',
            self::CiComplement => 'CI con complemento',
            self::Nit => 'NIT',
            self::Passport => 'Pasaporte',
            self::Cex => 'Cédula de extranjero',
        };
    }

    public function requiresComplement(): bool
    {
        return $this === self::CiComplement;
    }
}
