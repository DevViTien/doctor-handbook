import { defineConfig, devices } from "@playwright/test";

import {
  E2E_ACCESS_CODE_PEPPER,
  E2E_CLIENT_IP,
  E2E_CRON_SECRET,
  FAKE_STORAGE_URL,
} from "./tests/e2e/fixtures/constants";

/**
 * End-to-end tests run against mobile viewports first: doctors use the app on their phones.
 * Install browsers once with `pnpm exec playwright install`.
 *
 * The app under test is a production build on its own port (3100), so it never collides with
 * a `pnpm dev` server (Next.js 16 refuses a second dev server in the same directory).
 *
 * Tests that need a database run only when `E2E_DATABASE_URL` points to a PostgreSQL database
 * dedicated to tests (it is wiped). They share one database, so they run in a single worker.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const databaseUrl = process.env.E2E_DATABASE_URL;

/** Server env for E2E: the test database plus placeholders for services these flows never use. */
const serverEnv: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  ),
  ...(databaseUrl
    ? {
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: FAKE_STORAGE_URL,
        SUPABASE_SERVICE_ROLE_KEY: "e2e-placeholder-not-used",
        ACCESS_CODE_PEPPER: E2E_ACCESS_CODE_PEPPER,
        CRON_SECRET: E2E_CRON_SECRET,
      }
    : {}),
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: !databaseUrl,
  workers: databaseUrl ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    // Stands in for the client IP Vercel sets in production; without it the app sees an unknown
    // address and (by design) applies no per-IP login limit.
    extraHTTPHeaders: { "x-real-ip": E2E_CLIENT_IP },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "on-first-retry",
  },
  projects: [
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "iphone", use: { ...devices["iPhone 14"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        // Stand-in for Supabase Storage (change add-patient-avatars): the app's SUPABASE_URL.
        {
          command: "node tests/e2e/fake-storage.mjs",
          url: `${FAKE_STORAGE_URL}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          command: `pnpm build && pnpm exec next start -p ${PORT}`,
          url: `${baseURL}/api/health`,
          env: serverEnv,
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
        },
      ],
});
