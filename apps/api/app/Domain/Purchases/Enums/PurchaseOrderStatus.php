<?php

namespace App\Domain\Purchases\Enums;

enum PurchaseOrderStatus: string
{
    case Draft = 'draft';
    case Approved = 'approved';
    case PartiallyReceived = 'partially_received';
    case Received = 'received';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Borrador',
            self::Approved => 'Aprobada',
            self::PartiallyReceived => 'Recibida parcialmente',
            self::Received => 'Recibida',
            self::Cancelled => 'Cancelada',
        };
    }

    /** Statuses that still expect goods ("órdenes pendientes"). */
    public static function open(): array
    {
        return [self::Approved, self::PartiallyReceived];
    }

    public function canReceive(): bool
    {
        return in_array($this, self::open(), true);
    }
}
