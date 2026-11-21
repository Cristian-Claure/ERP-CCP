<?php

namespace App\Domain\Inventory\Data;

use BcMath\Number;

/**
 * Immutable snapshot of a stock balance used by the costing engine.
 * All arithmetic is exact decimal (BcMath\Number); never floats.
 */
final readonly class BalanceState
{
    public function __construct(
        public Number $quantity,
        public Number $avgCost,
        public Number $value,
    ) {}

    public static function zero(): self
    {
        return new self(new Number('0'), new Number('0'), new Number('0'));
    }

    public static function of(string|int $quantity, string|int $avgCost, string|int $value): self
    {
        return new self(new Number((string) $quantity), new Number((string) $avgCost), new Number((string) $value));
    }
}
