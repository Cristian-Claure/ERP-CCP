<?php

namespace App\Domain\Inventory\Services;

use App\Domain\Inventory\Data\BalanceState;
use App\Domain\Inventory\Data\MovementResult;
use App\Domain\Inventory\Exceptions\VoidCostInconsistencyException;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use InvalidArgumentException;

/**
 * Moving weighted average cost per product + warehouse (ADR 0004).
 *
 * Pure: no database access. Quantities/costs are rounded to 4 decimals and
 * values to 4 decimals (internal costing precision).
 *
 * Invariants of every resulting balance: value >= 0 and avgCost >= 0.
 * When quantity <= 0, value is 0 and avgCost keeps the last known average.
 */
final class AverageCostCalculator
{
    private const SCALE = 4;

    private const WORK_SCALE = 10;

    /** Maximum residual value tolerated when a reversal empties the stock. */
    private const RESIDUAL_TOLERANCE = '0.0100';

    /**
     * Incoming stock at a known unit cost (entry, transfer in, positive
     * adjustment, reversal of an outgoing movement).
     */
    public function receive(BalanceState $balance, Number $quantity, Number $unitCost): MovementResult
    {
        $this->assertPositive($quantity);
        $unitCost = $this->round($unitCost);
        $total = $this->round($quantity * $unitCost);
        $newQty = $balance->quantity + $quantity;

        if ($newQty <= 0) {
            // Still negative (negative stock allowed): nothing valued on hand.
            return new MovementResult($quantity, $unitCost, $total, new BalanceState($newQty, $unitCost, $this->zero()));
        }

        if ($balance->quantity <= 0) {
            // Coming from zero/negative: the covered deficit is consumed at this cost.
            $value = $this->round($newQty * $unitCost);

            return new MovementResult($quantity, $unitCost, $total, new BalanceState($newQty, $unitCost, $value));
        }

        $value = $this->round($balance->value + $total);

        return new MovementResult($quantity, $unitCost, $total, new BalanceState($newQty, $this->average($value, $newQty), $value));
    }

    /**
     * Outgoing stock at the current average cost (exit, transfer out,
     * negative adjustment).
     */
    public function issue(BalanceState $balance, Number $quantity): MovementResult
    {
        $this->assertPositive($quantity);
        $unitCost = $this->round($balance->avgCost);
        $newQty = $balance->quantity - $quantity;

        if ($newQty <= 0) {
            // The last units carry whatever value remains (absorbs rounding).
            $total = $balance->value;
            $after = new BalanceState($newQty, $unitCost, $this->zero());
        } else {
            $total = $this->round($quantity * $unitCost);
            $total = $total > $balance->value ? $balance->value : $total;
            $after = new BalanceState($newQty, $unitCost, $this->round($balance->value - $total));
        }

        return new MovementResult(-$quantity, $unitCost, -$total, $after);
    }

    /**
     * Reversal of an incoming movement at its ORIGINAL unit cost (voiding an
     * entry, a received transfer or a positive adjustment).
     *
     * @throws VoidCostInconsistencyException when the result would break the
     *                                        valuation invariant
     */
    public function reverseReceipt(BalanceState $balance, Number $quantity, Number $originalUnitCost): MovementResult
    {
        $this->assertPositive($quantity);
        $unitCost = $this->round($originalUnitCost);
        $total = $this->round($quantity * $unitCost);
        $newQty = $balance->quantity - $quantity;
        $rawValue = $balance->value - $total;

        if ($newQty < 0) {
            // Only reachable when negative stock is allowed.
            return new MovementResult(-$quantity, $unitCost, -$total, new BalanceState($newQty, $balance->avgCost, $this->zero()));
        }

        if ($newQty == 0) {
            if (Decimal::abs($rawValue) > new Number(self::RESIDUAL_TOLERANCE)) {
                throw new VoidCostInconsistencyException($this->round($rawValue), $newQty);
            }

            return new MovementResult(-$quantity, $unitCost, -$balance->value, new BalanceState($newQty, $balance->avgCost, $this->zero()));
        }

        if ($rawValue < 0) {
            throw new VoidCostInconsistencyException($this->round($rawValue), $newQty);
        }

        $value = $this->round($rawValue);

        return new MovementResult(-$quantity, $unitCost, -$total, new BalanceState($newQty, $this->average($value, $newQty), $value));
    }

    private function average(Number $value, Number $quantity): Number
    {
        return $this->round($value->div($quantity, self::WORK_SCALE));
    }

    private function round(Number $n): Number
    {
        return $n->round(self::SCALE);
    }

    private function zero(): Number
    {
        return new Number('0');
    }

    private function assertPositive(Number $quantity): void
    {
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Movement quantity must be positive.');
        }
    }
}
