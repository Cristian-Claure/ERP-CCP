import { test } from '@playwright/test'

const out = (name: string) => `/screenshots/${name}.png`

test('captura: punto de venta', async ({ page }) => {
  await page.goto('/pos')
  await page.getByRole('combobox', { name: 'Almacén del punto de venta' }).click()
  await page.getByRole('option', { name: 'Central Santa Cruz' }).click()
  const search = page.getByRole('textbox', { name: 'Buscar producto' })
  await search.fill('arroz')
  await page.getByRole('button', { name: /Arroz grano largo/ }).first().click()
  for (const term of ['cerveza rubia', 'atun', 'cafe molido']) {
    await search.fill(term)
    await page.keyboard.press('Enter')
  }
  await search.fill('')
  await page.getByRole('textbox', { name: 'NIT o CI del cliente' }).fill('4589632015')
  await page.getByRole('textbox', { name: 'Razón social' }).fill('Comercial Andina SRL')
  await page.waitForTimeout(600)
  await page.screenshot({ path: out('pos') })

  await page.keyboard.press('F4')
  const dialog = page.getByRole('dialog', { name: 'Cobrar' })
  await dialog.getByRole('button', { name: 'QR' }).click()
  await dialog.getByLabel('QR', { exact: true }).fill('50')
  await dialog.getByLabel('Efectivo recibido').fill('100')
  await page.waitForTimeout(300)
  await page.screenshot({ path: out('pos-checkout') })
})
