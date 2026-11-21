<?php

namespace App\Infrastructure\Health;

use App\Infrastructure\Ai\AiClient;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

class HealthService
{
    public function __construct(private readonly AiClient $ai) {}

    /**
     * @return array{status: 'ok'|'degraded', checks: array<string, array{status: 'ok'|'fail', latency_ms: float}>}
     */
    public function check(): array
    {
        $checks = [
            'database' => $this->measure(fn () => DB::select('select 1') !== []),
            'redis' => $this->measure(fn () => (bool) Redis::connection()->ping()),
            'ai' => $this->measure(fn () => $this->ai->ping()),
        ];

        $healthy = collect($checks)->every(fn (array $check) => $check['status'] === 'ok');

        return [
            'status' => $healthy ? 'ok' : 'degraded',
            'checks' => $checks,
        ];
    }

    /**
     * @param  Closure(): bool  $probe
     * @return array{status: 'ok'|'fail', latency_ms: float}
     */
    private function measure(Closure $probe): array
    {
        $start = hrtime(true);

        try {
            $ok = $probe();
        } catch (Throwable $e) {
            report($e);
            $ok = false;
        }

        return [
            'status' => $ok ? 'ok' : 'fail',
            'latency_ms' => round((hrtime(true) - $start) / 1_000_000, 2),
        ];
    }
}
