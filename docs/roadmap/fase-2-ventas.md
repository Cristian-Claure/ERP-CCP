# Fase 2 — Ventas (propuesta original)

> **Estado: implementada** en `feat/fase-2-ventas` (PR #3). Las decisiones abiertas se resolvieron así:
> SAL- visible enlazado en ambos sentidos; bajo costo/mínimo bloqueado salvo permiso + motivo; factura y
> nota de venta como tipos del mismo documento; POS como parte aparte. **Corrección fiscal:** los precios
> incluyen IVA (se desglosa, no se suma) y el IT no va en el documento. Ver
> [ADR 0005](../adr/0005-ventas-impuestos-y-cuentas-por-cobrar.md). Este documento queda como registro.

- **Estado original:** propuesta, pendiente de aprobación.
- **Fecha:** 2026-11-22
- **Depende de:** Fase 1 (inventario) mergeada en `main`.
- **Rama sugerida:** `feat/fase-2-ventas`

> Antes de implementar: presentar el plan detallado (migraciones, endpoints y pantallas) y esperar
> confirmación, igual que en las fases anteriores (ver CLAUDE.md).

## Objetivo

Vender con integridad de stock y de saldos: cada venta confirmada descuenta inventario en la misma
transacción, deja su costo y margen, y genera la cuenta por cobrar cuando es a crédito.

## Alcance propuesto

### 1. Clientes
- Datos: NIT o CI, razón social, contacto, condiciones de crédito (días) y límite de crédito.
- Listado con `DataTable` (búsqueda, filtros, orden en el servidor) y formulario.
- `company_id` y `BelongsToCompany`, como todo modelo de negocio.

### 2. Documentos comerciales
- **Cotización** (COT-) → **Venta** (VTA-), que puede ser nota de venta o factura.
- Ciclo de vida `draft → posted → voided`. Lo confirmado nunca se edita ni se borra; se anula con
  motivo obligatorio.
- Numeración sin huecos con `DocumentNumberer` (Shared) dentro de la transacción.
- Importes en `NUMERIC(14,2)`; descuentos por línea y global.
- Todo posting y anulación en `audit_logs`; posting idempotente (mismo patrón que inventario).
- La fecha comercial respeta `companies.document_backdate_days`.

### 3. Integración con inventario (dominio)
- Confirmar una venta genera, **en la misma transacción**, una salida de inventario usando las
  Actions públicas de `Domain/Inventory` (sin tocar sus servicios internos; ver ADR 0003).
- Anular la venta anula también su salida (inverso al costo original). Si eso no es posible, por
  ejemplo por `void_cost_inconsistency`, se rechaza la anulación completa.
- El costo de venta sale del costo promedio al confirmar. Se guarda el **margen por línea**.
- Una venta sin stock suficiente se rechaza con el 422 `insufficient_stock` existente, salvo que la
  empresa permita stock negativo.
- Decisión a confirmar: ¿la salida se crea como documento de inventario visible (SAL- vinculado a la
  venta) o como movimientos con referencia directa a la venta? La propuesta es lo primero, por
  trazabilidad en el kardex.

### 4. Precios
- Lista de precios por producto: precio base y precio mínimo. Más adelante, listas por cliente o
  canal.
- Alerta (o bloqueo configurable) al vender por debajo del costo promedio o del precio mínimo.

### 5. Cobros y cuentas por cobrar
- Ventas al contado o a crédito.
- **Cuenta por cobrar como ledger** de cargos (ventas) y abonos (cobros, anulaciones), por cliente.
  Es la base de la Fase de Finanzas.
- Control del límite de crédito al confirmar una venta a crédito.
- Registro de cobros parciales y totales con su numeración (COB-).

### 6. Impuestos
- IVA 13 % e IT 3 % calculados y **guardados** en cada documento (no se recalculan después).
- La facturación electrónica SIAT queda **fuera de alcance**; será una fase propia.

### 7. Frontend
- **POS rápido** para mostrador: búsqueda por código o código de barras, cliente genérico, cobro al
  contado.
- **Formulario completo** para ventas a crédito, con líneas dinámicas (mismo patrón que los
  documentos de inventario), stock disponible y precio sugerido.
- Listados de clientes, cotizaciones, ventas y cobros con `DataTable`.
- Dashboard: "Ventas del mes" y "Cuentas por cobrar" pasan de demo a datos reales; se agrega un
  gráfico de ventas real.

### 8. Permisos (por acción)
`sales.view`, `customers.manage`, `sales.create`, `sales.post`, `sales.void`, `payments.create`,
`payments.void`. Asignación coherente a los roles demo: el vendedor crea y confirma, y el gerente
anula.

### 9. Datos demo
Clientes realistas de Santa Cruz y ventas coherentes con el historial de inventario ya sembrado. Una
opción es convertir parte de las salidas demo en ventas.

## Tests obligatorios propuestos
- La venta y su salida de inventario son atómicas: si falla una, no queda nada.
- Una venta sin stock se rechaza (422 con detalle por línea).
- La anulación en cascada (venta → salida) usa el costo original, y se rechaza entera si la salida no
  puede anularse.
- Numeración sin huecos e idempotencia del posting de ventas y cobros.
- Concurrencia: dos ventas simultáneas sobre el mismo producto no generan stock negativo.
- Invariante de cuentas por cobrar: saldo del cliente = suma de su ledger.
- El límite de crédito se respeta bajo concurrencia.

## Decisiones abiertas para la próxima sesión
1. ¿Venta → documento SAL- visible, o movimientos referenciados directamente a la venta?
2. ¿Bloquear o solo advertir al vender bajo el costo o el precio mínimo?
3. ¿Factura y nota de venta como tipos del mismo documento o como documentos separados?
4. ¿El POS entra en esta fase o en una subfase 2b?
