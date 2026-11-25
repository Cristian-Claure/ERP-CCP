import { expect, test } from '@playwright/test'

/** Smoke test of the customer detail page and its three tabs. */
test('ficha de cliente: información, ventas y estado de cuenta', async ({ page }) => {
  await page.goto('/ventas/clientes')
  await page.locator('tbody tr', { hasText: 'NIT' }).first().click()
  await expect(page).toHaveURL(/\/ventas\/clientes\/\d+$/)
  await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty()

  await page.getByRole('tab', { name: 'Ventas' }).click()
  await expect(page.getByRole('tabpanel')).toBeVisible()
  await page.getByRole('tab', { name: 'Estado de cuenta' }).click()
  await expect(page.getByText('Antigüedad de la deuda')).toBeVisible()
  await page.getByRole('tab', { name: 'Información' }).click()
  await expect(page.getByRole('tabpanel')).toBeVisible()
})
