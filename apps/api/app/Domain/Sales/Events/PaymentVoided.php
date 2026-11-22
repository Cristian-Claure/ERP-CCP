<?php

namespace App\Domain\Sales\Events;

use App\Domain\Sales\Models\CustomerPayment;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/** A receipt was voided. Dispatched only once the transaction has committed. */
final class PaymentVoided implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public readonly CustomerPayment $payment) {}
}
