<?php

namespace App\Domain\Sales\Exceptions;

use App\Domain\Shared\Exceptions\DomainException;

class SaleHasPaymentsException extends DomainException
{
    /**
     * @param  list<string>  $paymentNumbers
     */
    public function __construct(public readonly string $saleNumber, public readonly array $paymentNumbers)
    {
        parent::__construct(sprintf(
            'No se puede anular %s: tiene cobros aplicados (%s). Anula primero esos cobros.',
            $saleNumber,
            implode(', ', $paymentNumbers),
        ));
    }

    public function errorCode(): string
    {
        return 'sale_has_payments';
    }

    public function details(): array
    {
        return ['payments' => $this->paymentNumbers];
    }
}
