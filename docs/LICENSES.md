# Licencias de dependencias

Regla del proyecto (CLAUDE.md): solo software libre con licencia aprobada por la OSI y recursos
gratuitos. Esta tabla lista las **dependencias directas**; las transitivas se auditan con las mismas
herramientas. Cualquier fila "Revisar" debe consultarse antes de mergear.

Generada con herramientas libres:

```bash
docker compose exec -T web npx --yes license-checker@25.0.1 --json > web.json   # BSD-3-Clause
docker compose exec -T api composer licenses --format=json > api.json
# apps/ai: metadatos de importlib.metadata (lo mismo que lee pip-licenses)
python docs/scripts/build_licenses.py web.json api.json ai.json > docs/LICENSES.md
```

## Descartadas por licencia

| Paquete | Licencia | Motivo | Alternativa usada |
|---|---|---|---|
| `react-leaflet` | Hippocratic-2.1 | No aprobada por la OSI | Wrapper propio sobre `leaflet` (BSD-2-Clause) |

## Web (`apps/web`)

| Paquete | Versión | Uso | Licencia | OSI |
|---|---|---|---|---|
| `@fontsource-variable/inter` | 5.3.0 | runtime | OFL-1.1 | Sí |
| `@fontsource-variable/jetbrains-mono` | 5.3.0 | runtime | OFL-1.1 | Sí |
| `@hookform/resolvers` | 7.0.8 | runtime | MIT | Sí |
| `@tanstack/react-query` | 5.108.2 | runtime | MIT | Sí |
| `@tanstack/react-table` | 9.3.1 | runtime | MIT | Sí |
| `axios` | 1.21.1 | runtime | MIT | Sí |
| `class-variance-authority` | 0.7.1 | runtime | Apache-2.0 | Sí |
| `cmdk` | 1.1.1 | runtime | MIT | Sí |
| `cn` | 0.5.2 | runtime | MIT | Sí |
| `leaflet` | 1.9.4 | runtime | BSD-2-Clause | Sí |
| `lucide-react` | 1.77.0 | runtime | ISC | Sí |
| `motion` | 14.14.0 | runtime | MIT | Sí |
| `radix-ui` | 1.8.1 | runtime | MIT | Sí |
| `react` | 19.3.1 | runtime | MIT | Sí |
| `react-dom` | 19.3.1 | runtime | MIT | Sí |
| `react-hook-form` | 7.92.0 | runtime | MIT | Sí |
| `react-router` | 8.5.2 | runtime | MIT | Sí |
| `recharts` | 3.11.0 | runtime | MIT | Sí |
| `shadcn` | 4.23.0 | runtime | MIT | Sí |
| `sonner` | 2.0.8 | runtime | MIT | Sí |
| `zod` | 4.6.7 | runtime | MIT | Sí |
| `zustand` | 5.1.0 | runtime | MIT | Sí |
| `@eslint/js` | 10.0.1 | dev | MIT | Sí |
| `@tailwindcss/vite` | 4.3.5 | dev | MIT | Sí |
| `@testing-library/jest-dom` | 8.0.0 | dev | MIT | Sí |
| `@testing-library/react` | 16.3.3 | dev | MIT | Sí |
| `@testing-library/user-event` | 14.6.13 | dev | MIT | Sí |
| `@types/leaflet` | 1.9.20 | dev | MIT | Sí |
| `@types/node` | 24.19.2 | dev | MIT | Sí |
| `@types/react` | 19.3.0 | dev | MIT | Sí |
| `@types/react-dom` | 19.3.0 | dev | MIT | Sí |
| `@vitejs/plugin-react` | 6.3.0 | dev | MIT | Sí |
| `eslint` | 10.15.0 | dev | MIT | Sí |
| `eslint-config-prettier` | 10.1.8 | dev | MIT | Sí |
| `eslint-plugin-react-hooks` | 7.1.1 | dev | MIT | Sí |
| `eslint-plugin-react-refresh` | 0.5.8 | dev | MIT | Sí |
| `globals` | 17.14.0 | dev | MIT | Sí |
| `jsdom` | 31.0.1 | dev | MIT | Sí |
| `prettier` | 3.10.1 | dev | MIT | Sí |
| `prettier-plugin-tailwindcss` | 0.8.1 | dev | MIT | Sí |
| `tailwindcss` | 4.3.5 | dev | MIT | Sí |
| `tw-animate-css` | 1.4.0 | dev | MIT | Sí |
| `typescript` | 6.0.3 | dev | Apache-2.0 | Sí |
| `typescript-eslint` | 8.73.0 | dev | MIT | Sí |
| `vite` | 8.3.8 | dev | MIT | Sí |
| `vitest` | 5.1.1 | dev | MIT | Sí |

## API (`apps/api`)

| Paquete | Versión | Uso | Licencia | OSI |
|---|---|---|---|---|
| `laravel/framework` | v13.43.0 | runtime | MIT | Sí |
| `laravel/sanctum` | v4.5.0 | runtime | MIT | Sí |
| `laravel/tinker` | v3.2.0 | runtime | MIT | Sí |
| `spatie/laravel-permission` | 8.5.0 | runtime | MIT | Sí |
| `spatie/laravel-query-builder` | 7.3.9 | runtime | MIT | Sí |
| `fakerphp/faker` | v1.24.1 | dev | MIT | Sí |
| `laravel/pail` | v1.3.0 | dev | MIT | Sí |
| `laravel/pao` | v1.1.6 | dev | MIT | Sí |
| `laravel/pint` | v1.32.3 | dev | MIT | Sí |
| `mockery/mockery` | 1.6.15 | dev | BSD-3-Clause | Sí |
| `nunomaduro/collision` | v8.9.6 | dev | MIT | Sí |
| `pestphp/pest` | v5.3.7 | dev | MIT | Sí |
| `pestphp/pest-plugin-laravel` | v5.0.1 | dev | MIT | Sí |

## Servicio IA (`apps/ai`)

| Paquete | Versión | Uso | Licencia | OSI |
|---|---|---|---|---|
| `fastapi` | 0.165.0 | runtime | MIT | Sí |
| `pydantic` | 2.14.4 | runtime | MIT | Sí |
| `pydantic-settings` | 2.16.3 | runtime | MIT | Sí |
| `uvicorn` | 0.54.0 | runtime | BSD-3-Clause | Sí |
| `httpx` | 0.28.1 | dev | BSD-3-Clause | Sí |
| `pytest` | 9.2.0 | dev | MIT | Sí |
| `ruff` | 0.17.6 | dev | MIT | Sí |

## Datos y servicios externos

Ver [`CREDITS.md`](CREDITS.md) (mapas, texturas y datos geográficos).

