import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the host */
}

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  // Run `npm run build` first. The checks run against the production build.
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/shop`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
