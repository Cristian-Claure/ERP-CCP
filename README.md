<p align="center">
  <img src="apps/web/src/assets/logo.svg" width="72" alt="CCP" />
</p>

<h1 align="center">CCP — Control Central de Procesos</h1>

<p align="center"><strong>Tu empresa, bajo control.</strong><br/>
ERP web para pymes: inventario, ventas, compras, finanzas e inteligencia de negocio.</p>

<p align="center">
  <a href="https://github.com/Cristian-Claure/ERP-CCP/actions/workflows/ci.yml"><img src="https://github.com/Cristian-Claure/ERP-CCP/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/estado-BETA-6366F1" alt="BETA" />
  <img src="https://img.shields.io/badge/Laravel-13-FF2D20?logo=laravel&logoColor=white" alt="Laravel 13" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/FastAPI-Python%203.12-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 18" />
</p>

---

## Capturas

> Pendientes: login, dashboard (oscuro y claro), sidebar colapsado, command palette y vista móvil.

## Stack

| Capa | Tecnología |
|---|---|
| API | Laravel 13 · PHP 8.5 · PostgreSQL 18 · Redis 8 · Sanctum (SPA, cookies) · spatie/laravel-permission · Pest |
| Web | React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · shadcn/ui · TanStack Query · React Router · Zustand · React Hook Form + Zod · Recharts · Vitest |
| IA | Python 3.12 · FastAPI · Pydantic v2 · uv · Ruff · pytest |
| Infra | Docker Compose · nginx · Mailpit · GitHub Actions |

## Arranque rápido

Requisitos: Docker Desktop (o Docker Engine + Compose v2), GNU Make y Git. **No** hace falta PHP,
Composer ni Python en el host.

```bash
git clone https://github.com/Cristian-Claure/ERP-CCP.git
cd ERP-CCP
make up      # crea .env con secretos aleatorios, construye y levanta todo
make fresh   # migra y carga datos demo
```

| | URL |
|---|---|
| Aplicación | http://localhost:5173 |
| API | http://localhost:8000/api/v1 · health: `/api/v1/health` |
| Docs del servicio IA (solo dev) | http://localhost:8001/docs |
| Mailpit | http://localhost:8025 |

**Usuario demo:** `admin@ccp.test` / `password` (también `gerente@`, `vendedor@` y
`almacenero@ccp.test` con la misma contraseña), en la empresa *Comercial Demo S.R.L.*

### Comandos

```bash
make test     # Pest + pytest + Vitest
make lint     # Pint + Ruff + ESLint, tsc y Prettier
make format   # autoformatea todo
make logs     # logs en vivo
make down     # detiene los contenedores
```

## Estructura

```
apps/api    API Laravel (gateway único)
apps/web    SPA React
apps/ai     Servicio interno de IA (FastAPI)
docker/     Dockerfiles y configuración
docs/       Arquitectura y ADRs
```

Más detalle en [`docs/architecture.md`](docs/architecture.md) y
[`docs/adr/0001-arquitectura-monorepo.md`](docs/adr/0001-arquitectura-monorepo.md).
Convenciones y reglas de base de datos en [`CLAUDE.md`](CLAUDE.md).

## Roadmap

- [x] **Fase 0 — Cimientos:** monorepo, Docker, auth Sanctum, multiempresa (roles por empresa), health, servicio IA, AppShell y dashboard
- [x] **Fase 1 — Inventario:** productos, almacenes, ledger de movimientos, costo promedio, kardex con CSV, ajustes por conteo, anulaciones, numeración sin huecos, `inventory:verify` y DataTable reutilizable
- [ ] **Fase 2 — Ventas** *(propuesta: [docs/roadmap/fase-2-ventas.md](docs/roadmap/fase-2-ventas.md))*: clientes, cotizaciones, ventas con salida de stock atómica, cobros y cuentas por cobrar
- [ ] **Fase 3 — Compras:** proveedores, órdenes, recepciones con entrada a stock
- [ ] **Fase 4 — Finanzas:** caja y bancos, cuentas por cobrar y por pagar
- [ ] **Fase 5 — Inteligencia:** pronósticos de demanda reales y asistente IA sobre los datos de la empresa
- [ ] **Fase 6 — Sistema:** gestión de usuarios y roles, configuración de empresa, auditoría visible

## Licencia

Propietario. Todos los derechos reservados.
