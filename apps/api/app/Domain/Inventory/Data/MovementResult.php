<?php

namespace App\Domain\Inventory\Data;

use BcMath\Number;

/**
 * Outcome of applying one movement to a balance: the cost it carried and the
 * resulting balance.
 */
final readonly class MovementResult
{
    public function __construct(
        public Number $quantity,   // signed
        public Number $unitCost,
        public Number $totalCost,  // signed
        public BalanceState $after,
    ) {}
}
