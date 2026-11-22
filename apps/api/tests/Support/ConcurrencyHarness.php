<?php

namespace Tests\Support;

use Illuminate\Support\Facades\DB;
use RuntimeException;
use Symfony\Component\Process\Process;

/**
 * Runs REAL concurrent workers (separate PHP processes and DB connections)
 * released at the same instant through a PostgreSQL advisory-lock barrier.
 * Workers live in tests/Concurrency/workers and print a JSON result.
 */
final class ConcurrencyHarness
{
    public const BARRIER = 4242;

    /**
     * @param  list<string>  $args
     */
    public static function start(string $worker, array $args): Process
    {
        $db = config('database.connections.pgsql');
        $process = new Process(
            [PHP_BINARY, base_path("tests/Concurrency/workers/{$worker}.php"), ...$args],
            base_path(),
            [
                'APP_ENV' => 'testing',
                'APP_KEY' => (string) config('app.key'),
                'DB_CONNECTION' => 'pgsql',
                'DB_HOST' => $db['host'],
                'DB_PORT' => (string) $db['port'],
                'DB_DATABASE' => $db['database'],
                'DB_USERNAME' => $db['username'],
                'DB_PASSWORD' => $db['password'],
                'CACHE_STORE' => 'array',
                'SESSION_DRIVER' => 'array',
                'QUEUE_CONNECTION' => 'sync',
            ],
            timeout: 120,
        );
        $process->start();

        return $process;
    }

    /**
     * Closes the barrier, starts the workers, waits until all are blocked
     * on it, releases them at once and returns their decoded JSON output.
     *
     * @param  list<callable(): Process>  $starters
     * @return list<array<string, mixed>>
     */
    public static function race(array $starters): array
    {
        DB::select('SELECT pg_advisory_lock(?)', [self::BARRIER]);

        try {
            $workers = array_map(fn (callable $start) => $start(), $starters);
            self::waitForBlocked(count($workers));
        } finally {
            DB::select('SELECT pg_advisory_unlock(?)', [self::BARRIER]);
        }

        return array_map(function (Process $p) {
            $p->wait();
            if ($p->getErrorOutput() !== '') {
                throw new RuntimeException('Worker stderr: '.$p->getErrorOutput());
            }

            return json_decode($p->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        }, $workers);
    }

    public static function waitForBlocked(int $expected): void
    {
        $deadline = microtime(true) + 60;
        while (microtime(true) < $deadline) {
            $waiting = DB::selectOne(
                "SELECT COUNT(*) AS n FROM pg_locks WHERE locktype = 'advisory' AND objid = ? AND NOT granted",
                [self::BARRIER],
            )->n;
            if ((int) $waiting >= $expected) {
                return;
            }
            usleep(50_000);
        }

        throw new RuntimeException('Workers did not reach the barrier in time.');
    }
}
