import { expect, type Page, test } from '@playwright/test'

import { expectToast, pickFromCombobox, pickFromSelect } from '../support/ui'

async function confirmDocument(page: Page, prefix: string) {
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('¿Confirmar el documento?')
  await dialog.getByRole('button', { name: 'Confirmar' }).click()
  await expectToast(page, /confirmado/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(`^${prefix}-\\d+`))
}

/** Safety net for the inventory document editor refactor. */
test('entrada con costo: borrador y confirmación ENT-', async ({ page }) => {
  await page.goto('/inventario/documentos/nuevo?tipo=entry')
  await pickFromSelect(page, 'Seleccionar', 'Central Santa Cruz')
  await page.getByLabel('Referencia').fill('E2E-FAC-1')
  await pickFromCombobox(page, 'Buscar producto…', 'E2E-002', /E2E-002/)
  await page.getByLabel('Cantidad', { exact: true }).fill('5')
  await page.getByLabel('Costo unitario').fill('4,50')
  await expect(page.getByText('22,50').first()).toBeVisible()

  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expectToast(page, 'Borrador guardado')
  await expect(page).toHaveURL(/\/inventario\/documentos\/\d+$/)

  await confirmDocument(page, 'ENT')
  await expect(page.getByText('E2E-FAC-1')).toBeVisible()
  await expect(page.getByText('22,50').first()).toBeVisible()
})

test('ajuste por conteo con motivo: diferencia y confirmación AJU-', async ({ page }) => {
  await page.goto('/inventario/documentos/nuevo?tipo=adjustment')
  await pickFromSelect(page, 'Seleccionar', 'Central Santa Cruz')
  await pickFromSelect(page, 'Seleccionar', 'Merma')
  await pickFromCombobox(page, 'Buscar producto…', 'E2E-003', /E2E-003/)
  await page.getByLabel('Cantidad contada').fill('500')
  await expect(page.getByRole('cell', { name: /^[+-]?[\d.,]+$/ }).first()).toBeVisible()

  await confirmDocument(page, 'AJU')
  await expect(page.getByText('Merma')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Contado' })).toBeVisible()
})
