# ADR 0002 — Roles y permisos por empresa (spatie teams) y membresía multiempresa

- **Estado:** Aceptado
- **Fecha:** 2026-11-21
- **Fase:** 0 (cimientos)
- **Relacionado:** [ADR 0001](0001-arquitectura-monorepo.md)

## Contexto

El roadmap incluye usuarios que trabajan en varias empresas, por ejemplo un contador externo o un
gerente de un grupo con varias razones sociales, con **roles distintos en cada una**. Un mismo
usuario puede ser `admin` en "Comercial Demo" y `vendedor` en otra empresa.

Con roles globales, una asignación (`model_has_roles`) no sabe a qué empresa pertenece. Agregarlo
después obligaría a migrar asignaciones con datos reales: reconstruir claves primarias, inferir la
empresa de cada asignación y auditar escalamientos de privilegios. Ese costo es mínimo hoy (beta
sin datos productivos) y alto mañana.

## Decisión

### 1. spatie/laravel-permission en modo *teams*, con `company_id` como team

- `config/permission.php`: `teams => true` y `team_foreign_key => 'company_id'`.
- `model_has_roles` y `model_has_permissions` llevan `company_id` dentro de la clave primaria: **cada
  asignación pertenece a una empresa**.
- `roles.company_id` es *nullable*:
  - `NULL` = rol **plantilla global** (admin, gerente, vendedor, almacenero), creado por el seeder y
    reutilizable en cualquier empresa;
  - con valor = rol **propio de una empresa** (futuro: roles personalizados por cliente).
- FKs hacia `companies` en las tres tablas (`cascadeOnDelete`).

### 2. Resolución por empresa activa

- `users.company_id` es la **empresa activa** del usuario.
- El middleware `ResolveActiveCompany` (alias `company`), siempre **después** de `auth:sanctum`:
  1. verifica que la empresa activa sea una membresía activa (`company_user.is_active`); si no lo es,
     responde **403**;
  2. llama `setPermissionsTeamId($user->company_id)`;
  3. descarta las relaciones `roles` y `permissions` que se hayan cargado antes de fijar el team.
- `LoginUser` hace lo mismo al autenticar, así la respuesta del login ya trae los roles de la
  empresa activa.
- Jobs, comandos y seeders deben fijar el team explícitamente (`setPermissionsTeamId($companyId)`);
  sin team, solo se ven roles globales y ninguna asignación.

### 3. Membresía N:M (`company_user`) desde ya

- Pivote `company_user (company_id, user_id, is_active, timestamps)` con `unique(company_id, user_id)`.
- `User::companies()`, `Company::members()`, `User::joinCompany()` y `User::belongsToCompany()`.
- **Invariante:** la empresa activa siempre es una membresía. El modelo `User` la agrega solo al crear
  el usuario o al cambiar `company_id`.
- Los usuarios se aíslan por **membresía**, no por empresa activa: `CompanyMemberScope` filtra con
  `EXISTS` sobre `company_user`. Un usuario de dos empresas aparece en ambas. El resto de modelos de
  negocio siguen usando `BelongsToCompany` (columna `company_id` directa).
- **En la beta** cada usuario tiene una sola empresa y no hay selector. El cambio de empresa
  (`POST /api/v1/auth/switch-company`, que actualiza `company_id` y regenera la sesión) queda para
  una fase posterior, sin cambios de esquema.

## Consecuencias

**Positivas**
- No habrá que migrar roles ni asignaciones con datos reales cuando llegue la multiempresa.
- Imposible por diseño que un rol de una empresa otorgue permisos en otra.
- Base lista para roles personalizados por empresa (`roles.company_id` no nulo).

**Negativas / cuidados**
- Todo contexto sin HTTP (colas, consola, tests) debe fijar el team; si se olvida, `can()` devuelve
  `false`, que es el fallo seguro.
- El middleware agrega una consulta por request (verificar la membresía). Si hiciera falta, se puede
  cachear por sesión.
- Spatie cachea el registro de permisos globalmente. Al crear roles por empresa en runtime hay que
  invalidar con `forgetCachedPermissions()`.
- Los tests deben asignar roles con el team fijado (ver `tests/Feature/Tenancy/CompanyTeamsTest.php`).

## Alternativas consideradas

- **Roles globales y empresa implícita por `users.company_id`** (diseño original de la Fase 0):
  más simple, pero obliga a una migración riesgosa al habilitar la multiempresa.
- **Prefijar roles por empresa (`admin@empresa-1`)**: frágil, explota el número de roles y no
  aprovecha el soporte nativo de spatie.
- **Un usuario por empresa (cuentas duplicadas)**: mala UX (varias contraseñas) y auditoría
  fragmentada por persona.
