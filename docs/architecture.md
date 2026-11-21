# Arquitectura de CCP

## Vista general

```
                ┌──────────────────────────── red Docker (ccp_default) ────────────────────────────┐
 Navegador      │                                                                                   │
 (SPA React) ───┼──► nginx :8000 ──► api (php-fpm, Laravel) ──► postgres :5432 (pgdata)            │
   :5173        │                        │      │                                                  │
   ▲            │                        │      └──► redis :6379 (sesiones, caché, colas)          │
   │ Vite dev   │                        │                 ▲                                       │
   └── web ─────┤                        │                 └── queue (php artisan queue:work)      │
                │                        └──► ai :8000 (FastAPI)  ← X-Service-Token, sin puerto    │
                │                                                   público fuera de dev           │
                │                             mailpit :1025/:8025 (correo de desarrollo)           │
                └───────────────────────────────────────────────────────────────────────────────────┘
```

| Servicio | Imagen / build | Puerto host (dev) | Healthcheck |
|---|---|---|---|
| postgres | `postgres:18-alpine` | 5432 (override) | `pg_isready` |
| redis | `redis:8-alpine` | 6379 (override) | `redis-cli ping` |
| api | `docker/php/Dockerfile` (PHP 8.5 FPM) | — | ping de php-fpm |
| nginx | `nginx:1.29-alpine` | 8000 | `/nginx-health` |
| queue | misma imagen que api | — | proceso `queue:work` |
| ai | `docker/python/Dockerfile` (uv) | 8001 (override) | `GET /health` |
| web | `docker/node/Dockerfile` (Node 24) | 5173 | `GET /` |
| mailpit | `axllent/mailpit` | 8025 (override) | `/livez` |

## Flujo de autenticación (Sanctum SPA)

1. La SPA llama `GET /api/v1/auth/me`. Si responde 401, la ruta protegida redirige a
   `/login?redirect=<ruta>`.
2. Login: `GET /sanctum/csrf-cookie` (cookie `XSRF-TOKEN`) y luego `POST /api/v1/auth/login` con
   `X-XSRF-TOKEN`. Laravel valida, aplica el rate limit, regenera la sesión, registra `auth.login`
   en `audit_logs` y devuelve el usuario con su empresa, roles y permisos.
3. Las peticiones siguientes usan la cookie de sesión (Redis). Un 419 renueva el CSRF y reintenta una vez;
   un 401 limpia la sesión en la UI.
4. Logout: `POST /api/v1/auth/logout` invalida la sesión y la UI limpia la caché de TanStack Query.

## Multiempresa

- Membresía N:M en `company_user`; `users.company_id` es la **empresa activa** (siempre una membresía).
- Roles y permisos con **spatie teams** (`company_id` como team): las asignaciones son por empresa y
  el middleware `company` llama `setPermissionsTeamId()` con la empresa activa. Ver
  [ADR 0002](adr/0002-roles-por-empresa-spatie-teams.md).
- Los usuarios se filtran por membresía (`CompanyMemberScope`). Cada modelo de negocio usa `BelongsToCompany`:
  - un global scope `CompanyScope` filtra por `CurrentCompany::id()` (empresa del usuario
    autenticado, o una fijada a mano en jobs y consola);
  - autollenado de `company_id` al crear.
- En la beta cada usuario tiene una sola empresa (sin selector); el esquema ya soporta varias.

## Contrato de errores de la API

```json
{ "error": { "status": 422, "code": "validation_failed", "message": "…", "details": { "email": ["…"] } } }
```

Códigos: `unauthenticated` (401), `forbidden` (403), `not_found` (404), `method_not_allowed` (405),
`csrf_token_mismatch` (419), `validation_failed` (422), `too_many_requests` (429), `server_error` (500).
El bloque `debug` solo aparece con `APP_DEBUG=true`.

## Health

`GET /api/v1/health` responde 200 si todo está bien y 503 si algo falla:

```json
{ "status": "ok", "checks": { "database": {"status":"ok","latency_ms":3.1},
  "redis": {"status":"ok","latency_ms":0.8}, "ai": {"status":"ok","latency_ms":12.4} },
  "timestamp": "…" }
```

El chequeo de IA llama a `GET /v1/ping` **autenticado**, así que valida tanto la conectividad como el token.

## Frontend

```
src/
  app/providers.tsx        QueryClient, Tooltip, Toaster, sincronización de tema
  routes/                  router (lazy por página), guards Protected/Guest
  components/ui            shadcn/ui
  components/layout        AppShell, Sidebar, Topbar, CommandPalette, navigation.ts
  components/feedback      EmptyState, skeletons, loaders
  features/<modulo>/       api · hooks · services · components · pages · types
  lib/                     api (axios + CSRF), api-error, format, env, query-client
  stores/                  theme-store, ui-store (Zustand, persistidos)
```

La navegación (`navigation.ts`) es la fuente única para el sidebar, los breadcrumbs, el command palette
y las rutas placeholder, y se filtra por los permisos del usuario.
