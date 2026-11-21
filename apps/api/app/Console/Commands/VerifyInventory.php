<?php

namespace App\Console\Commands;

use App\Domain\Inventory\Services\InventoryVerifier;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Tenancy\RunsInCompanyContext;
use Illuminate\Console\Attributes\AsCommand;
use Illuminate\Console\Command;

#[AsCommand(name: 'inventory:verify')]
class VerifyInventory extends Command
{
    use RunsInCompanyContext;

    protected $signature = 'inventory:verify
        {--company= : Company id (default: every company)}
        {--repair : Rebuild inconsistent balances from the ledger}';

    protected $description = 'Verify that stock balances match the movement ledger (and repair them)';

    public function handle(InventoryVerifier $verifier): int
    {
        $unresolved = 0;
        $companies = $this->option('company')
            ? [Company::query()->findOrFail((int) $this->option('company'))]
            : null;

        $this->forEachCompany(function (Company $company) use ($verifier, &$unresolved) {
            $issues = $verifier->verify($company->id);

            if ($issues === []) {
                $this->components->info("{$company->name}: ledger y saldos consistentes.");

                return;
            }

            $this->components->warn(sprintf('%s: %d inconsistencia(s).', $company->name, count($issues)));
            $this->table(['Tipo', 'Producto', 'Almacén', 'Detalle'], array_map(
                fn (array $i) => [$i['type'], $i['product_id'], $i['warehouse_id'], $i['detail']],
                $issues,
            ));

            if (! $this->option('repair')) {
                $unresolved += count($issues);

                return;
            }

            $repairable = collect($issues)->whereIn('type', InventoryVerifier::REPAIRABLE)
                ->unique(fn (array $i) => $i['product_id'].':'.$i['warehouse_id']);

            foreach ($repairable as $issue) {
                $verifier->repair($company->id, $issue['product_id'], $issue['warehouse_id']);
            }

            $remaining = $verifier->verify($company->id);
            $unresolved += count($remaining);

            $this->components->info(sprintf('Reparados %d saldo(s).', $repairable->count()));
            if ($remaining !== []) {
                $this->components->error(sprintf(
                    '%d inconsistencia(s) no reparables automáticamente (los movimientos son inmutables): revisar manualmente.',
                    count($remaining),
                ));
            }
        }, $companies);

        return $unresolved === 0 ? self::SUCCESS : self::FAILURE;
    }
}
