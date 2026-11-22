<?php

namespace App\Domain\Sales\Events;

use App\Domain\Sales\Models\Customer;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/** A customer was created or updated. Dispatched only once the transaction has committed. */
final class CustomerSaved implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public readonly Customer $customer) {}
}
