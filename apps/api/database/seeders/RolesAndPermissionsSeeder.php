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
        'inventory.view', 'inventory.manage',
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
            'inventory.view', 'inventory.manage',
            'sales.view', 'sales.manage',
            'purchases.view', 'purchases.manage',
            'finance.view', 'finance.manage',
            'ai.use', 'forecasts.view',
        ],
        'vendedor' => ['dashboard.view', 'inventory.view', 'sales.view', 'sales.manage', 'ai.use'],
        'almacenero' => ['dashboard.view', 'inventory.view', 'inventory.manage', 'purchases.view'],
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

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
