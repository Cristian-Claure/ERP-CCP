# Fase 2b — POS (punto de venta de mostrador)

- **Estado:** planificado, no iniciado. No hubo margen en la sesión de la Fase 2; lo ya construido
  (motor de ventas, cliente genérico S/N, cobro automático) cubre todo el backend necesario.
- **Rama sugerida:** `feat/pos` (desde `main`, con los PR #3 y #4 mergeados).

## Objetivo

Una pantalla `/pos` para vender en mostrador en segundos, optimizada para teclado, lector de código de
barras y pantalla táctil, que confirma ventas con **el mismo motor** (`PostSalesDocument`): stock, SAL-,
cobro automático, numeración y auditoría idénticos a una venta normal.

## Backend (mínimo)

1. **Sin Actions nuevas.** El POS crea un borrador y lo confirma con las Actions existentes. Opcional: un
   endpoint `POST /api/v1/pos/sales` que haga `SaveSalesDraft` + `PostSalesDocument` en una sola petición
   (y una sola transacción externa), con `Idempotency-Key` obligatoria.
2. **Búsqueda rápida:** `GET /api/v1/inventory/products?filter[barcode]=` exacto, más `filter[search]`, ya
   existentes. Agregar un índice `(company_id, barcode)` y un filtro `filter[category_id]`.
3. **Cliente por defecto:** `companies.default_customer_id`, que ya existe y que el seed llena con
   «Sin nombre / S/N». Es configurable en Configuración → Ventas.
4. **Almacén del puesto:** preferencia por usuario (`users.pos_warehouse_id`) o selección al abrir el POS.
5. **Permiso:** `sales.pos`, o reutilizar `sales.create` + `sales.post`. El vendedor ya tiene ambos.

## Frontend

| Zona | Contenido |
|---|---|
| Izquierda | Grilla de productos por categoría (pestañas) con precio y stock del almacén; búsqueda por código de barras/SKU/nombre siempre enfocada |
| Derecha | Carrito: cantidad ±, precio, descuento por línea (solo con permiso), total con IVA desglosado (`calc.ts`), cliente (S/N por defecto, cambiable con F3) |
| Cobro | Diálogo: método (efectivo/QR/tarjeta), **monto recibido → cambio**, confirmar |
| Ticket | Vista imprimible de 80 mm (`@page { size: 80mm auto }`) reutilizando el formato de `SalesPrintPage` |

**Atajos:**

| Tecla | Acción |
|---|---|
| F2 | Buscar |
| F3 | Cliente |
| F4 | Cobrar |
| +/− | Cantidad de la línea seleccionada |
| Supr | Quitar línea |
| Esc | Cancelar |
| Ctrl+Enter | Confirmar el cobro |

**Lector de código de barras:** entrada rápida terminada en Enter, detectada por el intervalo entre
teclas. Si el código coincide con un producto, se agrega con cantidad 1; si el producto ya está en el
carrito, suma una unidad.

**Errores del motor:**
- `insufficient_stock`: se marca la línea.
- `price_below_cost`: se usa el diálogo de autorización existente.

**Offline:** fuera de alcance. Requiere numeración y control de stock en el servidor.

## Tests

- **Pest:** el endpoint POS es atómico, la venta sin stock no consume número y la idempotencia funciona
  ante un doble Enter.
- **Vitest:** cálculo de cambio, carrito (sumar/quitar/cantidades fraccionarias) y parser del lector.
- **E2E (Playwright):** escanear 3 códigos, cobrar en efectivo con cambio, verificar el ticket y la venta
  NV-/VTA- con su SAL-.

## Estimación

≈ 1 sesión. Backend ½ día, frontend 1 día y tests ½ día.
