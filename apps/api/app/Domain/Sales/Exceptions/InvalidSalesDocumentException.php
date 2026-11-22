<?php

namespace App\Domain\Sales\Exceptions;

use App\Domain\Shared\Exceptions\DomainException;

/**
 * A sales document / payment cannot be saved, posted or voided as it is.
 * Errors use the validation shape: field => messages.
 */
class InvalidSalesDocumentException extends DomainException
{
    /**
     * @param  array<string, list<string>>  $errors
     */
    public function __construct(public readonly array $errors, private readonly string $errorCodeValue = 'invalid_sales_document')
    {
        parent::__construct(array_values($errors)[0][0] ?? 'El documento no es válido.');
    }

    /**
     * @param  array<string, list<string>|string>  $errors
     */
    public static function with(array $errors, string $code = 'invalid_sales_document'): self
    {
        return new self(array_map(fn ($m) => (array) $m, $errors), $code);
    }

    public static function state(string $message): self
    {
        return new self(['status' => [$message]], 'invalid_document_state');
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
