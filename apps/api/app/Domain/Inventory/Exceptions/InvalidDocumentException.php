<?php

namespace App\Domain\Inventory\Exceptions;

use App\Domain\Shared\Exceptions\DomainException;

/**
 * The document cannot be posted/voided as it is (state, dates, lines...).
 * Errors use the same shape as validation errors: field => messages.
 */
class InvalidDocumentException extends DomainException
{
    /**
     * @param  array<string, list<string>>  $errors
     */
    public function __construct(public readonly array $errors, string $code = 'invalid_document')
    {
        $this->errorCodeValue = $code;
        parent::__construct(array_values($errors)[0][0] ?? 'El documento no es válido.');
    }

    private string $errorCodeValue;

    /**
     * @param  array<string, list<string>|string>  $errors
     */
    public static function with(array $errors): self
    {
        return new self(array_map(fn ($m) => (array) $m, $errors));
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
