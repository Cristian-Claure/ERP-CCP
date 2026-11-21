<?php

namespace App\Domain\Sales\Events;

use App\Domain\Sales\Models\CustomerPayment;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/** A receipt was registered. Dispatched only once the transaction has committed. */
final class PaymentRegistered implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public readonly CustomerPayment $payment) {}
}
