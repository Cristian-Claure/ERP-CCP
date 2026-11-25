<?php

namespace App\Domain\Purchases\Exceptions;

use App\Domain\Shared\Exceptions\DomainException;

/**
 * The ENT- of a receipt could not be reversed (the stock was already consumed:
 * insufficient_stock, or reversing it would leave a negative valuation:
 * void_cost_inconsistency). Keeps the original code and explains it.
 */
class ReceiptInventoryException extends DomainException
{
    public function __construct(public readonly DomainException $inner, string $receiptNumber, string $entryNumber)
    {
        parent::__construct(sprintf(
            'No se puede anular %s porque su entrada de inventario %s no puede revertirse (la mercadería ya se consumió o vendió): %s',
            $receiptNumber,
            $entryNumber,
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
