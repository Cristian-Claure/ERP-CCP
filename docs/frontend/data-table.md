# DataTable

Tabla reutilizable para **todos** los listados de CCP (`apps/web/src/components/data-table`). Está
construida sobre TanStack Table **v9** en modo manual: la paginación, el orden y los filtros los
resuelve el **servidor**, y el estado vive en la **URL**, así que un listado filtrado se puede
compartir con un enlace y el botón "atrás" funciona.

## Contrato con la API

Todos los endpoints de listado (Laravel + `spatie/laravel-query-builder`) aceptan:

```
GET /api/v1/<recurso>?page=2&per_page=25&sort=-created_at&filter[search]=arroz&filter[status]=posted
```

y responden con la colección paginada estándar de Laravel:

```json
{ "data": [ … ], "meta": { "current_page": 2, "last_page": 7, "per_page": 25, "total": 160, "from": 26, "to": 50 } }
```

- `sort`: nombre permitido en `allowedSorts`; el prefijo `-` indica descendente.
- `filter[x]`: filtros permitidos en `allowedFilters`. `search` es la convención para el buscador
  libre. Si un filtro tiene varios valores, van separados por coma.
- `per_page`: máximo 100 (`PaginatesRequests::perPage()`).

## Uso

```tsx
import {
  DataTable, DataTableColumnHeader, DataTableFilter, DataTableToolbar,
  dataTableColumns, useDataTableState,
} from '@/components/data-table'

// 1. Columnas a nivel de módulo (estables entre renders).
const col = dataTableColumns<Product>()
const columns = [
  col.accessor('sku', {
    id: 'sku',                                   // = nombre de orden en la API
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    meta: { label: 'Código' },                   // texto del selector de columnas
    enableHiding: false,                         // siempre visible
  }),
  col.display({
    id: 'stock',                                 // ordenable aunque sea "display"
    enableSorting: true,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Stock" />,
    cell: ({ row }) => formatQty(row.original.stock?.quantity),
    meta: { label: 'Stock', align: 'right' },
  }),
]

// 2. Estado en la URL → parámetros de la API → TanStack Query.
export function ProductsPage() {
  const state = useDataTableState({ defaultSort: 'name' })
  const { data, isPending, isFetching } = useProducts(state.params) // queryKey incluye params

  return (
    <DataTable
      id="inventory-products"            // persiste las columnas visibles (localStorage)
      columns={columns}
      data={data?.data}
      meta={data?.meta}
      state={state}
      isLoading={isPending}               // skeleton
      isFetching={isFetching}             // atenuado mientras recarga (keepPreviousData)
      defaultHidden={['unit']}
      onRowClick={(p) => navigate(`/inventario/productos/${p.id}`)}
      toolbar={(table) => (
        <DataTableToolbar table={table} state={state} searchPlaceholder="Buscar…" actions={<Button>Nuevo</Button>}>
          <DataTableFilter state={state} name="category_id" title="Categoría" options={…} />
        </DataTableToolbar>
      )}
      empty={<EmptyState … />}            // opcional: estado vacío propio
    />
  )
}
```

## Piezas

| Componente o hook | Responsabilidad |
|---|---|
| `useDataTableState(opts)` | Lee y escribe `page`, `per_page`, `sort`, `q` y `f_<filtro>` en la URL. Expone `params`, listo para la API. Cambiar el orden, un filtro o la búsqueda vuelve a la página 1. `prefix` permite tener dos tablas en la misma página. |
| `DataTable` | Render: cabeceras, filas, skeleton, vacío y paginación. Visibilidad de columnas persistida por `id`. |
| `DataTableColumnHeader` | Cabecera clicable que alterna el orden ascendente y descendente en el servidor. |
| `DataTableToolbar` | Búsqueda con debounce (350 ms), los filtros que recibe como `children`, "Limpiar", selector de columnas y `actions`. |
| `DataTableFilter` | Filtro con popover y lista buscable. Selección simple, o múltiple con `multiple`. |
| `DataTablePagination` | Resumen "26–50 de 160", filas por página y navegación. |

## Reglas

- Define `columns` **fuera** del componente o memoízalo. Un array nuevo en cada render reinicia los
  modelos de la tabla.
- El `id` de cada columna ordenable debe coincidir con el nombre permitido en `allowedSorts` del
  backend.
- Incluye siempre `state.params` en la `queryKey` y usa `placeholderData: keepPreviousData` para
  que la tabla no parpadee al paginar.
- Los valores decimales llegan como string: usa `formatQty`, `formatCost` o `formatCurrency`.
- En TanStack v9 cada feature se registra explícitamente: `dataTableFeatures` incluye orden, visibilidad
  y paginación. Si agregas otra (por ejemplo, selección de filas), regístrala ahí.
