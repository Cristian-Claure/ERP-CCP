<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

it('reports ok when database, redis and the AI service are healthy', function () {
    Http::fake(['ai.test/v1/ping' => Http::response(['status' => 'ok'])]);

    $this->getJson('/api/v1/health')
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('checks.database.status', 'ok')
        ->assertJsonPath('checks.redis.status', 'ok')
        ->assertJsonPath('checks.ai.status', 'ok')
        ->assertJsonStructure(['status', 'timestamp', 'checks' => ['database' => ['status', 'latency_ms']]]);

    Http::assertSent(fn (Request $request) => $request->hasHeader('X-Service-Token', 'test-service-token'));
});

it('reports degraded with 503 when the AI service rejects the token', function () {
    Http::fake(['ai.test/*' => Http::response(['detail' => 'Invalid service token'], 401)]);

    $this->getJson('/api/v1/health')
        ->assertStatus(503)
        ->assertJsonPath('status', 'degraded')
        ->assertJsonPath('checks.ai.status', 'fail')
        ->assertJsonPath('checks.database.status', 'ok');
});

it('reports degraded when the AI service is unreachable', function () {
    Http::fake(fn () => throw new ConnectionException('Connection refused'));

    $this->getJson('/api/v1/health')
        ->assertStatus(503)
        ->assertJsonPath('checks.ai.status', 'fail');
});
