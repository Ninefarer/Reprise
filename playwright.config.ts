import { defineConfig, devices } from "@playwright/test";

const iphone = devices["iPhone 15"];

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
  webServer: {
    command: "npm run preview:web",
    url: "http://127.0.0.1:4173/Reprise/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "webkit-iphone",
      use: { ...iphone, reducedMotion: "reduce" },
      testMatch: /storage\.pw\.ts/,
    },
    {
      name: "chromium",
      use: { browserName: "chromium" },
      testMatch: /offline\.pw\.ts/,
    },
  ],
});
