# ADR 0003 — Organización del backend por dominios

- **Estado:** Aceptado
- **Fecha:** 2026-11-21
- **Fase:** 1 (inventario)

## Contexto

La estructura por defecto de Laravel agrupa por tipo técnico (`app/Models`, `app/Services`,
`app/Policies`…). Con un módulo era manejable; con inventario, ventas, compras y finanzas, cada carpeta
mezclaría decenas de clases de dominios distintos y los límites entre módulos dejarían de verse.

## Decisión

```
app/
  Domain/
    Shared/            Núcleo transversal
      Models/          Company, User, AuditLog
      Tenancy/         CurrentCompany, CompanyContext, RunsInCompanyContext,
                       BelongsToCompany, CompanyScope, CompanyMemberScope
      Actions/Auth/    LoginUser, LogoutUser
      Services/        AuditLogger
      Policies/        UserPolicy
      MorphMap.php     Alias polimórficos (contrato de datos)
    Inventory/         (y luego Sales, Purchasing, Finance…)
      Models/  Actions/  Policies/  Data/  Enums/  Events/  Exceptions/  Services/
  Infrastructure/      Integraciones técnicas, sin reglas de negocio
    Ai/                AiClient, AiServiceException
    Health/            HealthService
  Http/                Solo transporte, agrupado por módulo
    Controllers/Api/V1/<Modulo>/
    Requests/<Modulo>/
    Resources/<Modulo>/
    Middleware/
  Exceptions/          ApiExceptionRenderer (envelope HTTP)
  Providers/
```

### Reglas

1. **Domain** contiene las reglas de negocio: modelos, casos de uso (`Actions`, uno por intención:
   `PostInventoryDocument`), DTOs (`Data`), enums, eventos, excepciones de dominio y policies. No
   conoce `Request` ni respuestas HTTP.
2. **Http** traduce: valida (`Requests`), llama a una Action con un DTO y serializa (`Resources`).
   Los controladores no contienen lógica de negocio.
3. **Infrastructure** envuelve sistemas externos (servicio de IA, health checks) detrás de clases
   inyectables.
4. Un dominio puede usar `Domain/Shared` libremente. Entre dominios de negocio se depende solo de
   Actions, eventos o modelos públicos; nunca de clases internas (`Services/` de otro dominio).
5. Las excepciones de dominio declaran su status y código de error; `ApiExceptionRenderer` las
   convierte en el envelope uniforme.

### Ajustes técnicos que exige salir de `App\Models`

- **Factories:** `#[UseFactory(XFactory::class)]` en el modelo y `protected $model` en la factory.
- **Policies:** `#[UsePolicy(XPolicy::class)]` en el modelo (sin depender del autodescubrimiento).
- **Morph map forzado** (`Relation::enforceMorphMap(MorphMap::MAP)`): las columnas polimórficas
  (`audit_logs.auditable_type`, `model_has_roles.model_type`) guardan alias (`user`,
  `inventory_document`) y no FQCN, así que mover una clase no rompe datos. Un modelo nuevo que pueda
  auditarse **debe** registrarse en `MorphMap`.
- **Contexto de empresa fuera de HTTP:** `CompanyContext::run()` y el trait
  `RunsInCompanyContext` (`inCompany()`, `forEachCompany()`) fijan y restauran el scope de empresa y
  el team de spatie. Llamar `setPermissionsTeamId()` a mano solo está permitido en la capa HTTP
  (middleware y login).

## Consecuencias

- Cada módulo nuevo es una carpeta autocontenida, fácil de revisar y de asignar.
- Los límites entre dominios se ven en los `use` y pueden auditarse.
- Se pierde algo de la "magia" de convenciones de Laravel (descubrimiento de factories y policies),
  compensado con atributos explícitos.
- `php artisan make:model` sigue generando en `app/Models`: hay que mover la clase o crearla a mano.
  CLAUDE.md lo recuerda.

## Alternativas consideradas

- **Estructura por defecto de Laravel:** descartada por escala (ver Contexto).
- **Módulos como paquetes Composer (`modules/Inventory`):** más aislamiento, pero mucha ceremonia
  (providers, autoload y migraciones por módulo) para un equipo pequeño.
- **Hexagonal estricto (puertos y adaptadores por todo):** sobredimensionado. Eloquent se usa
  directamente en el dominio por pragmatismo.
