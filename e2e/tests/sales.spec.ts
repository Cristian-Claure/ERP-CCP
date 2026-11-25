import { expect, test } from '@playwright/test'

import { expectToast, pickFromCombobox, pickFromSelect } from '../support/ui'

/**
 * Safety net for the sales editor refactor: full counter sale with a price
 * below cost (E2E-001 costs 10.00, sold at 8.00) that needs a manager
 * authorization, then the posted view and the printable document.
 */
test('venta completa: borrador, autorización bajo costo, confirmación e impresión', async ({ page }) => {
  await page.goto('/ventas/documentos/nuevo?tipo=sales_note')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/nota de venta/i)

  await pickFromCombobox(page, 'Buscar cliente…', 'Sin nombre', /Sin nombre/)
  await pickFromSelect(page, 'Seleccionar', 'Central Santa Cruz')
  await pickFromCombobox(page, 'Buscar producto…', 'E2E-001', /E2E-001/)

  await page.getByLabel('Cantidad').first().fill('2')
  await page.getByLabel('Precio unitario').first().fill('8')
  await expect(page.getByText('16,00').first()).toBeVisible()

  // Save the draft first: the URL switches to the persisted document.
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expectToast(page, 'Borrador guardado')
  await expect(page).toHaveURL(/\/ventas\/documentos\/\d+$/)

  // Posting is rejected (below cost) until the admin authorizes it with a reason.
  await page.getByRole('button', { name: 'Confirmar venta' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Precio bajo el costo o el mínimo')
  await dialog.getByLabel('Motivo de la autorización').fill('Liquidación de prueba E2E')
  await dialog.getByRole('button', { name: 'Autorizar y confirmar' }).click()

  await expectToast(page, /confirmada/)
  const number = page.getByRole('heading', { level: 1 })
  await expect(number).toHaveText(/^NV-\d+/)
  const saleNumber = (await number.textContent())!.trim()
  await expect(page.getByText('Venta bajo costo / precio mínimo autorizada')).toBeVisible()
  await expect(page.getByText('Liquidación de prueba E2E')).toBeVisible()
  await expect(page.getByRole('link', { name: /^SAL-\d+/ })).toBeVisible()
  await expect(page.getByText('Cobros aplicados')).toBeVisible()

  const [print] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: 'Imprimir / PDF' }).click(),
  ])
  await expect(print.getByText(saleNumber).first()).toBeVisible()
  await expect(print.getByText('E2E-001').first()).toBeVisible()
  await expect(print.getByText('16,00').first()).toBeVisible()
})
