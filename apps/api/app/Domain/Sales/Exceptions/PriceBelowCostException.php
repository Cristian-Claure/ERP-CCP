<?php

namespace App\Domain\Sales\Exceptions;

use App\Domain\Shared\Exceptions\DomainException;

/**
 * One or more lines sell below the average cost or below the product's
 * minimum price. Passes only with sales.authorize_below_cost + a reason.
 *
 * Details expose the price rule broken, never the cost itself: the seller
 * may not have sales.view_margin.
 */
class PriceBelowCostException extends DomainException
{
    /**
     * @param  list<array{position: int, product_id: int, product: string, rule: 'below_cost'|'below_min_price', unit_price: string, min_price: ?string}>  $lines
     */
    public function __construct(public readonly array $lines)
    {
        $first = $lines[0];
        $message = $first['rule'] === 'below_cost'
            ? sprintf('"%s" se vende por debajo de su costo.', $first['product'])
            : sprintf('"%s" se vende por debajo del precio mínimo (%s).', $first['product'], $first['min_price']);

        if (count($lines) > 1) {
            $message .= sprintf(' (y %d línea(s) más)', count($lines) - 1);
        }

        parent::__construct($message.' Requiere autorización.');
    }

    public function errorCode(): string
    {
        return 'price_below_cost';
    }

    public function details(): array
    {
        return ['lines' => $this->lines, 'requires_permission' => 'sales.authorize_below_cost'];
    }
}
