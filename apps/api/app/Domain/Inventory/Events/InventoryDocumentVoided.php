<?php

namespace App\Domain\Inventory\Events;

use App\Domain\Inventory\Models\InventoryDocument;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/** Dispatched only once the voiding transaction has committed. */
final class InventoryDocumentVoided implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public readonly InventoryDocument $document) {}
}
