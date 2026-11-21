<?php

namespace App\Domain\Sales\Enums;

/**
 * Collection status of a customer, derived from its open sales:
 * overdue (something past due) > due_soon (due within DUE_SOON_DAYS) >
 * current (owes, nothing due yet) > none (owes nothing).
 */
enum DebtStatus: string
{
    case None = 'none';
    case Current = 'current';
    case DueSoon = 'due_soon';
    case Overdue = 'overdue';

    public const DUE_SOON_DAYS = 7;

    public function label(): string
    {
        return match ($this) {
            self::None => 'Sin deuda',
            self::Current => 'Al día',
            self::DueSoon => 'Por vencer',
            self::Overdue => 'Vencida',
        };
    }
}
