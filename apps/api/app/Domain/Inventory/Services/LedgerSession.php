<?php

namespace App\Domain\Inventory\Services;

use App\Domain\Inventory\Data\BalanceState;
use App\Domain\Inventory\Data\MovementResult;
use App\Domain\Inventory\Enums\MovementKind;
use App\Domain\Inventory\Exceptions\InsufficientStockException;
use App\Domain\Inventory\Exceptions\VoidCostInconsistencyException;
use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\Product;
use App\Domain\Inventory\Models\StockBalance;
use App\Domain\Inventory\Models\StockMovement;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;
use LogicException;

/**
 * One posting/voiding unit of work over locked balances. Operations update
 * in-memory balances; nothing is written until commit(), which first fails
 * with ALL insufficient-stock lines (if any) and then persists movements and
 * balances.
 */
final class LedgerSession
{
    /** @var array<string, BalanceState> */
    private array $states = [];

    /** @var list<array<string, mixed>> */
    private array $pending = [];

    /** @var list<array<string, mixed>> */
    private array $shortages = [];

    private bool $committed = false;

    /**
     * @param  array<string, StockBalance>  $balances  keyed "product:warehouse"
     * @param  array<int, Product>  $products
     * @param  array<int, Warehouse>  $warehouses
     */
    public function __construct(
        private readonly AverageCostCalculator $calculator,
        private readonly Company $company,
        private readonly InventoryDocument $document,
        private readonly int $userId,
        private readonly array $balances,
        private readonly array $products,
        private readonly array $warehouses,
    ) {
        foreach ($balances as $key => $balance) {
            $this->states[$key] = BalanceState::of($balance->quantity, $balance->avg_cost, $balance->total_value);
        }
    }

    public function balance(int $productId, int $warehouseId): BalanceState
    {
        return $this->states[$this->key($productId, $warehouseId)]
            ?? throw new LogicException("Balance {$productId}:{$warehouseId} was not locked.");
    }

    public function receive(int $lineId, int $productId, int $warehouseId, MovementKind $kind, Number $quantity, Number $unitCost): MovementResult
    {
        $result = $this->calculator->receive($this->balance($productId, $warehouseId), $quantity, $unitCost);

        return $this->record($lineId, $productId, $warehouseId, $kind, $result);
    }

    public function issue(int $lineId, int $productId, int $warehouseId, MovementKind $kind, Number $quantity): MovementResult
    {
        $before = $this->balance($productId, $warehouseId);
        $this->checkAvailability($productId, $warehouseId, $before, $quantity);

        $result = $this->calculator->issue($before, $quantity);

        return $this->record($lineId, $productId, $warehouseId, $kind, $result);
    }

    /**
     * Reverse an original movement at its original unit cost.
     */
    public function reverse(StockMovement $movement): MovementResult
    {
        $productId = $movement->product_id;
        $warehouseId = $movement->warehouse_id;
        $quantity = Decimal::abs(new Number($movement->quantity));
        $unitCost = new Number($movement->unit_cost);
        $before = $this->balance($productId, $warehouseId);

        if (new Number($movement->quantity) > 0) {
            $this->checkAvailability($productId, $warehouseId, $before, $quantity);

            try {
                $result = $this->calculator->reverseReceipt($before, $quantity, $unitCost);
            } catch (VoidCostInconsistencyException $e) {
                throw $e->withContext($this->context($productId, $warehouseId));
            }
        } else {
            $result = $this->calculator->receive($before, $quantity, $unitCost);
        }

        return $this->record($movement->document_line_id, $productId, $warehouseId, $movement->kind, $result, $movement->id);
    }

    /**
     * Persists every pending movement and the resulting balances.
     *
     * @return list<StockMovement>
     *
     * @throws InsufficientStockException
     */
    public function commit(): array
    {
        if ($this->committed) {
            throw new LogicException('LedgerSession already committed.');
        }

        if ($this->shortages !== []) {
            throw new InsufficientStockException($this->shortages);
        }

        $this->committed = true;
        $now = now();
        $movements = [];
        $lastMovement = [];

        foreach ($this->pending as $row) {
            $movement = StockMovement::query()->create([
                ...$row,
                'company_id' => $this->company->id,
                'document_id' => $this->document->id,
                'document_date' => $this->document->document_date,
                'occurred_at' => $now,
                'created_by' => $this->userId,
            ]);
            $movements[] = $movement;
            $lastMovement[$this->key($row['product_id'], $row['warehouse_id'])] = $movement->id;
        }

        foreach ($lastMovement as $key => $movementId) {
            $state = $this->states[$key];
            $this->balances[$key]->forceFill([
                'quantity' => (string) $state->quantity,
                'avg_cost' => (string) $state->avgCost,
                'total_value' => (string) $state->value,
                'last_movement_id' => $movementId,
            ])->save();
        }

        return $movements;
    }

    private function record(int $lineId, int $productId, int $warehouseId, MovementKind $kind, MovementResult $result, ?int $reverses = null): MovementResult
    {
        $this->states[$this->key($productId, $warehouseId)] = $result->after;

        $this->pending[] = [
            'product_id' => $productId,
            'warehouse_id' => $warehouseId,
            'document_line_id' => $lineId,
            'kind' => $kind,
            'quantity' => (string) $result->quantity,
            'unit_cost' => (string) $result->unitCost,
            'total_cost' => (string) $result->totalCost,
            'quantity_after' => (string) $result->after->quantity,
            'avg_cost_after' => (string) $result->after->avgCost,
            'value_after' => (string) $result->after->value,
            'reverses_movement_id' => $reverses,
        ];

        return $result;
    }

    private function checkAvailability(int $productId, int $warehouseId, BalanceState $before, Number $requested): void
    {
        if ($this->company->allow_negative_stock || $before->quantity >= $requested) {
            return;
        }

        $this->shortages[] = [
            ...$this->context($productId, $warehouseId),
            'available' => (string) $before->quantity->round(4),
            'requested' => (string) $requested->round(4),
        ];
    }

    /**
     * @return array{product_id: int, sku: string, product: string, warehouse_id: int, warehouse: string}
     */
    private function context(int $productId, int $warehouseId): array
    {
        return [
            'product_id' => $productId,
            'sku' => ($this->products[$productId] ?? null)?->sku ?? '',
            'product' => ($this->products[$productId] ?? null)?->name ?? "#{$productId}",
            'warehouse_id' => $warehouseId,
            'warehouse' => ($this->warehouses[$warehouseId] ?? null)?->name ?? "#{$warehouseId}",
        ];
    }

    private function key(int $productId, int $warehouseId): string
    {
        return $productId.':'.$warehouseId;
    }
}
