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

- El navegador **solo** habla con Laravel. Laravel llama a la IA con `App\Services\Ai\AiClient`
  (header `X-Service-Token`). Nunca expongas `apps/ai` al frontend.
- Auth: Sanctum SPA con cookies (sesión + XSRF). Nada de tokens en localStorage.
- Ver `docs/architecture.md` y `docs/adr/0001-arquitectura-monorepo.md`.

## Convenciones

- **Código en inglés** (clases, variables, tablas, columnas, rutas de API, commits).
  **UI en español** (textos, mensajes de error al usuario, rutas del frontend como `/inventario`).
- Commits convencionales (`feat(api): …`, `fix(web): …`, `chore(docker): …`), pequeños y enfocados.
- Ramas: `feat/<fase-o-tema>`; PR hacia `main`. Nunca `push --force` sobre `main`.

### Backend (apps/api)

- Capas: `Http/Controllers/Api/V1` (delgados) → `Http/Requests` (validación) → `Actions` (un caso de
  uso) / `Services` (integraciones y lógica reutilizable) → `Models`. Respuestas con `Http/Resources`.
  Autorización con `Policies` + permisos spatie (`<modulo>.<accion>`, p. ej. `inventory.manage`).
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
- Tokens de diseño en `src/index.css`: primario `--brand` #6366F1, acento `--brand-accent` #22D3EE
  (ojo: `--accent` de shadcn es la superficie de hover, no el cian). Números y códigos con la clase `num`
  (JetBrains Mono, tabular). Modo oscuro por defecto.
- Montos: `formatCurrency()` de `src/lib/format.ts` (es-BO, BOB).

### Servicio IA (apps/ai)

- `app/api/routes` (routers), `app/schemas` (Pydantic v2), `app/services` (modelos), `app/core`.
- Todo endpoint exige `X-Service-Token`, excepto `GET /health` (que responde solo `{"status":"ok"}`).
- Modelos de pronóstico implementan el protocolo `ForecastModel`; se inyectan con `get_forecast_model()`.
- Ruff + pytest.

## Reglas de base de datos (obligatorias)

1. **Dinero en `NUMERIC(14,2)`** (`$table->decimal('amount', 14, 2)`, cast `decimal:2`). Nunca float.
2. **Cantidades de inventario en `NUMERIC(14,4)`** (unidades fraccionables: kg, litros, metros).
   Costos unitarios también con 4 decimales si hace falta precisión de costeo.
3. **Inventario como ledger de movimientos**: el stock es la suma de `stock_movements` (entradas
   positivas, salidas negativas). Nunca se edita un saldo "a mano"; los saldos materializados son caché
   derivada del ledger y se recalculan desde él.
4. **Documentos que se anulan, nunca se borran**: ventas, compras, cobros, pagos y movimientos tienen
   estado (`draft`, `posted`, `voided`) y una anulación genera el movimiento inverso. Prohibido
   `DELETE` sobre documentos contabilizados (sin soft delete como sustituto de anulación).
5. **`company_id` en toda tabla de negocio** + trait `App\Models\Concerns\BelongsToCompany` (global
   scope + autollenado). Desactivar el scope solo de forma explícita y justificada.
6. **Transacciones** (`DB::transaction`) en toda operación que toque stock o saldos, con bloqueo
   (`lockForUpdate`) de las filas de saldo afectadas para evitar condiciones de carrera.
7. Fechas con zona horaria (`timestampTz`); la zona de negocio es la de la empresa (`America/La_Paz`).
8. Auditoría: acciones sensibles registran `audit_logs` (inmutable) vía `App\Services\AuditLogger`.

## Comandos frecuentes

```bash
make up        # construye y levanta todo (espera healthchecks); crea .env si falta
make fresh     # migrate:fresh --seed (empresa demo + admin@ccp.test / password)
make test      # Pest + pytest + Vitest
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

- Un único `.env` en la raíz (lo usan compose, Laravel —montado como `/var/www/html/.env`— y FastAPI).
  Variables de dominio (CORS, Sanctum, cookie) **solo** desde `.env`.
- En Windows, `node_modules` del contenedor web vive en un volumen (no en el bind mount).
- `phpunit.xml` fuerza variables con `<env>` y `<server>` porque Docker ya las define en `$_SERVER`.
