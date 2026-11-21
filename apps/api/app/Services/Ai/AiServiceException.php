<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use RuntimeException;

class AiServiceException extends RuntimeException
{
    public static function unreachable(ConnectionException $previous): self
    {
        return new self('AI service is unreachable.', 0, $previous);
    }

    public static function fromResponse(RequestException $previous): self
    {
        return new self(
            sprintf('AI service responded with HTTP %d.', $previous->response->status()),
            $previous->response->status(),
            $previous,
        );
    }
}
