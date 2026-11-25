<?php

namespace App\Domain\Purchases\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Something the Atlas supplier layer shows changed (supplier saved, receipt
 * posted or voided). Dispatched after commit; invalidates the Atlas cache.
 */
final class PurchasingChanged implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public readonly int $companyId) {}
}
