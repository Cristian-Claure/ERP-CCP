<?php

namespace App\Domain\Sales\Enums;

enum CustomerSegment: string
{
    case Retail = 'retail';
    case Wholesale = 'wholesale';
    case Corporate = 'corporate';

    public function label(): string
    {
        return match ($this) {
            self::Retail => 'Minorista',
            self::Wholesale => 'Mayorista',
            self::Corporate => 'Corporativo',
        };
    }
}
