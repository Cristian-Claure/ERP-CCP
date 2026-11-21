<?php

namespace App\Domain\Inventory\Exceptions;

use App\Domain\Shared\Exceptions\DomainException;

class InsufficientStockException extends DomainException
{
    /**
     * @param  list<array{product_id: int, sku: string, product: string, warehouse_id: int, warehouse: string, available: string, requested: string}>  $lines
     */
    public function __construct(public readonly array $lines)
    {
        $first = $lines[0];
        $message = sprintf(
            'Stock insuficiente de "%s" en %s: disponible %s, solicitado %s.',
            $first['product'],
            $first['warehouse'],
            self::trim($first['available']),
            self::trim($first['requested']),
        );

        if (count($lines) > 1) {
            $message .= sprintf(' (y %d línea(s) más)', count($lines) - 1);
        }

        parent::__construct($message);
    }

    public function errorCode(): string
    {
        return 'insufficient_stock';
    }

    public function details(): array
    {
        return ['lines' => $this->lines];
    }

    private static function trim(string $quantity): string
    {
        return str_contains($quantity, '.') ? rtrim(rtrim($quantity, '0'), '.') : $quantity;
    }
}
