<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * Internal HTTP client for the FastAPI service (apps/ai).
 *
 * Every call carries the shared X-Service-Token. The AI service is never
 * exposed to the browser: Laravel is the only gateway.
 */
class AiClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $token,
        private readonly int $timeout = 5,
    ) {}

    /**
     * Checks reachability AND that the shared token is accepted
     * (calls an authenticated endpoint, not the public /health).
     */
    public function ping(): bool
    {
        try {
            return $this->request()->get('/v1/ping')->successful();
        } catch (ConnectionException) {
            return false;
        }
    }

    /**
     * @param  array{horizon: int, series: list<array{product_id: string|int, history: list<array{period: string, quantity: float|int}>}>}  $payload
     * @return array<string, mixed>
     *
     * @throws AiServiceException
     */
    public function forecastDemand(array $payload): array
    {
        return $this->post('/v1/forecast/demand', $payload);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     *
     * @throws AiServiceException
     */
    private function post(string $path, array $payload): array
    {
        try {
            return $this->request()->post($path, $payload)->throw()->json();
        } catch (ConnectionException $e) {
            throw AiServiceException::unreachable($e);
        } catch (RequestException $e) {
            throw AiServiceException::fromResponse($e);
        }
    }

    private function request(): PendingRequest
    {
        return Http::baseUrl($this->baseUrl)
            ->acceptJson()
            ->asJson()
            ->timeout($this->timeout)
            ->connectTimeout(min(2, $this->timeout))
            ->withHeaders(['X-Service-Token' => $this->token]);
    }
}
