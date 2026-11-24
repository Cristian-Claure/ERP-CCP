import { expect, type Page, test } from '@playwright/test'

/** Barcode readers type the whole code in a burst and press Enter. */
async function scan(page: Page, code: string) {
  await page.keyboard.type(code)
  await page.keyboard.press('Enter')
}

/**
 * Counter sale: scan 3 products (one twice), pay part QR and part cash with
 * change, then check the ticket (80 mm, amount in words) and the SAL- link.
 * E2E-001 15.00 · E2E-002 6.50 · E2E-003 3.20 → 2×15 + 6.50 + 3.20 = 39.70.
 */
test('POS: escaneo, pago mixto con cambio y ticket', async ({ page }) => {
  await page.goto('/pos')
  const catalog = page.waitForResponse((r) => r.url().includes('/api/v1/pos/catalog'))
  await page.getByRole('combobox', { name: 'Almacén del punto de venta' }).click()
  await page.getByRole('option', { name: 'Central Santa Cruz' }).click()
  // Wait for the catalog before scanning (in dev the page may re-mount right after loading).
  await catalog
  await page.waitForLoadState('networkidle')

  const search = page.getByRole('textbox', { name: 'Buscar producto' })
  await expect(search).toBeVisible()
  await expect(page.getByRole('button', { name: /Producto E2E costo 10/ })).toBeVisible()
  await search.focus()

  await scan(page, '7790000000011')
  await scan(page, '7790000000028')
  await scan(page, '7790000000035')
  await scan(page, '7790000000011')

  const cart = page.getByRole('list', { name: 'Carrito' })
  await expect(cart.getByRole('listitem')).toHaveCount(3)
  await expect(page.getByLabel('Cantidad de Producto E2E costo 10')).toHaveValue('2')
  await expect(page.getByTestId('pos-total')).toContainText('39,70')
  await expect(search).toHaveValue('')

  // F4 → payment: QR 10,00 + cash 50,00 → change 20,30.
  await page.keyboard.press('F4')
  const dialog = page.getByRole('dialog', { name: 'Cobrar' })
  await dialog.getByRole('button', { name: 'QR' }).click()
  await dialog.getByLabel('QR', { exact: true }).fill('10')
  await dialog.getByLabel('Efectivo recibido').fill('50')
  await expect(dialog.getByTestId('pos-change')).toContainText('20,30')
  await page.keyboard.press('Control+Enter')

  const done = page.getByRole('dialog').filter({ hasText: 'Cambio a entregar' })
  await expect(done.getByTestId('pos-done-change')).toContainText('20,30')
  const number = (await done.getByRole('heading').textContent())!.trim()
  expect(number).toMatch(/^NV-\d+$/)

  const [ticket] = await Promise.all([page.waitForEvent('popup'), done.getByRole('button', { name: 'Ticket' }).click()])
  const article = ticket.getByRole('article', { name: 'Ticket' })
  await expect(article).toContainText(number)
  await expect(article).toContainText('Son: Treinta y nueve 70/100 Bolivianos')
  await expect(article).toContainText('QR')
  await expect(article).toContainText('Efectivo recibido')
  await expect(article).toContainText('20,30')

  // The sale went through the normal engine: stock exit and receipts.
  await done.getByRole('button', { name: 'Nueva venta' }).click()
  await expect(cart.getByRole('listitem')).toHaveCount(1) // empty-state row
  await page.goto('/ventas/documentos?filter[search]=' + number)
  await page.getByRole('row', { name: new RegExp(number) }).click()
  await expect(page.getByRole('link', { name: /^SAL-\d+/ })).toBeVisible()
  await expect(page.getByText('Cobros aplicados')).toBeVisible()
})
