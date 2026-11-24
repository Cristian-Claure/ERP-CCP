<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Permission naming: <module>.<ability>. Module names match the sidebar.
     */
    public const PERMISSIONS = [
        'dashboard.view',
        // Inventory: per-action permissions (Phase 1).
        'inventory.view', 'products.manage', 'movements.create', 'movements.post', 'movements.void',
        // Sales (Phase 2): per-action permissions.
        'customers.view', 'customers.manage',
        'sales.view', 'sales.create', 'sales.post', 'sales.void',
        'sales.authorize_below_cost', 'sales.override_credit_limit', 'sales.view_margin',
        'receivables.view', 'receivables.collect', 'receivables.void',
        // Purchases (Phase 3): per-action permissions.
        'suppliers.view', 'suppliers.manage',
        'purchases.view', 'purchases.create', 'purchases.approve', 'purchases.receive', 'purchases.void',
        'payables.view', 'payables.pay',
        'finance.view', 'finance.manage',
        'ai.use', 'forecasts.view',
        'users.manage',
        'settings.manage',
    ];

    public const ROLES = [
        'admin' => ['*'],
        'gerente' => [
            'dashboard.view',
            'inventory.view', 'products.manage', 'movements.create', 'movements.post', 'movements.void',
            'customers.view', 'customers.manage',
            'sales.view', 'sales.create', 'sales.post', 'sales.void',
            'sales.authorize_below_cost', 'sales.override_credit_limit', 'sales.view_margin',
            'receivables.view', 'receivables.collect', 'receivables.void',
            // Approves, voids and pays (receiving too, as backup of the storekeeper).
            'suppliers.view', 'suppliers.manage',
            'purchases.view', 'purchases.create', 'purchases.approve', 'purchases.receive', 'purchases.void',
            'payables.view', 'payables.pay',
            'finance.view', 'finance.manage',
            'ai.use', 'forecasts.view',
        ],
        // Creates and posts sales and registers receipts; never voids nor authorizes exceptions.
        'vendedor' => [
            'dashboard.view', 'inventory.view',
            'customers.view', 'customers.manage',
            'sales.view', 'sales.create', 'sales.post',
            'receivables.view', 'receivables.collect',
            'ai.use',
        ],
        // Registers and posts stock documents and receives purchase orders; cannot void, approve nor pay.
        'almacenero' => [
            'dashboard.view', 'inventory.view', 'movements.create', 'movements.post',
            'suppliers.view', 'purchases.view', 'purchases.receive',
        ],
    ];

    /**
     * Roles are created as GLOBAL templates (company_id = NULL) usable by every
     * company; assignments (model_has_roles) are always per company (team).
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        setPermissionsTeamId(null);

        foreach (self::PERMISSIONS as $name) {
            Permission::findOrCreate($name, 'web');
        }

        foreach (self::ROLES as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName, 'web');
            $role->syncPermissions($permissions === ['*'] ? self::PERMISSIONS : $permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
