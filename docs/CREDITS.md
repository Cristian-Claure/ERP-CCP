# Créditos de datos y recursos

Regla del proyecto: solo datos de dominio público o con licencia abierta, con su atribución visible.

## Mapas

| Recurso | Uso | Licencia / condiciones | Atribución |
|---|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright) — teselas `tile.openstreetmap.org` | Mapa 2D de clientes (formulario, detalle) y vista alternativa de Atlas | Datos © colaboradores de OpenStreetMap, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/). Uso de teselas sujeto a la [política de uso](https://operations.osmfoundation.org/policies/tiles/): atribución visible, sin descargas masivas ni *prefetch* agresivo | Control de atribución de Leaflet en cada mapa |
| [Leaflet](https://leafletjs.com) | Motor de mapas 2D | BSD-2-Clause | Prefijo del control de atribución |

La URL de teselas es configurable (`VITE_MAP_TILE_URL`, `VITE_MAP_TILE_ATTRIBUTION`) para cambiar de
proveedor o autoalojarlas sin tocar código.

## Datos demo

Los clientes, NIT/CI, nombres y direcciones de los datos demo son **ficticios**. Las coordenadas son
centros aproximados de barrios y ciudades reales (con un desplazamiento aleatorio), tomados de mapas
de OpenStreetMap.
