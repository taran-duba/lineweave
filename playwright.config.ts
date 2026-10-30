import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

/**
 * Two-browser collaboration tests against the Firebase emulators and the
 * in-memory Drive stub: `npm run test:e2e` (starts the emulators for you).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
  webServer: {
    command: `next dev --port ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_DIST_DIR: '.next-e2e',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-upgraded-drawio.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-upgraded-drawio',
      NEXT_PUBLIC_FIREBASE_DATABASE_URL: 'http://127.0.0.1:9000?ns=demo-upgraded-drawio',
      NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-app',
      NEXT_PUBLIC_USE_FIREBASE_EMULATOR: '1',
      NEXT_PUBLIC_DRIVE_STUB: '1',
      DRIVE_STUB: '1',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
    },
  },
});
