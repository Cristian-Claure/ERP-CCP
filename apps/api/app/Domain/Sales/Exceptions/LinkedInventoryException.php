<?php

namespace App\Domain\Sales\Exceptions;

use App\Domain\Shared\Exceptions\DomainException;

/**
 * The stock exit linked to a sale could not be voided (e.g.
 * void_cost_inconsistency, insufficient_stock). Keeps the original error
 * code and details, and explains it in terms of the sale.
 */
class LinkedInventoryException extends DomainException
{
    public function __construct(
        public readonly DomainException $inner,
        string $saleNumber,
        string $inventoryNumber,
    ) {
        parent::__construct(sprintf(
            'No se puede anular %s porque su salida de inventario %s no puede revertirse: %s',
            $saleNumber,
            $inventoryNumber,
            $inner->getMessage(),
        ), previous: $inner);
    }

    public function status(): int
    {
        return $this->inner->status();
    }

    public function errorCode(): string
    {
        return $this->inner->errorCode();
    }

    public function details(): ?array
    {
        return [...($this->inner->details() ?? []), 'linked_inventory' => true];
    }
}
