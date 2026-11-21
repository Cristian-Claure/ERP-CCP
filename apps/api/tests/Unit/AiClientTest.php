<?php

use App\Services\Ai\AiClient;
use App\Services\Ai\AiServiceException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

it('sends the service token and returns the forecast payload', function () {
    Http::fake(['ai.test/v1/forecast/demand' => Http::response(['forecasts' => []])]);

    $client = new AiClient('http://ai.test', 'secret-token', 3);
    $result = $client->forecastDemand(['horizon' => 2, 'series' => []]);

    expect($result)->toBe(['forecasts' => []]);
    Http::assertSent(fn (Request $request) => $request->hasHeader('X-Service-Token', 'secret-token')
        && $request->url() === 'http://ai.test/v1/forecast/demand');
});

it('wraps HTTP errors in AiServiceException', function () {
    Http::fake(['ai.test/*' => Http::response(['detail' => 'boom'], 500)]);

    $client = new AiClient('http://ai.test', 'secret-token');

    expect(fn () => $client->forecastDemand(['horizon' => 1, 'series' => []]))
        ->toThrow(AiServiceException::class, 'AI service responded with HTTP 500.');
});
