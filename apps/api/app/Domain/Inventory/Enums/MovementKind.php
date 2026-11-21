<?php

namespace App\Domain\Inventory\Enums;

/**
 * Kind of an ORIGINAL movement. A reversal keeps the kind of the movement it
 * reverses, with opposite sign and reverses_movement_id set.
 */
enum MovementKind: string
{
    case In = 'in';
    case Out = 'out';
    case TransferIn = 'transfer_in';
    case TransferOut = 'transfer_out';
    case AdjustIn = 'adjust_in';
    case AdjustOut = 'adjust_out';

    public function label(): string
    {
        return match ($this) {
            self::In => 'Entrada',
            self::Out => 'Salida',
            self::TransferIn => 'Transferencia recibida',
            self::TransferOut => 'Transferencia enviada',
            self::AdjustIn => 'Ajuste (+)',
            self::AdjustOut => 'Ajuste (−)',
        };
    }
}
