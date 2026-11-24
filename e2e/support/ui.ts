import { expect, type Page } from '@playwright/test'

/** Opens a cmdk combobox by its trigger text, searches and picks the first option matching `option`. */
export async function pickFromCombobox(page: Page, trigger: string | RegExp, search: string, option: RegExp) {
  await page.getByRole('combobox').filter({ hasText: trigger }).first().click()
  await page.getByRole('dialog').getByRole('combobox').fill(search)
  await page.getByRole('option', { name: option }).first().click()
}

/** Picks an option of a Radix Select identified by its current text. */
export async function pickFromSelect(page: Page, trigger: string | RegExp, option: string | RegExp) {
  await page.getByRole('combobox').filter({ hasText: trigger }).first().click()
  await page.getByRole('option', { name: option }).click()
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: text }).first()).toBeVisible()
}
