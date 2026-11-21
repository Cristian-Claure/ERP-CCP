<?php

namespace Database\Seeders;

use App\Domain\Shared\Models\Company;
use App\Domain\Shared\Models\User;
use App\Domain\Shared\Tenancy\RunsInCompanyContext;
use Illuminate\Database\Seeder;

class DemoCompanySeeder extends Seeder
{
    use RunsInCompanyContext;

    public const ADMIN_EMAIL = 'admin@ccp.test';

    public function run(): void
    {
        $company = Company::updateOrCreate(
            ['tax_id' => '1020304050'], // Fictitious NIT.
            [
                'name' => 'Comercial Demo',
                'legal_name' => 'Comercial Demo S.R.L.',
                'currency' => 'BOB',
                'timezone' => 'America/La_Paz',
                'email' => 'contacto@comercialdemo.test',
                'phone' => '+591 3 3000000',
                'address' => 'Av. San Martín 1500, Equipetrol, Santa Cruz de la Sierra',
                'is_active' => true,
            ],
        );

        $users = [
            ['email' => self::ADMIN_EMAIL, 'name' => 'Administrador CCP', 'role' => 'admin'],
            ['email' => 'gerente@ccp.test', 'name' => 'Gabriela Gerente', 'role' => 'gerente'],
            ['email' => 'vendedor@ccp.test', 'name' => 'Víctor Vendedor', 'role' => 'vendedor'],
            ['email' => 'almacenero@ccp.test', 'name' => 'Andrés Almacenero', 'role' => 'almacenero'],
        ];

        foreach ($users as $data) {
            $user = User::updateOrCreate(
                ['email' => $data['email']],
                [
                    'company_id' => $company->id,
                    'name' => $data['name'],
                    'password' => 'password', // Hashed by the model cast.
                    'is_active' => true,
                    'email_verified_at' => now(),
                ],
            );

            $user->joinCompany($company->id);

            // Role assignment is scoped to the company (spatie team).
            $this->inCompany($company, fn () => $user->unsetRelation('roles')->syncRoles([$data['role']]));
        }
    }
}
