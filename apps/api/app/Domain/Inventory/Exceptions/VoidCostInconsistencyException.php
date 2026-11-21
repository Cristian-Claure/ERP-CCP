<?php

namespace App\Domain\Inventory\Exceptions;

use App\Domain\Shared\Exceptions\DomainException;
use BcMath\Number;

/**
 * Reverting an incoming movement at its original cost would leave the
 * balance with a negative value (or value without stock), breaking the
 * valuation invariant. The user should register an adjustment instead.
 */
class VoidCostInconsistencyException extends DomainException
{
    /** @var array<string, mixed> */
    private array $context = [];

    public function __construct(
        public readonly Number $resultingValue,
        public readonly Number $resultingQuantity,
    ) {
        parent::__construct('La anulación dejaría el inventario con una valorización inconsistente.');
    }

    /**
     * @param  array{product_id: int, sku: string, product: string, warehouse_id: int, warehouse: string}  $context
     */
    public function withContext(array $context): static
    {
        $this->context = $context;
        $this->message = sprintf(
            'No se puede anular: "%s" en %s quedaría con cantidad %s y valor %s. '
            .'El stock de esta entrada ya fue consumido a otro costo; registra un ajuste por conteo en su lugar.',
            $context['product'],
            $context['warehouse'],
            $this->resultingQuantity->round(4),
            $this->resultingValue->round(2),
        );

        return $this;
    }

    public function errorCode(): string
    {
        return 'void_cost_inconsistency';
    }

    public function details(): array
    {
        return [
            ...$this->context,
            'resulting_quantity' => (string) $this->resultingQuantity->round(4),
            'resulting_value' => (string) $this->resultingValue->round(4),
            'suggestion' => 'adjustment',
        ];
    }
}
