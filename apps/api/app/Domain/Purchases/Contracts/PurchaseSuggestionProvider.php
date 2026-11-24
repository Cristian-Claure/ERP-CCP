<?php

namespace App\Domain\Purchases\Contracts;

use App\Domain\Purchases\Data\PurchaseSuggestion;

/**
 * Source of purchase suggestions per product and warehouse. Phase 3 binds the
 * min-stock + sales-velocity heuristic; Phase 5 can bind an implementation
 * backed by the AI demand forecast (apps/ai) without touching callers.
 */
interface PurchaseSuggestionProvider
{
    /**
     * @return list<PurchaseSuggestion> only rows with a positive suggested quantity
     */
    public function suggest(int $companyId, ?int $warehouseId = null, ?int $supplierId = null): array;
}
