# ADR 0005 — Ventas, impuestos (preliminar) y cuentas por cobrar

- **Estado:** Aceptado (la lógica fiscal es **preliminar**: ver "Validación pendiente")
- **Fecha:** 2026-11-23
- **Fase:** 2 (ventas)

## Contexto

Vender toca tres registros a la vez: el stock (ADR 0004), el saldo del cliente y los impuestos. Una venta
a medias (stock descontado sin cuenta por cobrar, o al revés) es el peor error posible de un ERP. Además,
el sistema apunta a pymes bolivianas, cuyo tratamiento fiscal tiene particularidades: precios con IVA
incluido, IT sobre ingresos brutos y facturación electrónica SIAT.

## Decisión

### 1. Un solo documento comercial con tipo

- `sales_documents` con `type`: `quote` (COT-), `invoice` (VTA-) y `sales_note` (NV-). La factura y la nota
  de venta son el mismo documento con distinta naturaleza fiscal. La cotización no afecta stock ni saldos.
- El ciclo de vida es `draft → posted → voided`, igual que en inventario. Lo confirmado nunca se edita ni se
  borra, y la numeración sin huecos usa `DocumentNumberer` dentro de la transacción.
- La conversión de una cotización copia sus líneas, precios y descuentos a un **borrador** de venta con
  `quote_id`. Solo procede si la cotización está confirmada y vigente (`valid_until` ≥ hoy), y una vez por
  cotización, salvo que esa venta se anule.

### 2. Integración con inventario a través de su API pública

- Confirmar una venta crea y confirma un **SAL-** con `SaveInventoryDocumentDraft` +
  `PostInventoryDocument`, en la misma transacción. Sus servicios internos (`StockLedger`, la calculadora)
  no se tocan.
- El enlace funciona en ambos sentidos: `sales_documents.inventory_document_id` e
  `inventory_documents.source_type/source_id` (`DocumentData::$source`).
- El costo de cada línea sale del costo promedio que **realmente** usó el SAL-. Anular la venta anula el
  SAL- al costo original. Revertir una salida equivale a una entrada al costo original, así que no puede
  romper el invariante de valorización. Aun así, cualquier error de inventario aborta la anulación entera
  y conserva su código (`LinkedInventoryException`).

### 3. Orden de pasos y de bloqueos

`PostSalesDocument`, en una sola transacción:

1. Bloqueo del **cliente**, después del **documento** (`lockForUpdate`).
2. Validación y recálculo autoritativo de importes.
3. **Crédito** (solo ventas a crédito): `saldo + total ≤ límite`. Va antes del SAL- porque el total ya se
   conoce. Si se excede, responde 422 `credit_limit_exceeded`, salvo *override*.
4. Número de venta.
5. SAL-: bloquea los saldos de stock en orden (almacén, producto). Responde 422 `insufficient_stock`.
6. Costo y margen por línea.
7. **Precios**: neto de la línea < costo, o total de la línea < `min_price × cantidad`, responde 422
   `price_below_cost`. Va después del SAL- porque necesita el costo real. Los detalles no exponen el costo.
8. Cargo en el ledger del cliente y, si es al contado, cobro automático en la misma transacción.
9. Auditoría y evento `SalesDocumentPosted` (*after commit*).

**Todas** las escrituras de ventas y cobros toman primero el bloqueo del cliente. Así se serializa el
trabajo sobre un mismo cliente sin deadlocks entre ventas, cobros y anulaciones. El test de concurrencia
lanza dos procesos reales con dos ventas a crédito simultáneas.

### 4. Excepciones autorizadas

- La venta bajo costo o bajo el precio mínimo pasa solo con `sales.authorize_below_cost` y un motivo
  (≥ 5 caracteres).
- El exceso de límite de crédito pasa solo con `sales.override_credit_limit` y un motivo.
- Quién autorizó, cuándo y por qué queda en el documento (`below_cost_authorized_*`, `credit_override_*`)
  y en `audit_logs`. Un motivo enviado sin el permiso responde 403.
- Costos y márgenes solo se muestran con `sales.view_margin`: los Resources omiten esos campos.

### 5. Cuentas por cobrar como ledger

- `customer_ledger_entries` es inmutable: `charge` (+), `payment` (−) y `reversal` (signo opuesto al
  original). `customers.balance` es una **caché** de `SUM(amount)` y cada asiento guarda su
  `balance_after`. Un índice único `(source_type, source_id, kind)` funciona como red de idempotencia.
- Cobros (`customer_payments`, COB-) con imputación explícita o FIFO por vencimiento
  (`payment_allocations`). `sales_documents.paid_amount` es una caché de las imputaciones de cobros vigentes.
  En esta fase no hay anticipos: un cobro no puede superar la deuda abierta.
- El cobro automático de una venta al contado se anula junto con ella. Una venta con cobros **manuales**
  aplicados no se anula hasta revertirlos (422 `sale_has_payments`).
- Antigüedad por días vencidos: por vencer, 0–30, 31–60, 61–90 y +90.
- `customers:verify [--repair]` comprueba saldo = ledger, saldo acumulado y `paid_amount` = imputaciones,
  y que no falten cargos ni reversiones. Solo repara las cachés: el ledger no se toca.

### 6. Impuestos (Bolivia) — PRELIMINAR

- **Los precios de venta incluyen IVA.** El IVA (13 %) se **desglosa**, no se suma:
  `iva = round(total × 0,13; 2)`, `neto = total − iva`.
- El IVA del documento se redondea **una sola vez** y se reparte entre las líneas con el mismo prorrateo
  del descuento global (residuo a la última línea). Así, Σ IVA de las líneas = IVA del documento.
- El **descuento global** se prorratea entre las líneas según su importe después del descuento de línea, y
  el residuo de redondeo va a la última línea. El margen por línea queda exacto y suma el del documento.
- **Margen** = neto − costo promedio de salida. Los costos se manejan sin IVA, porque el crédito fiscal de
  compras no forma parte del costo.
- **Nota de venta**: desglosa el IVA solo si la empresa lo habilita (`companies.sales_note_vat_breakdown`).
  Si no, `iva = 0` y `neto = total`.
- **IT (3 %)**: no va en el documento ni se cobra al cliente. Es un impuesto de la empresa sobre sus
  ingresos brutos y se estimará en los reportes de Finanzas.
- La tasa vive en `SalesCalculator::VAT_RATE` y cada documento **guarda** sus importes: un cambio de tasa
  no altera documentos pasados.

### Validación pendiente

Esta lógica fiscal es una **primera aproximación técnica** y debe **validarla un contador** antes de la
fase de facturación electrónica SIAT. Puntos a revisar: redondeo por documento o por línea, tratamiento
de la nota de venta, base del IT, descuentos y bonificaciones, ventas exentas o tasa cero, y el formato
del NIT o CI de cliente que exige el SIAT.

## Consecuencias

- Una venta es atómica: stock, cuenta por cobrar, numeración y auditoría se confirman juntos o no se
  confirma nada. Si falla por falta de stock, no se consume número.
- Ventas sobre un mismo cliente se serializan. Para una pyme es aceptable, y la contención real se da
  sobre el stock más que sobre el cliente.
- La numeración de ventas toma su secuencia antes del SAL-, por lo que las ventas de una empresa se
  serializan en ese tramo. Es aceptable a esta escala; si hiciera falta más rendimiento, se numeraría al
  final.
- Inventario sigue sin conocer a Ventas: solo guarda un `source` polimórfico opaco.
