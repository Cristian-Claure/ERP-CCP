# Propuesta: publicar una demo en línea gratuita

- **Estado:** propuesta para decidir. No se creó ninguna cuenta ni se instaló nada externo.
- **Alcance:** una **demo pública** con datos ficticios, no un entorno productivo.
- **Advertencia:** los planes gratuitos cambian a menudo. Las condiciones de abajo resumen lo conocido a
  noviembre de 2026 y **hay que verificarlas en la página de precios de cada proveedor** antes de decidir.

## Qué hay que publicar

| Pieza | En desarrollo | Para la demo |
|---|---|---|
| SPA (React) | Vite dev server | `npm run build`: archivos estáticos detrás de cualquier servidor |
| API (Laravel 13, PHP 8.5) | php-fpm + nginx | Imagen Docker con php-fpm y nginx; `APP_ENV=production`, `APP_DEBUG=false` |
| PostgreSQL 18 | contenedor | 1 base de datos de unos 300 MB con el seed de 90 días |
| Redis | contenedor | caché del Atlas, sesiones y cola (en la demo se puede usar `QUEUE_CONNECTION=sync` y `SESSION_DRIVER=database`) |
| IA (FastAPI) | contenedor | **Opcional** en la demo: hoy solo la consulta el health check, que la reporta como no disponible si falta |
| Cola (`queue:work`) | contenedor | Innecesaria con `QUEUE_CONNECTION=sync` |

Condición técnica: Sanctum usa cookies, así que **la SPA y la API deben compartir dominio raíz**
(`demo.ejemplo.org` y `api.demo.ejemplo.org`, o la SPA servida por el mismo nginx de la API). Eso define
`SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN` y CORS, todos desde `.env` (CLAUDE.md).

## Cómo leer la tabla

La regla de software libre de CLAUDE.md prohíbe lo que requiera **pago, tarjeta, API key de un servicio
comercial o cuenta en un SaaS**:

- ⚠️ choca con la regla (cuenta en SaaS);
- ⛔ choca más fuerte (tarjeta de crédito o pago futuro probable).

**Toda publicación en internet requiere al menos una cuenta en algún lado** (hosting, DNS o túnel), salvo
que se use una IP pública propia. Por eso ninguna opción cumple la regla al 100 %: la decisión es cuál
excepción se acepta.

## Opciones

### 1. Servidor propio (PC, mini-PC o Raspberry Pi 5) + Docker Compose

- **Cuenta / tarjeta / pago:** ninguna si hay IP pública fija y dominio propio. Sin IP pública hace falta un
  túnel (opción 2) o DNS dinámico; DuckDNS pide iniciar sesión con GitHub o Google (⚠️).
- **Límites:** los de la máquina y la conexión. Un equipo con 8 GB de RAM mueve todo el stack.
- **Encaje con el stack:** total. Es el mismo `docker-compose.yml` con un perfil de producción, más **Caddy**
  (Apache-2.0) para HTTPS automático con Let's Encrypt (gratuito, sin tarjeta, CA sin fines de lucro).
- **Contras:** depende de la luz y del internet de casa, y uno es responsable de los parches del sistema.

### 2. Servidor propio + Cloudflare Tunnel ⚠️

- **Cuenta:** Cloudflare, plan gratuito sin tarjeta. Requiere tener el dominio en Cloudflare.
- **Límites:** generosos para una demo; sin límite de ancho de banda declarado para túneles.
- **Encaje:** total (igual que la opción 1), sin abrir puertos ni necesitar IP pública. `cloudflared` es
  Apache-2.0, pero el servicio es SaaS propietario.

### 3. Oracle Cloud «Always Free» ⛔

- **Cuenta y tarjeta:** pide tarjeta para verificar identidad, aunque no cobra mientras no se pase de la capa
  gratuita.
- **Límites:** VM ARM Ampere de hasta 4 OCPU y 24 GB, y 200 GB de disco. Sobra para todo el stack.
- **Encaje:** total (Docker Compose en la VM). Es la opción técnicamente más cómoda.
- **Riesgos:** reclaman las instancias inactivas y existe riesgo de cobro si se cambia de plan por error.

### 4. Render (plan gratuito) ⚠️

- **Cuenta:** con GitHub o correo. **No pide tarjeta** para los servicios gratuitos (verificar).
- **Límites:**
  - los web services gratuitos se duermen tras unos 15 minutos sin tráfico (arranque en frío de 30 a
    60 s) y tienen 512 MB de RAM;
  - Postgres gratuito de 1 GB que **vence a los 30 días** (sirve como «reseteo mensual» forzoso);
  - Key Value (compatible con Redis) de 25 MB;
  - los workers en segundo plano y los servicios privados no son gratuitos.
- **Encaje:**
  - SPA como *static site*, gratuita;
  - Laravel como web service Docker (php-fpm y nginx en una imagen);
  - FastAPI omitida o como segundo web service público, protegido por `X-Service-Token`;
  - cola en `sync`.
- **Contras:** arranques lentos, recrear la base cada mes y depender de un SaaS.

### 5. Hugging Face Spaces (Docker) ⚠️

- **Cuenta:** gratuita, sin tarjeta.
- **Límites:** CPU básica con 2 vCPU y 16 GB; se duerme tras unas 48 h sin uso; disco efímero, salvo
  almacenamiento persistente de pago.
- **Encaje:** un **solo contenedor** con todo el stack (Postgres, Redis, php-fpm, nginx y FastAPI bajo
  supervisord) que ejecuta `migrate:fresh --seed` al arrancar. Así el reseteo viene «gratis» con cada
  reinicio.
- **Contras:** es atípico (es una plataforma de demos de ML), el arranque es lento (el seed tarda unos
  2 minutos) y hay que adaptar el Dockerfile.

### 6. Fly.io, Railway, Koyeb, Google Cloud ⛔

- **Fly.io y Railway:** hoy piden tarjeta o funcionan con créditos de prueba que se agotan (pago futuro).
- **Google Cloud (e2-micro Always Free):** tarjeta obligatoria, y 1 GB de RAM no alcanza para el stack completo.
- **Koyeb:** instancia gratuita pequeña (unos 512 MB); las condiciones de tarjeta han cambiado (verificar).
  Además tendría el mismo problema de varios servicios que Render.

## Comparación

| Opción | Cuenta | Tarjeta | Pago futuro | Stack completo | Siempre encendida | Esfuerzo |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| 1. Servidor propio | — / ⚠️ DNS | No | No | Sí | Depende de la casa | Medio |
| 2. Propio + Cloudflare Tunnel | ⚠️ | No | No | Sí | Depende de la casa | Medio |
| 3. Oracle Always Free | ⛔ | **Sí** | Riesgo | Sí | Sí | Bajo |
| 4. Render | ⚠️ | No* | No | Parcial (sin IA ni cola) | No (se duerme) | Medio |
| 5. Hugging Face Spaces | ⚠️ | No | No | Sí (un contenedor) | No (se duerme) | Alto |
| 6. Fly / Railway / GCP / Koyeb | ⛔ | Sí* | Probable | Variable | Variable | Medio |

\* Verificar al momento de decidir.

## Seguridad mínima para una demo pública

1. **Datos ficticios únicamente.** El seed actual (Comercial Demo) ya lo es. Ningún dato real ni copia de
   producción.
2. **Usuario demo de solo lectura:**
   - un rol `demo` con permisos `*.view` (dashboard, inventario, ventas, compras, Atlas), sin permisos de
     acción;
   - credenciales mostradas en la pantalla de login;
   - las Policies y el API ya rechazan todo lo demás.
3. **Alternativa: acceso completo con reseteo periódico.**
   - `php artisan migrate:fresh --seed --force` programado cada noche con el scheduler de Laravel o un cron
     del host;
   - un banner fijo: «Demo: los datos se reinician cada día a las 03:00 (hora de Bolivia)».
4. **Endurecimiento:**
   - `APP_DEBUG=false` y `APP_KEY` propio;
   - `SESSION_SECURE_COOKIE=true`;
   - CORS y `SANCTUM_STATEFUL_DOMAINS` solo al dominio de la demo;
   - sin `users.manage` ni `settings.manage` para el usuario demo;
   - el correo deshabilitado o en `log`;
   - Mailpit y los puertos de Postgres y Redis **no** expuestos; la documentación de FastAPI (`/docs`)
     deshabilitada.
5. **Abuso:**
   - el rate limiting ya existe (login 5/min por correo e IP y API 120/min por usuario);
   - límite de cuerpo en nginx;
   - `robots.txt` con `noindex`.
6. **Copias:** innecesarias, porque los datos se regeneran con el seed.

## Recomendación

- **Para respetar la regla lo más posible: opción 1 o 2.** El mismo Docker Compose del repositorio en un
  equipo propio, con Caddy para HTTPS.
  - Con IP pública: no hace falta ninguna cuenta (solo el dominio).
  - Sin IP pública: Cloudflare Tunnel, aceptando una cuenta gratuita sin tarjeta como única excepción.
  - Es el camino que reutiliza todo lo construido sin adaptar nada, y donde el reseteo nocturno es un simple
    cron.
- **Si no hay un equipo disponible: opción 4 (Render)**, con usuario demo de solo lectura, sin servicio de
  IA y aceptando los arranques en frío. El vencimiento mensual de su Postgres encaja con el reseteo.
- **Se descartan** Oracle, Fly.io, Railway y GCP mientras pidan tarjeta.

La decisión es tuya. Una vez elegida la opción, el siguiente paso sería un `docker-compose.prod.yml` (o un
Dockerfile único para Render o Spaces), el rol `demo`, el comando programado de reseteo y la guía de
publicación.
