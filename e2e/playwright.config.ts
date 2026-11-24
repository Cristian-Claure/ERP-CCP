import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end suite against the running dev stack (`make up`).
 * Inside the e2e container a TCP forwarder (support/global-setup.ts) maps
 * localhost:5173 → web and localhost:8000 → nginx, so the browser sees the
 * exact same origins as a developer (Sanctum cookies and CORS unchanged).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './support/global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: '.auth/admin.json' },
      dependencies: ['setup'],
    },
    // README captures (docs/screenshots): only with CAPTURE=1, never in CI.
    ...(process.env.CAPTURE
      ? [
          {
            name: 'screenshots',
            testDir: './screenshots',
            testMatch: /\.capture\.ts$/,
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 1440, height: 900 },
              colorScheme: 'dark' as const,
              storageState: '.auth/admin.json',
            },
            dependencies: ['setup'],
          },
        ]
      : []),
  ],
})
