import { expect, test } from '@playwright/test'

import { expectToast, pickFromCombobox, pickFromSelect } from '../support/ui'

/**
 * Purchases: OC (below the approval threshold) -> approval -> PARTIAL receipt
 * with supplier invoice and freight -> ENT- -> pending quantities -> payment.
 * 4 × 11.30 = 45.20 → VAT credit 5.88 (por dentro) → net 39.32 + freight 10.00 = 49.32.
 */
test('compras: OC, aprobación, recepción parcial con flete, pago', async ({ page }) => {
  const invoice = `E2E-${Date.now()}`

  await page.goto('/compras/ordenes/nueva')
  await pickFromCombobox(page, 'Buscar proveedor…', 'Proveedor E2E', /Proveedor E2E SRL/)
  await pickFromSelect(page, 'Seleccionar', 'Central Santa Cruz')
  await pickFromCombobox(page, 'Buscar producto…', 'E2E-001', /E2E-001/)
  await page.getByLabel('Cantidad 1').fill('10')
  await page.getByLabel('Precio 1').fill('11,30')
  await expect(page.getByText('113,00').first()).toBeVisible()

  await page.getByRole('button', { name: 'Aprobar' }).click()
  await expectToast(page, /aprobada/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^OC-\d+/)
  const orderNumber = (await page.getByRole('heading', { level: 1 }).textContent())!.trim()

  // Wait for the form's own data before typing.
  const settled = page.waitForResponse((r) => r.url().includes('/api/v1/settings/purchases'))
  await page.getByRole('link', { name: 'Recibir mercadería' }).click()
  await settled
  await page.waitForLoadState('networkidle')
  const received = page.getByLabel('Recibido Producto E2E costo 10')
  await received.fill('4')
  await page.getByLabel('N° de factura del proveedor').fill(invoice)
  await page.getByRole('button', { name: 'Agregar gasto' }).click()
  await page.getByLabel('Monto del gasto 1').fill('10')
  await expect(received).toHaveValue('4')
  await expect(page.getByLabel('N° de factura del proveedor')).toHaveValue(invoice)
  await expect(page.getByTestId('receipt-invoice-total')).toContainText('45,20')
  await expect(page.getByTestId('receipt-cost-total')).toContainText('49,32')

  await page.getByRole('button', { name: 'Confirmar recepción' }).click()
  await expectToast(page, /Recepción REC-\d+ confirmada/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^REC-\d+/)
  await expect(page.getByRole('link', { name: /^ENT-\d+/ })).toBeVisible()
  await expect(page.getByText(invoice).first()).toBeVisible()
  await expect(page.getByText('5,88').first()).toBeVisible()

  await page.getByRole('link', { name: orderNumber }).click()
  await expect(page.getByText('Recibida parcial')).toBeVisible()

  await page.goto('/compras/pagos')
  await page.getByRole('button', { name: 'Registrar pago' }).click()
  const dialog = page.getByRole('dialog')
  await pickFromCombobox(page, 'Buscar proveedor…', 'Proveedor E2E', /Proveedor E2E SRL/)
  await dialog.getByRole('button', { name: /Pagar todo el saldo/ }).click()
  await dialog.getByRole('button', { name: 'Registrar pago' }).click()
  await expectToast(page, /Pago PAG-\d+ registrado/)
})
