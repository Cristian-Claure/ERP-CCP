import { expect, test as setup } from '@playwright/test'

setup('iniciar sesión como administrador', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('admin@ccp.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('password')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).not.toHaveURL(/\/login/)
  await page.context().storageState({ path: '.auth/admin.json' })
})
