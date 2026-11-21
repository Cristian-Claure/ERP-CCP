# ADR 0001 — Arquitectura monorepo: Laravel como gateway, IA aislada y Sanctum con cookies

- **Estado:** Aceptado
- **Fecha:** 2026-11-21
- **Fase:** 0 (cimientos)

## Contexto

CCP es un ERP multiempresa con tres piezas de naturaleza distinta: una API transaccional con reglas
contables estrictas, una SPA con UX de nivel SaaS y capacidades de IA (pronósticos, asistente) cuyo
ecosistema natural es Python. El equipo es pequeño y necesita moverse rápido sin sacrificar
integridad de datos ni seguridad.

## Decisión

### 1. Monorepo con tres apps

`apps/api` (Laravel), `apps/web` (React + Vite) y `apps/ai` (FastAPI), más `docker/` y `docs/`, en un
solo repositorio con un único `docker-compose.yml`, `Makefile` y pipeline de CI.

- Un cambio que cruza capas (p. ej. un endpoint nuevo y su pantalla) va en un solo PR.
- Un solo `.env` raíz como fuente de verdad de la configuración en desarrollo.
- Cada app conserva su tooling nativo (Composer/Pint/Pest, npm/ESLint/Vitest, uv/Ruff/pytest).

### 2. Laravel como único gateway

El navegador solo habla con Laravel (`/api/v1`). Laravel concentra autenticación, autorización
(spatie/permission + policies), multiempresa (`BelongsToCompany`), validación, auditoría y
transacciones de base de datos.

- Las reglas de negocio críticas (stock como ledger, documentos anulables, dinero en NUMERIC)
  viven en **un** lugar, con el ORM y las transacciones de PostgreSQL.
- El ecosistema Laravel ofrece colas, mail, rate limiting y Sanctum sin código a medida.
- El frontend tiene un solo contrato (envelope de error uniforme y recursos versionados).

### 3. Servicio de IA aislado (FastAPI)

`apps/ai` no tiene puerto público fuera de desarrollo (`docker-compose.override.yml` expone el 8001
solo en dev). Laravel lo llama por la red interna con `AiClient` y un token de servicio compartido
(`X-Service-Token`, comparación en tiempo constante; si el token configurado está vacío, el servicio
rechaza todo).

- **Seguridad:** la IA nunca ve cookies de usuario ni decide permisos; recibe datos ya autorizados
  y filtrados por empresa desde Laravel. Su superficie de ataque es mínima. `GET /health` es público
  pero solo responde `{"status":"ok"}`, sin versiones ni detalles internos.
- **Ecosistema:** pandas, statsmodels, scikit-learn y LLM SDKs viven en Python.
- **Escalado y fallos independientes:** los modelos pueden consumir CPU/RAM o caerse sin tumbar la
  API transaccional; `/api/v1/health` lo reporta como `degraded` (HTTP 503).
- **Interfaz estable:** `POST /v1/forecast/demand` define esquemas Pydantic. Hoy usa media móvil;
  mañana un modelo real detrás del mismo protocolo `ForecastModel`.

### 4. Sanctum en modo SPA con cookies (no tokens)

La SPA se autentica con la sesión de Laravel: `GET /sanctum/csrf-cookie` y luego
`POST /api/v1/auth/login`. Las peticiones siguientes llevan la cookie de sesión (HttpOnly) y el header
`X-XSRF-TOKEN`.

- **Sin tokens en JavaScript:** la cookie HttpOnly no es legible por un XSS, a diferencia de un token
  en localStorage.
- **CSRF cubierto** por el doble envío XSRF de Laravel. `SameSite=Lax` por defecto.
- **Revocación inmediata:** logout invalida la sesión en el servidor (Redis).
- Login con rate limiting (5/min por email+IP, 20/min por IP), regeneración de sesión y auditoría.

## Configuración por entorno (todo desde `.env`)

Nada de dominios hardcodeados: `config/cors.php` y `config/sanctum.php` leen listas separadas por coma.

| Variable | Desarrollo | Producción (subdominios) |
|---|---|---|
| `APP_URL` | `http://localhost:8000` | `https://api.dominio.com` |
| `VITE_API_URL` (SPA) | `http://localhost:8000` | `https://api.dominio.com` |
| `SANCTUM_STATEFUL_DOMAINS` | `localhost:5173,127.0.0.1:5173` | `app.dominio.com` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | `https://app.dominio.com` |
| `SESSION_DOMAIN` | `null` (cookie host-only de `localhost`) | `.dominio.com` |
| `SESSION_SECURE_COOKIE` | `false` | `true` |
| `SESSION_SAME_SITE` | `lax` | `lax` |

### Producción con `app.dominio.com` (SPA) y `api.dominio.com` (API)

1. **Mismo "site":** `app.` y `api.` comparten el dominio registrable `dominio.com`, así que el
   navegador trata las peticiones como *same-site*. Las cookies `SameSite=Lax` viajan en los `fetch`
   con credenciales. No hace falta `SameSite=None`.
2. **Cookie compartida:** `SESSION_DOMAIN=.dominio.com` permite que la cookie `XSRF-TOKEN` emitida por
   `api.` sea legible desde JavaScript en `app.` (axios la copia al header `X-XSRF-TOKEN`) y que la
   cookie de sesión se envíe a `api.`.
3. **Stateful:** `SANCTUM_STATEFUL_DOMAINS=app.dominio.com` hace que Sanctum aplique sesión a las
   peticiones cuyo `Origin`/`Referer` es la SPA.
4. **CORS:** `CORS_ALLOWED_ORIGINS=https://app.dominio.com` con `supports_credentials=true`
   (comodín `*` prohibido con credenciales).
5. **HTTPS obligatorio:** `SESSION_SECURE_COOKIE=true`, HSTS en el proxy y `APP_URL` con https.
6. **IA:** sin `ports:` publicados; solo `AI_SERVICE_URL=http://ai:8000` dentro de la red privada.
   `AI_DOCS_ENABLED=false` y un `AI_SERVICE_TOKEN` largo y rotado.
7. Alternativa (también válida): servir SPA y API bajo el mismo host (`dominio.com` y
   `dominio.com/api`) detrás de un proxy, lo que elimina CORS por completo.

## Consecuencias

**Positivas:** una sola fuente de verdad para reglas de negocio y seguridad; la IA evoluciona
y escala sin riesgo para los datos transaccionales; sesión robusta frente a XSS; onboarding con
`make up`.

**Negativas / costos:** un salto de red extra (Laravel → IA) en funciones inteligentes, que se mitiga
con timeouts cortos y colas para trabajos pesados. Sanctum con cookies exige que SPA y API compartan
dominio registrable (no sirve para un cliente de terceros en otro dominio; para eso se usarían tokens
de Sanctum o OAuth). Tres toolchains que mantener en CI.

## Alternativas consideradas

- **IA dentro de Laravel (PHP):** descartado por la falta de ecosistema de ML.
- **Frontend llamando directo a la IA:** descartado: expone la IA, duplica la autorización y filtra
  datos entre empresas.
- **JWT/Bearer en localStorage:** descartado por exposición ante XSS y revocación más compleja.
- **Polyrepo:** descartado por el costo de coordinar versiones y PRs en un equipo pequeño.
