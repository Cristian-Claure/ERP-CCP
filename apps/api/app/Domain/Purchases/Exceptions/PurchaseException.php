<?php

namespace App\Domain\Purchases\Exceptions;

use App\Domain\Shared\Exceptions\DomainException;

/**
 * A supplier, purchase order, receipt or supplier payment cannot be saved,
 * approved, posted or voided as it is (422). Errors use the validation shape.
 */
class PurchaseException extends DomainException
{
    /**
     * @param  array<string, list<string>>  $errors
     */
    public function __construct(public readonly array $errors, private readonly string $errorCodeValue = 'invalid_purchase')
    {
        parent::__construct(array_values($errors)[0][0] ?? 'La operación de compras no es válida.');
    }

    /**
     * @param  array<string, list<string>|string>  $errors
     */
    public static function with(array $errors, string $code = 'invalid_purchase'): self
    {
        return new self(array_map(fn ($m) => (array) $m, $errors), $code);
    }

    public static function state(string $message): self
    {
        return new self(['status' => [$message]], 'invalid_document_state');
    }

    /** Segregation of duties: an OC above the threshold cannot be approved by its creator. */
    public static function selfApproval(string $threshold): self
    {
        return self::with(['approval' => sprintf(
            'Las órdenes por encima de Bs %s deben ser aprobadas por otra persona distinta de quien las creó.',
            $threshold,
        )], 'self_approval_not_allowed');
    }

    public static function duplicateInvoice(string $invoice, string $receiptNumber): self
    {
        return self::with(['supplier_invoice_number' => sprintf(
            'La factura %s de este proveedor ya está registrada en %s.',
            $invoice,
            $receiptNumber,
        )], 'duplicate_supplier_invoice');
    }

    /**
     * @param  array<string, list<string>>  $errors
     */
    public static function overReceipt(array $errors): self
    {
        return new self($errors, 'over_receipt');
    }

    /**
     * @param  list<string>  $paymentNumbers
     */
    public static function receiptHasPayments(string $receipt, array $paymentNumbers): self
    {
        return self::with(['payments' => sprintf(
            'No se puede anular %s: tiene pagos aplicados (%s). Anula primero esos pagos.',
            $receipt,
            implode(', ', $paymentNumbers),
        )], 'receipt_has_payments');
    }

    public function errorCode(): string
    {
        return $this->errorCodeValue;
    }

    public function details(): array
    {
        return $this->errors;
    }
}
