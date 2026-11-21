<?php

namespace App\Domain\Sales\Exceptions;

use App\Domain\Shared\Exceptions\DomainException;
use App\Domain\Shared\Support\Decimal;
use BcMath\Number;

/**
 * Posting the credit sale would take the customer's balance above its
 * credit limit. Passes only with sales.override_credit_limit + a reason.
 */
class CreditLimitExceededException extends DomainException
{
    public function __construct(
        public readonly int $customerId,
        public readonly string $customerName,
        public readonly Number $balance,
        public readonly Number $limit,
        public readonly Number $total,
    ) {
        parent::__construct(sprintf(
            'La venta supera el límite de crédito de %s: saldo %s + venta %s > límite %s.',
            $customerName,
            Decimal::money($balance),
            Decimal::money($total),
            Decimal::money($limit),
        ));
    }

    public function errorCode(): string
    {
        return 'credit_limit_exceeded';
    }

    public function details(): array
    {
        $available = $this->limit - $this->balance;

        return [
            'customer_id' => $this->customerId,
            'customer' => $this->customerName,
            'balance' => Decimal::money($this->balance),
            'credit_limit' => Decimal::money($this->limit),
            'total' => Decimal::money($this->total),
            'available' => Decimal::money($available < 0 ? new Number('0') : $available),
            'requires_permission' => 'sales.override_credit_limit',
        ];
    }
}
