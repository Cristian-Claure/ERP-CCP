<?php

namespace App\Domain\Sales\Data;

use App\Domain\Sales\Enums\PaymentMethod;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;

/**
 * One payment method applied to a cash sale (mixed payments: e.g. part cash,
 * part QR). Amounts are the APPLIED amounts and must add up to the total;
 * cash tendered and change are tracked separately by the POS.
 */
final readonly class TenderData
{
    public function __construct(
        public PaymentMethod $method,
        public string $amount,
    ) {}

    public function amount(): Number
    {
        return Decimal::of($this->amount);
    }
}
