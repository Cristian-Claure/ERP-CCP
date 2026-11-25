import { expect, test } from '@playwright/test'

const out = (name: string) => `/screenshots/${name}.png`

test('captura: compras', async ({ page }) => {
  await page.goto('/compras/ordenes')
  await expect(page.locator('tbody tr', { hasText: 'OC-' }).first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: out('purchase-orders') })

  // A receipt of an import with freight (seeded) for the cost breakdown.
  await page.goto('/compras/recepciones')
  await page.locator('tbody tr', { hasText: 'Shenzhen' }).first().click()
  await expect(page.getByText('Costo de entrada por línea')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: out('purchase-receipt'), fullPage: true })

  await page.goto('/compras/pagos')
  await expect(page.getByText('Deuda con proveedores')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: out('payables') })
})

test('captura: Atlas con capa de proveedores', async ({ page }) => {
  await page.goto('/atlas')
  await page.waitForTimeout(6000)
  await page.getByRole('button', { name: /capas|ajustes|opciones/i }).first().click().catch(() => {})
  const toggle = page.getByText('Proveedores y arcos de compra')
  if (await toggle.isVisible().catch(() => false)) {
    await page.locator('label', { hasText: 'Proveedores y arcos de compra' }).getByRole('switch').click()
    await page.keyboard.press('Escape')
  }
  await page.waitForTimeout(5000)
  await page.screenshot({ path: out('atlas-suppliers') })
})
