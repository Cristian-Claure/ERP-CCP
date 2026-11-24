# ADR 0006 — Compras, costo de entrada (preliminar) y cuentas por pagar

- **Estado:** Aceptado. La lógica fiscal es **preliminar** y debe validarla un contador (ver «Validación pendiente»).
- **Fecha:** 2026-11-26
- **Fase:** 3 (compras)

## Contexto

Comprar afecta a la vez el stock, su costo promedio (ADR 0004) y la deuda con el proveedor. Una recepción a
medias, por ejemplo con stock ingresado pero sin cuenta por pagar o con un costo mal calculado, contamina el
margen de todas las ventas posteriores. En Bolivia, además, el IVA de las compras con factura es **crédito
fiscal** y no forma parte del costo del inventario. Con los proveedores informales o del exterior no existe
ese crédito local.

## Decisión

### 1. Documentos y estados

| Documento | Numeración | Estados |
|---|---|---|
| Orden de compra | `OC-` (se asigna al **aprobar**) | `draft → approved → partially_received → received`, o `cancelled` |
| Recepción | `REC-` | `posted → voided` (se confirma al crearse; no hay borrador) |
| Pago a proveedor | `PAG-` | `posted → voided` |

- Nada se borra. La OC solo se cancela si no tiene recepciones confirmadas; si las tiene, primero se anulan.
- `purchase_order_lines.received_quantity` es una caché derivada de las recepciones confirmadas y la
  verifica `suppliers:verify`.

### 2. La recepción también es la factura del proveedor (beta)

En esta fase, cada recepción registra el número y la fecha de la factura del proveedor:

- `supplier_invoice_number` es **único por (empresa, proveedor)** mientras la recepción no esté anulada
  (índice parcial). Un duplicado devuelve 422 `duplicate_supplier_invoice`.
- `supplier_invoice_date` no puede ser futura.
- El vencimiento de la deuda es la fecha de la factura (o, si no la hay, la de la recepción) más
  `suppliers.payment_terms_days`.

**Evolución futura:** un documento de factura separado de la recepción, para cubrir dos casos que el modelo
actual no resuelve:

- una factura que agrupa varias recepciones;
- una factura que llega después de la mercadería.

La cuenta por pagar nacería entonces de la factura, y la recepción quedaría como un hecho físico valorizado
provisionalmente, con un ajuste de costo al llegar la factura.

### 3. Costo de entrada (`PurchaseCostCalculator`)

1. `line_total = round(cantidad × precio facturado, 2)`.
2. **Proveedor con factura** (`issues_invoice = true`): el IVA se calcula **por dentro**, igual que en ventas:
   - `IVA = round(total × 0,13)`; nunca `total ÷ 1,13`.
   - Se prorratea por línea con residuo a la última (`Shared\Support\Vat`, el mismo cálculo de
     `SalesCalculator`).
   - Ese IVA es **crédito fiscal** (`purchase_receipts.vat_credit`) y el costo de la línea es el **neto**
     (`total × 0,87` salvo redondeo).
3. **Proveedor sin factura**: no hay crédito fiscal y el costo es el **total pagado**.
4. **Gastos adicionales** de la recepción (flete, descarga, otros):
   - Se prorratean sobre los netos **por valor**, con `Decimal::prorate` y el residuo en la última línea, así
     que la suma de las participaciones es exactamente el gasto.
   - El monto que se ingresa es el que va al costo; si el transportista factura, el usuario ingresa el neto.
   - Los gastos **no** generan cuenta por pagar al proveedor de la mercadería. Su pago se registrará en caja y
     bancos en la Fase 4.
5. `cost_total = neto + gasto prorrateado`; `unit_cost = cost_total ÷ cantidad`, con 4 decimales (ADR 0004).
   La ENT- valoriza `cantidad × unit_cost`, así que puede diferir del `cost_total` en fracciones de 0,0001
   por línea. Es una diferencia conocida y aceptada.

**Ejemplo verificado** (`tests/Unit/Purchases/PurchaseCostCalculatorTest.php`):

- Líneas de 113,00 + 21,00 + 10,01 = 144,01. IVA = 18,72, prorrateado como 14,69 / 2,73 / 1,30.
- Netos 98,31 / 18,27 / 8,71.
- Flete + descarga de 60,00, prorrateado como 47,08 / 8,75 / 4,17.
- Costos unitarios 14,5390 / 9,0067 / 1,8400.

**Importaciones:** el IVA de importación se paga en aduana (DUI) y es crédito fiscal por esa vía. Queda fuera
de alcance: los proveedores del exterior se modelan como «sin factura» y el despacho aduanero entra como gasto
adicional.

### 4. Diferencias de precio

- Se mide `|precio facturado − precio de la OC| ÷ precio de la OC` por línea.
- Si supera `companies.purchase_price_variance_pct` (por defecto 2 %), la línea queda marcada
  (`price_variance_flag`) y la recepción exige `price_variance_reason`; sin motivo devuelve 422
  `price_variance_reason_required`. El motivo y las líneas quedan en la auditoría.

### 5. Recepciones parciales y tolerancia

- `recibido + cantidad ≤ pedido × (1 + companies.purchase_receipt_tolerance_pct)`. Por defecto la tolerancia
  es 0 %. Si se excede, 422 `over_receipt` con el detalle por línea.
- Cada recepción crea su **ENT-** solo a través de `SaveInventoryDocumentDraft` + `PostInventoryDocument`, con
  `source = purchase_receipt`.

### 6. Anulación de una recepción

- Si la recepción tiene pagos aplicados: 422 `receipt_has_payments`; primero se anulan los pagos.
- La ENT- se anula con `VoidInventoryDocument` al costo original. Si el stock ya se consumió
  (`insufficient_stock`) o la valorización quedaría negativa (`void_cost_inconsistency`), **se aborta toda
  la anulación** (`ReceiptInventoryException`, que conserva el código) y nada cambia.
- Después se revierten la cuenta por pagar y el avance de la OC.

### 7. Aprobación y segregación de funciones

- OC con total ≤ `companies.purchase_approval_threshold` (por defecto Bs 5.000): basta `purchases.create`.
- OC por encima del umbral:
  - requiere `purchases.approve`;
  - **no puede aprobarla quien la creó**, aunque tenga el permiso: 422 `self_approval_not_allowed`;
  - el intento bloqueado se audita (`purchases.order.self_approval_blocked`) **fuera** de la transacción
    revertida, para que el registro no se pierda.

### 8. Cuentas por pagar (espejo de las cuentas por cobrar)

- `supplier_ledger_entries` es inmutable (`charge` +, `payment` −, `reversal`) y solo lo escribe
  `SupplierLedger`.
- `suppliers.balance` y `purchase_receipts.paid_amount` son cachés; `suppliers:verify [--repair]` también
  revisa `received_quantity`.
- Los pagos (PAG-) se aplican a recepciones explícitas o FIFO por vencimiento y no pueden superar la deuda,
  porque todavía no hay anticipos ni cuentas de caja (Fase 4).
- La antigüedad usa los mismos tramos que cuentas por cobrar.

### 9. Orden de bloqueos

**proveedor → OC → recepción(es) → saldos de stock**, en `PostPurchaseReceipt`, `VoidPurchaseReceipt` y los
pagos. Dos recepciones simultáneas de la misma OC se serializan en el bloqueo de la OC, y la segunda ve lo que
recibió la primera (`tests/Concurrency/ConcurrentReceiptTest.php`).

### 10. Sugerencia de compra

- `PurchaseSuggestionProvider` (interfaz) está ligada a `MinStockVelocitySuggester`, que calcula:
  `sugerido = mínimo + venta diaria (30 días, por almacén) × plazo del último proveedor − stock − pendiente en OC`.
- El plazo es de 7 días si el producto no tiene proveedor previo. Las unidades enteras se redondean hacia
  arriba.
- Desde la sugerencia se crea una OC **borrador**.
- En la Fase 5 se cambia el binding por un proveedor respaldado en el pronóstico de IA, sin tocar a quienes
  lo usan.

## Permisos

| Permiso | Admin | Gerente | Almacenero | Vendedor |
|---|:-:|:-:|:-:|:-:|
| `suppliers.view` / `suppliers.manage` | ✓/✓ | ✓/✓ | ✓/— | — |
| `purchases.view` / `create` / `approve` | ✓ | ✓ | ✓/—/— | — |
| `purchases.receive` | ✓ | ✓ | ✓ | — |
| `purchases.void` | ✓ | ✓ | — | — |
| `payables.view` / `payables.pay` | ✓ | ✓ | — | — |

El almacenero recibe; el gerente aprueba, anula y paga. Los saldos y la antigüedad solo se exponen con
`payables.view`.

## Consecuencias

- El costo promedio refleja el costo real puesto en almacén (neto + gastos) y el IVA no infla el margen.
- La OC y la recepción quedan trazables hasta la ENT- y la cuenta por pagar.
- Sin documento de factura separado, una factura que cubre varias recepciones debe registrarse en una de
  ellas o dividirse (limitación de la beta).

## Validación pendiente (con un contador)

1. Que el crédito fiscal de las compras con factura se calcule por dentro, `total × 0,13`, igual que el débito.
2. El tratamiento de los gastos con factura del transportista: si el neto va al costo y el IVA a crédito.
3. Las importaciones: el crédito fiscal vía DUI y si los aranceles y el despacho van al costo.
4. Las compras sin factura: si corresponde alguna retención (RC-IVA / IUE) que hoy no se modela.
