<?php

namespace App\Console\Commands;

use App\Domain\Sales\Services\CustomerVerifier;
use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Tenancy\RunsInCompanyContext;
use Illuminate\Console\Attributes\AsCommand;
use Illuminate\Console\Command;

#[AsCommand(name: 'customers:verify')]
class VerifyCustomers extends Command
{
    use RunsInCompanyContext;

    protected $signature = 'customers:verify
        {--company= : Company id (default: every company)}
        {--repair : Rebuild customer balances and paid amounts from the ledger}';

    protected $description = 'Verify that customer balances match the receivables ledger (and repair them)';

    public function handle(CustomerVerifier $verifier): int
    {
        $unresolved = 0;
        $companies = $this->option('company')
            ? [Company::query()->findOrFail((int) $this->option('company'))]
            : null;

        $this->forEachCompany(function (Company $company) use ($verifier, &$unresolved) {
            $issues = $verifier->verify($company->id);

            if ($issues === []) {
                $this->components->info("{$company->name}: ledger de clientes y saldos consistentes.");

                return;
            }

            $this->components->warn(sprintf('%s: %d inconsistencia(s).', $company->name, count($issues)));
            $this->table(['Tipo', 'Referencia', 'Detalle'], array_map(fn (array $i) => array_values($i), $issues));

            if (! $this->option('repair')) {
                $unresolved += count($issues);

                return;
            }

            $verifier->repair($company->id);
            $remaining = $verifier->verify($company->id);
            $unresolved += count($remaining);

            $this->components->info('Saldos y montos pagados reconstruidos desde el ledger.');
            if ($remaining !== []) {
                $this->components->error(sprintf(
                    '%d inconsistencia(s) no reparables automáticamente (el ledger es inmutable): revisar manualmente.',
                    count($remaining),
                ));
            }
        }, $companies);

        return $unresolved === 0 ? self::SUCCESS : self::FAILURE;
    }
}
