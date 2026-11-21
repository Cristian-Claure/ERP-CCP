# ADR 0004 — Ledger de inventario, costeo promedio y concurrencia

- **Estado:** Aceptado
- **Fecha:** 2026-11-22
- **Fase:** 1 (inventario)

## Contexto

El inventario es la base de ventas, compras, costos y pronósticos. Necesita ser **auditable** (saber
por qué hay N unidades), **correcto bajo concurrencia** (dos cajas vendiendo el último producto) y
**valorizado** con un método aceptado en Bolivia (costo promedio ponderado).

## Decisión

### 1. Ledger append-only y saldos derivados

- `stock_movements` es inmutable (sin `UPDATE` ni `DELETE`): por definición, el stock de un producto en un
  almacén es `SUM(quantity)` de sus movimientos.
- Cada movimiento guarda el saldo resultante (`quantity_after`, `avg_cost_after`, `value_after`).
  Con eso el kardex es una lectura directa y verificable.
- `stock_balances` es una **caché materializada** (producto × almacén), escrita solo por el motor
  dentro de la transacción del documento. `inventory:verify` comprueba las invariantes y
  `--repair` reconstruye los saldos desde el ledger.

### 2. Documentos

- Ciclo de vida `draft → posted → voided`. Tipos: entrada, salida, transferencia y ajuste por conteo.
- Los **borradores** no afectan stock ni tienen número; se pueden editar o eliminar (eliminarlos
  queda auditado).
- **Confirmar** (posting) crea los movimientos y asigna el número. **Anular** crea los movimientos
  inversos: nunca se borra un documento confirmado.
- Se guarda quién creó, confirmó y anuló cada documento, cuándo, y el motivo de anulación
  (obligatorio). Toda confirmación, anulación y eliminación de borrador queda en `audit_logs`.

### 3. Precisión

| Dato | Tipo |
|---|---|
| Cantidades | `NUMERIC(14,4)` (unidades fraccionables: kg, litros, metros) |
| Costo unitario y costo promedio | `NUMERIC(14,4)` |
| Valores de inventario (`total_cost`, `value_after`, `total_value`) | `NUMERIC(16,4)`: precisión interna de costeo |

Esto es una **excepción explícita** a la regla general de dinero en `NUMERIC(14,2)`: guardar la
valorización redondeada a 2 decimales acumularía error en el promedio. La UI y los reportes redondean
a 2. Toda la aritmética usa `BcMath\Number` (decimal exacto, sin floats).

### 4. Costo promedio ponderado (por producto **y** almacén)

- **Entrada** (y transferencia recibida o ajuste positivo): `valor += q × c`, `promedio = valor / cantidad`.
- **Salida** (y transferencia enviada o ajuste negativo): sale al promedio vigente. Si deja la
  cantidad en 0, se lleva todo el valor restante, lo que absorbe el redondeo.
- **Transferencia:** sale del origen a su promedio y entra al destino con **ese mismo costo**, en
  una sola transacción.
- **Ajuste por conteo:** el usuario registra la cantidad contada; la diferencia se calcula **contra el
  saldo al momento de confirmar**. Un sobrante entra al promedio vigente; si el producto nunca tuvo
  costo, se exige costo unitario. El motivo sale del catálogo (merma, vencimiento, daño, error de
  registro, otro) y "otro" exige nota.
- **Anulación:** revierte cada movimiento a su **costo original**.

### 5. Invariante de valorización

En todo saldo se cumple `total_value >= 0` y `avg_cost >= 0`. Hay un `CHECK` en la base de datos y lo
verifican el motor, `inventory:verify` y el test de secuencias aleatorias.

Revertir una entrada a su costo original puede violar la invariante cuando ese stock ya se consumió a
otro promedio. Ejemplo: entrada 10 @ 10, entrada 10 @ 30, salida 9 y luego anular la segunda entrada:
quedaría cantidad 1 con valor −80. Esa anulación se **rechaza** con 422 `void_cost_inconsistency` y un
mensaje que sugiere registrar un ajuste. Por la misma regla, también se rechaza si la cantidad queda
en 0 con un valor residual mayor a 0,01.

### 6. Stock negativo

`companies.allow_negative_stock` vale `false` por defecto. Si no está permitido:

- toda salida, transferencia, ajuste negativo o anulación que lo provoque falla con 422
  `insufficient_stock`;
- la respuesta lista **todas** las líneas afectadas con producto, almacén, disponible y solicitado.

Si está permitido, mientras la cantidad sea ≤ 0 el valor queda en 0, y la siguiente entrada cubre el
déficit a su propio costo.

### 7. Orden temporal y fechas

- El orden del kardex (y del promedio) es el **orden de confirmación** (`occurred_at`). No hay recálculo
  retroactivo.
- `document_date` es la fecha comercial: no puede ser futura ni anterior a
  `companies.document_backdate_days` (30 por defecto), que es la base del cierre de períodos de la fase
  contable. Se valida al guardar y otra vez al confirmar.
- El kardex muestra ambas fechas.

### 8. Concurrencia e idempotencia

- Todo ocurre en **una transacción**:
  1. se bloquea el documento (`SELECT … FOR UPDATE`);
  2. se bloquean los saldos afectados **en orden fijo (warehouse_id, product_id)**, así dos
     confirmaciones no pueden quedar en deadlock; las filas que faltan se crean con
     `INSERT … ON CONFLICT DO NOTHING`;
  3. se calculan y escriben los movimientos;
  4. se toma el número.
- **Idempotencia:**
  - confirmar o anular un documento ya confirmado o anulado devuelve el mismo resultado;
  - un índice único `(document_line_id, kind, reverses_movement_id) NULLS NOT DISTINCT` impide duplicar
    movimientos aunque fallara la lógica;
  - `POST /documents` acepta `Idempotency-Key` para no duplicar borradores por doble clic.
- **Numeración sin huecos:** la tabla `document_sequences` se bloquea por empresa y tipo dentro de la
  misma transacción. Un rollback (por ejemplo, stock insuficiente) no consume número. Formatos:
  ENT-000001, SAL-, TRF-, AJU-.
- **Prueba:** un test lanza dos procesos PHP reales que confirman a la vez dos salidas cuya suma supera
  el saldo; uno confirma y el otro recibe `insufficient_stock`.

## Consecuencias

- Trazabilidad completa y kardex instantáneo.
- Corregir un error siempre deja rastro: se anula y se vuelve a registrar.
- Algunas anulaciones se rechazan por consistencia de costos y el usuario debe ajustar. Es
  intencional.
- Sin recálculo retroactivo, un documento con fecha pasada no reescribe el costo de lo ya vendido.
  El cierre de períodos lo acotará.
- Los bloqueos por saldo serializan solo las operaciones sobre el mismo producto y almacén.

## Alternativas descartadas

- **Saldos editables sin ledger:** no auditable.
- **PEPS (FIFO):** más complejo (capas de costo); queda para un futuro si un cliente lo exige.
- **Bloqueo optimista con reintentos:** con alta contención en productos de alta rotación genera
  más fallos visibles. El bloqueo pesimista ordenado es más simple y predecible.
- **Numeración con secuencias de PostgreSQL:** rápidas, pero dejan huecos en los rollbacks.
