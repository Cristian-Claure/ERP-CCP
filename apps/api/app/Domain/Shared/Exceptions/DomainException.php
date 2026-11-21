<?php

namespace App\Domain\Shared\Exceptions;

use RuntimeException;

/**
 * Business rule violation. ApiExceptionRenderer turns it into the uniform
 * error envelope using status(), errorCode() and details().
 */
abstract class DomainException extends RuntimeException
{
    public function status(): int
    {
        return 422;
    }

    abstract public function errorCode(): string;

    /**
     * @return array<string, mixed>|null
     */
    public function details(): ?array
    {
        return null;
    }
}
