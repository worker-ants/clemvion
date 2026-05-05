import { defineConfig, devices } from "@playwright/test";

/**
 * Stage 10 — WCAG 2.1 AA e2e + a11y 검증용 설정.
 *
 * 단일 chromium 으로만 시작 — webkit/firefox 는 axe-core 결과가 거의 동일하고,
 * 첫 도입 단계에서는 디버깅 비용을 낮추기 위해 좁힌다. 운영 안정 후 webkit
 * 추가는 별도 follow-up.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // 로컬 디버깅 우선. CI 도입 시 1~2 로 올림.
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
