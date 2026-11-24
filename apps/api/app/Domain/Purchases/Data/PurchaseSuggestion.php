<?php

namespace App\Domain\Purchases\Data;

/** One suggested purchase line (product × warehouse) and the figures that justify it. */
final readonly class PurchaseSuggestion
{
    public function __construct(
        public int $productId,
        public string $sku,
        public string $productName,
        public string $unit,
        public int $warehouseId,
        public string $warehouseName,
        public string $stock,
        public string $minStock,
        public string $dailySales,
        public int $leadTimeDays,
        public string $onOrder,
        public string $suggestedQuantity,
        public ?int $supplierId,
        public ?string $supplierName,
        public ?string $lastPrice,
        /** Algorithm that produced it ('min_stock_velocity', later 'ai_forecast'). */
        public string $method,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'product_id' => $this->productId,
            'sku' => $this->sku,
            'product_name' => $this->productName,
            'unit' => $this->unit,
            'warehouse_id' => $this->warehouseId,
            'warehouse_name' => $this->warehouseName,
            'stock' => $this->stock,
            'min_stock' => $this->minStock,
            'daily_sales' => $this->dailySales,
            'lead_time_days' => $this->leadTimeDays,
            'on_order' => $this->onOrder,
            'suggested_quantity' => $this->suggestedQuantity,
            'supplier_id' => $this->supplierId,
            'supplier_name' => $this->supplierName,
            'last_price' => $this->lastPrice,
            'method' => $this->method,
        ];
    }
}
