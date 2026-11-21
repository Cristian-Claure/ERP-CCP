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
        'sales.view', 'sales.manage',
        'purchases.view', 'purchases.manage',
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
            'sales.view', 'sales.manage',
            'purchases.view', 'purchases.manage',
            'finance.view', 'finance.manage',
            'ai.use', 'forecasts.view',
        ],
        'vendedor' => ['dashboard.view', 'inventory.view', 'sales.view', 'sales.manage', 'ai.use'],
        // Registers and posts stock documents, but cannot void them nor edit the catalog.
        'almacenero' => ['dashboard.view', 'inventory.view', 'movements.create', 'movements.post', 'purchases.view'],
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
