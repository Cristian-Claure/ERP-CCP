<?php

use App\Domain\Inventory\Models\InventoryDocument;
use App\Domain\Inventory\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\Support\InventoryScenario;

/**
 * Two REAL concurrent postings (separate PHP processes and DB connections)
 * over the same balance. Data is committed (DatabaseTruncation), not wrapped
 * in a test transaction, so both workers can see it.
 */
function startWorker(InventoryDocument $document, InventoryScenario $s): Process
{
    $db = config('database.connections.pgsql');
    $process = new Process(
        [PHP_BINARY, base_path('tests/Concurrency/workers/post-document.php'), (string) $document->id, (string) $s->user->id, (string) $s->company->id],
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

function waitForBlockedWorkers(int $expected): void
{
    $deadline = microtime(true) + 60;
    while (microtime(true) < $deadline) {
        $waiting = DB::selectOne("SELECT COUNT(*) AS n FROM pg_locks WHERE locktype = 'advisory' AND objid = 4242 AND NOT granted")->n;
        if ((int) $waiting >= $expected) {
            return;
        }
        usleep(50_000);
    }
    throw new RuntimeException('Workers did not reach the barrier in time.');
}

it('never lets two simultaneous exits drive the same balance negative', function () {
    $s = InventoryScenario::make();
    $s->entry('10', '5');

    // Each exit alone is valid (6 <= 10); together they are not (12 > 10).
    $exitA = $s->draft('exit', [['product_id' => $s->product->id, 'quantity' => '6']]);
    $exitB = $s->draft('exit', [['product_id' => $s->product->id, 'quantity' => '6']]);

    DB::select('SELECT pg_advisory_lock(4242)'); // close the barrier
    $workers = [startWorker($exitA, $s), startWorker($exitB, $s)];
    waitForBlockedWorkers(2);
    DB::select('SELECT pg_advisory_unlock(4242)'); // release both at once

    $results = array_map(function (Process $p) {
        $p->wait();
        expect($p->getErrorOutput())->toBe('');

        return json_decode($p->getOutput(), true, flags: JSON_THROW_ON_ERROR);
    }, $workers);

    $ok = array_values(array_filter($results, fn ($r) => $r['ok']));
    $failed = array_values(array_filter($results, fn ($r) => ! $r['ok']));

    expect($ok)->toHaveCount(1)
        ->and($ok[0]['number'])->toBe('SAL-000001')
        ->and($failed)->toHaveCount(1)
        ->and($failed[0]['code'])->toBe('insufficient_stock')
        ->and($failed[0]['details']['lines'][0]['available'])->toBe('4.0000')
        ->and($failed[0]['details']['lines'][0]['requested'])->toBe('6.0000');

    expect($s->state())->toBe(['4.0000', '5.0000', '20.0000'])
        ->and(StockMovement::query()->withoutGlobalScopes()->count())->toBe(2);

    $this->artisan('inventory:verify')->assertSuccessful();
});

it('serializes a double post of the SAME document into a single posting', function () {
    $s = InventoryScenario::make();
    $draft = $s->draft('entry', [['product_id' => $s->product->id, 'quantity' => '3', 'unit_cost' => '2']]);

    DB::select('SELECT pg_advisory_lock(4242)');
    $workers = [startWorker($draft, $s), startWorker($draft, $s)];
    waitForBlockedWorkers(2);
    DB::select('SELECT pg_advisory_unlock(4242)');

    $numbers = array_map(function (Process $p) {
        $p->wait();

        return json_decode($p->getOutput(), true, flags: JSON_THROW_ON_ERROR)['number'] ?? null;
    }, $workers);

    expect($numbers)->toBe(['ENT-000001', 'ENT-000001'])
        ->and(StockMovement::query()->withoutGlobalScopes()->count())->toBe(1)
        ->and($s->state())->toBe(['3.0000', '2.0000', '6.0000']);
});
