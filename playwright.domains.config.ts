import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/domains',
  testMatch: '**/e2e.spec.ts',
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 5191 --strictPort',
    url: 'http://127.0.0.1:5191',
    reuseExistingServer: false,
  },
});
