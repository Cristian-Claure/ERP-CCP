# Créditos de datos y recursos

Regla del proyecto: solo datos de dominio público o con licencia abierta, con su atribución visible.

## Mapas

| Recurso | Uso | Licencia / condiciones | Atribución |
|---|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright) — teselas `tile.openstreetmap.org` | Mapa 2D de clientes (formulario, detalle) y vista alternativa de Atlas | Datos © colaboradores de OpenStreetMap, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/). Uso de teselas sujeto a la [política de uso](https://operations.osmfoundation.org/policies/tiles/): atribución visible, sin descargas masivas ni *prefetch* agresivo | Control de atribución de Leaflet en cada mapa |
| [Leaflet](https://leafletjs.com) | Motor de mapas 2D | BSD-2-Clause | Prefijo del control de atribución |

La URL de teselas es configurable (`VITE_MAP_TILE_URL`, `VITE_MAP_TILE_ATTRIBUTION`) para cambiar de
proveedor o autoalojarlas sin tocar código.

## CCP Atlas (globo 3D)

| Recurso | Archivo(s) en `apps/web/public/atlas/` | Fuente | Licencia |
|---|---|---|---|
| Mapa de día — NASA Blue Marble: Next Generation | `textures/day-{2k,4k}.webp` | NASA Earth Observatory (Reto Stöckli, NASA GSFC), vía el espejo de ejemplos de [three-globe](https://github.com/vasturiano/three-globe) | Dominio público (NASA) |
| Luces nocturnas — NASA Black Marble / Earth at Night | `textures/night-{2k,4k}.webp` | NASA Earth Observatory / NOAA NGDC, mismo espejo | Dominio público (NASA) |
| Relieve (bump) | `textures/bump-2k.webp` | Topografía NASA, mismo espejo | Dominio público (NASA) |
| Nubes | `textures/clouds-2k.webp` | Composición de nubes NASA, vía ejemplos de [globe.gl](https://github.com/vasturiano/globe.gl) | Dominio público (NASA) |
| Máscara especular (océanos) | `textures/specular-2k.webp` | Generada rasterizando los países de Natural Earth 50m | Dominio público (Natural Earth) |
| Fronteras de países 1:110m y 1:50m | `geo/countries-{110m,50m}.json` | [Natural Earth](https://www.naturalearthdata.com/) vía [world-atlas](https://github.com/topojson/world-atlas) (ISC) | Dominio público |
| Departamentos de Bolivia (admin-1, 1:10m) | `geo/bolivia-admin1.json` | [Natural Earth](https://www.naturalearthdata.com/) `ne_10m_admin_1_states_provinces`, filtrado | Dominio público |

Las imágenes se reescalaron y comprimieron a WebP con `docs/scripts/atlas_assets.py` (Pillow). Los
servidores de NASA (`eoimages.gsfc.nasa.gov`) no eran accesibles desde el entorno de desarrollo, por
eso se usaron espejos públicos de las mismas imágenes de dominio público. Solo el mapa de día y las
luces nocturnas tienen versión 4K; el resto es 2K. Total en el repositorio: ~2,5 MB.

## Datos demo

Los clientes, NIT/CI, nombres y direcciones de los datos demo son **ficticios**. Las coordenadas son
centros aproximados de barrios y ciudades reales (con un desplazamiento aleatorio), tomados de mapas
de OpenStreetMap.
