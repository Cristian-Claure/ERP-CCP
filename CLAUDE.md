# CLAUDE.md — CCP (Control Central de Procesos)

Guía para agentes y desarrolladores que trabajan en este repositorio.

## Visión

CCP es un ERP web profesional para pymes bolivianas (moneda base BOB): inventario, ventas, compras,
finanzas y una capa de inteligencia (pronósticos de demanda, asistente IA). Prioridades: **integridad
contable y de stock**, **multiempresa desde el día 1** y **UX de nivel SaaS**.

## Arquitectura (monorepo)

```
apps/api   Laravel 13 (PHP 8.5) — API REST /api/v1, único gateway hacia el navegador
apps/web   React 19 + TS + Vite — SPA (Tailwind v4, shadcn/ui, TanStack Query, Zustand)
apps/ai    FastAPI (Python 3.12, uv) — servicio interno, solo accesible desde la red Docker
docker/    Dockerfiles y configs (php-fpm, nginx, python, node, postgres)
docs/      architecture.md y ADRs (docs/adr/)
```

- El navegador **solo** habla con Laravel. Laravel llama a la IA con `App\Infrastructure\Ai\AiClient`
  (header `X-Service-Token`). Nunca expongas `apps/ai` al frontend.
- Auth: Sanctum SPA con cookies (sesión + XSRF). Nada de tokens en localStorage.
- Ver `docs/architecture.md` y `docs/adr/0001-arquitectura-monorepo.md`.

## Regla de software libre (obligatoria)

- Solo software libre / open source y recursos gratuitos. **Nada** que requiera pago, tarjeta, API key de
  un servicio comercial ni cuenta en un SaaS. Prohibidos: Mapbox, Google Maps, Cesium ion, geocoding pago,
  APIs de LLM pagas.
- Toda librería nueva debe tener licencia **aprobada por la OSI** (MIT, Apache-2.0, BSD, ISC, MPL…).
  Cualquier excepción se consulta **antes** de instalarla. Ejemplo descartado: `react-leaflet`
  (Hippocratic-2.1) → wrapper propio sobre `leaflet`.
- Datos y texturas solo de dominio público o licencias abiertas (NASA, Natural Earth, OpenStreetMap), con
  atribución en `docs/CREDITS.md`. Dependencias y licencias en `docs/LICENSES.md`
  (`docs/scripts/build_licenses.py`).
- Teselas OSM: atribución visible, sin descargas masivas ni *prefetch* agresivo; URL configurable por
  `.env` (`VITE_MAP_TILE_URL`, `VITE_MAP_TILE_ATTRIBUTION`).
- IA: modelos locales open source (p. ej. vía Ollama) o librerías Python libres; nunca APIs de pago.

## Convenciones

- **Código en inglés** (clases, variables, tablas, columnas, rutas de API, commits).
  **UI en español** (textos, mensajes de error al usuario, rutas del frontend como `/inventario`).
- Commits convencionales (`feat(api): …`, `fix(web): …`, `chore(docker): …`), pequeños y enfocados.
- Ramas: `feat/<fase-o-tema>`; PR hacia `main`. Nunca `push --force` sobre `main`.

### Backend (apps/api)

- **Organización por dominios** (ADR 0003):
  - `app/Domain/<Modulo>/{Models,Actions,Policies,Data,Enums,Events,Exceptions,Services}`: reglas de
    negocio. `app/Domain/Shared` es el núcleo (Company, User, AuditLog, Tenancy, Auth).
  - `app/Http/{Controllers/Api/V1,Requests,Resources}/<Modulo>/`: solo transporte. Controladores
    delgados: validan con un Request, llaman a una Action con un DTO y devuelven un Resource.
  - `app/Infrastructure/`: integraciones técnicas (AiClient, HealthService).
  - `make:model` genera en `app/Models`: mueve la clase a su dominio. En el modelo, usa
    `#[UseFactory]` y `#[UsePolicy]`; en la factory, `protected $model`. Todo modelo que aparezca en
    columnas polimórficas (auditable) va en `App\Domain\Shared\MorphMap`.
- Autorización con `Policies` + permisos spatie (`<modulo>.<accion>`, p. ej. `movements.post`).
- **spatie en modo teams (team = `company_id`)**: roles y permisos se resuelven por la empresa activa
  (`users.company_id`). Las rutas autenticadas usan `['auth:sanctum', 'company']`. Membresías en
  `company_user` (`User::companies()`, `joinCompany()`, `belongsToCompany()`). Ver ADR 0002.
- **Fuera de HTTP (jobs, comandos, seeders, tests) usa siempre `RunsInCompanyContext`**
  (`$this->inCompany($company, fn …)`, `$this->forEachCompany(fn …)`) o `CompanyContext::run()`.
  Fijan y restauran el scope de empresa y el team de spatie. No llames `setPermissionsTeamId()` a mano
  fuera de la capa HTTP.
- Errores: siempre el envelope uniforme de `App\Exceptions\ApiExceptionRenderer`:
  `{"error": {"status", "code", "message", "details?"}}`.
- Toda ruta de negocio va dentro del grupo `auth:sanctum` de `routes/api.php`, versionada en `v1`.
- Tests con Pest (`tests/Feature`, PostgreSQL real en la BD `ccp_test`).
- Estilo: Laravel Pint.

### Frontend (apps/web)

- Por features: `src/features/<modulo>/{api,hooks,services,components,pages,types}`.
  Compartido: `src/components/ui` (shadcn), `src/components/layout`, `src/lib`, `src/stores`, `src/routes`.
- Datos remotos con TanStack Query; estado de UI con Zustand. Los componentes consumen **hooks**, nunca
  axios directo; los hooks consumen una **capa de servicios** (mock o API, intercambiable).
- Formularios: React Hook Form + Zod (mensajes en español).
- **Listados: siempre `DataTable`** (`src/components/data-table`, ver `docs/frontend/data-table.md`): paginación,
  orden y filtros del lado del servidor con estado en la URL (`useDataTableState`), contrato
  `?page&per_page&sort=-campo&filter[x]=` → `{data, meta}`. Colecciones simples (catálogos) también usan `{data: [...]}`.
- Tokens de diseño en `src/index.css`: primario `--brand` #6366F1, acento `--brand-accent` #22D3EE
  (ojo: `--accent` de shadcn es la superficie de hover, no el cian). Números y códigos con la clase `num`
  (JetBrains Mono, tabular). Modo oscuro por defecto.
- Montos: `formatCurrency()` de `src/lib/format.ts` (es-BO, BOB).
- **Páginas delgadas:** una página solo enruta (editor vs. vista). Los editores de documentos viven en
  `components/<area>/` partidos por responsabilidad (cabecera, líneas, totales, acciones) con hooks de
  formulario (`use…Form`) y de flujo (`use…Flow`: guardar/confirmar/autorizar). Archivos ≤ ~300 líneas.

### Tests E2E (e2e/)

- Playwright (`@playwright/test`, imagen oficial `mcr.microsoft.com/playwright`, perfil compose `e2e`).
  Un reenviador TCP mantiene los orígenes `localhost:5173/8000`, así las cookies de Sanctum funcionan igual.
- Datos propios con `php artisan e2e:prepare` (productos `E2E-00x` con costo conocido; solo local/testing).
  Los tests no dependen de datos aleatorios del seed. CI corre el job `e2e` tras `api` y `web`.

### Servicio IA (apps/ai)

- `app/api/routes` (routers), `app/schemas` (Pydantic v2), `app/services` (modelos), `app/core`.
- Todo endpoint exige `X-Service-Token`, excepto `GET /health` (que responde solo `{"status":"ok"}`).
- Modelos de pronóstico implementan el protocolo `ForecastModel`; se inyectan con `get_forecast_model()`.
- Ruff + pytest.

## Reglas de base de datos (obligatorias)

1. **Dinero en `NUMERIC(14,2)`** (`$table->decimal('amount', 14, 2)`, cast `decimal:2`). Nunca float.
2. **Cantidades de inventario en `NUMERIC(14,4)`** (unidades fraccionables: kg, litros, metros).
   **Excepción de costeo (ADR 0004):** `unit_cost`/`avg_cost` en `NUMERIC(14,4)` y valores de inventario
   (`total_cost`, `value_after`, `total_value`) en `NUMERIC(16,4)` como precisión interna; la UI redondea a 2.
   Aritmética decimal siempre con `BcMath\Number` (+ `App\Domain\Shared\Support\Decimal`), nunca floats.
3. **Inventario como ledger de movimientos**: el stock es la suma de `stock_movements` (entradas
   positivas, salidas negativas). Nunca se edita un saldo "a mano"; los saldos materializados son caché
   derivada del ledger y se recalculan desde él.
4. **Documentos que se anulan, nunca se borran**: ventas, compras, cobros, pagos y movimientos tienen
   estado (`draft`, `posted`, `voided`) y una anulación genera el movimiento inverso. Prohibido
   `DELETE` sobre documentos contabilizados (sin soft delete como sustituto de anulación).
5. **`company_id` en toda tabla de negocio** + trait `App\Domain\Shared\Tenancy\BelongsToCompany` (global
   scope + autollenado). Desactivar el scope solo de forma explícita y justificada. Excepción: `users`
   se aísla por membresía (`company_user`) con `CompanyMemberScope`.
6. **Transacciones** (`DB::transaction`) en toda operación que toque stock o saldos, con bloqueo
   (`lockForUpdate`) de las filas de saldo afectadas para evitar condiciones de carrera.
7. Fechas con zona horaria (`timestampTz`); la zona de negocio es la de la empresa (`America/La_Paz`).
8. **Inventario (ADR 0004):** solo `PostInventoryDocument` / `VoidInventoryDocument` escriben el ledger
   (vía `StockLedger`, que bloquea saldos en orden (warehouse, product)). Costo promedio por producto y
   almacén; anulación al costo original; invariante `value >= 0` y `avg_cost >= 0` (si no, 422
   `void_cost_inconsistency`); stock negativo configurable por empresa (`insufficient_stock`);
   numeración sin huecos con `DocumentNumberer` dentro de la transacción; posting idempotente;
   `document_date` ≤ hoy y ≥ hoy − `companies.document_backdate_days`. `php artisan inventory:verify [--repair]`.
9. Auditoría: acciones sensibles registran `audit_logs` (inmutable) vía `App\Domain\Shared\Services\AuditLogger`.
10. **Ventas (ADR 0005):** `PostSalesDocument` / `VoidSalesDocument` crean y anulan el SAL- **solo** a través de
    las Actions públicas de inventario (enlace `inventory_documents.source_*` ↔ `sales_documents.inventory_document_id`).
    Precios con IVA incluido (13 %, desglosado; IT fuera del documento); descuento global prorrateado con residuo a la
    última línea (`Decimal::prorate`); margen = neto − costo de salida. **Orden de bloqueos en toda escritura de
    ventas y cobros: cliente → documento(s) → saldos de stock** (el bloqueo del cliente va siempre primero).
    Crédito se valida antes del SAL-; precio bajo costo/mínimo después (necesita el costo real). Excepciones solo con
    `sales.authorize_below_cost` / `sales.override_credit_limit` + motivo (auditado). Costos y márgenes en la API solo
    con `sales.view_margin`; saldos y deuda solo con `receivables.view`.
10b. **POS (Fase 2b):** `PosCheckout` no contiene reglas de negocio: orquesta `SaveSalesDraft` + `PostSalesDocument`
    en una transacción (Idempotency-Key obligatoria). Pagos mixtos = `tenders` de `PostSalesDocument` (un COB- automático por
    medio; deben sumar el total); el efectivo entregado y el cambio viven en `sales_documents.cash_received/change_amount`.
11. **Cuentas por cobrar:** `customer_ledger_entries` inmutable (`charge` +, `payment` −, `reversal`), escrito solo por
    `CustomerLedger`; `customers.balance` y `sales_documents.paid_amount` son cachés. `php artisan customers:verify [--repair]`.
    La fecha de cualquier documento respeta `DocumentDateWindow` (Shared).

### CCP Atlas (apps/web/src/features/atlas)

- Escena a medida con `three` + `@react-three/fiber` (sin drei). Shaders GLSL en `shaders/*.glsl` (`?raw`).
  Lógica pura en `lib/` con tests. Cada módulo < ~300 líneas. Dispose explícito de materiales,
  geometrías y texturas. Respetar `prefers-reduced-motion`. Ver `docs/frontend/atlas.md`.
- Endpoints `/atlas/*` cacheados en Redis con versión por empresa (`AtlasCache::bump` vía eventos).

## Comandos frecuentes

```bash
make up        # construye y levanta todo (espera healthchecks); crea .env si falta
make fresh     # migrate:fresh --seed (empresa demo, ~120 clientes, ~90 días de compras, ventas y cobros; admin@ccp.test / password)
make test      # Pest + pytest + Vitest
make e2e       # Playwright contra el stack levantado (fixtures: php artisan e2e:prepare)
make lint      # Pint + Ruff + ESLint/tsc/Prettier
make format    # autoformatea los tres servicios
make logs      # logs de todos los servicios
make down      # detiene (conserva volúmenes)

docker compose exec api php artisan <cmd>     # artisan
docker compose exec api composer <cmd>        # composer (PHP no se instala en el host)
docker compose exec web npm <cmd>             # npm dentro del contenedor
```

URLs en desarrollo: SPA http://localhost:5173 · API http://localhost:8000/api/v1 ·
IA (solo dev) http://localhost:8001/docs · Mailpit http://localhost:8025.

## Notas del entorno

- En Windows, `make` desde **PowerShell** (o `MSYS_NO_PATHCONV=1` en Git Bash: MSYS reescribe `-w /app`).
- Un único `.env` en la raíz (lo usan compose, Laravel —montado como `/var/www/html/.env`— y FastAPI).
  Variables de dominio (CORS, Sanctum, cookie) **solo** desde `.env`.
- En Windows, `node_modules` del contenedor web vive en un volumen (no en el bind mount).
- PHP en dev: `opcache.validate_timestamps=0` (el stat de archivos sobre el bind mount de Windows costaba ~2–3 s
  por request). `docker/php/dev-reload.sh` vigila `app/ config/ routes/ …` cada 2 s y recarga php-fpm solo;
  tras `composer require` también se recarga (cambia `composer.lock`). Si algo no se refleja: `docker compose restart api`.
- `phpunit.xml` fuerza variables con `<env>` y `<server>` porque Docker ya las define en `$_SERVER`.
