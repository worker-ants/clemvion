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
  // Tier 1: CI(docker e2e 러너)에서 순간 timing flake 를 자동 retry 로 흡수한다. 재시도 없이는
  // 무관한 스펙 1건의 간헐 timeout(client-nav·query 해소 대기)이 전체 run 을 실패시킨다.
  // 로컬은 0(디버깅 시 즉시 실패가 유용).
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  // Tier 3: 부하 상황(러너 병렬 실행)에서 assertion·test 대기 여유. 기존 스펙들이 명시 10s 를
  // 흩뿌리던 것을 전역 기본으로 끌어올려 미명시 assert 도 slack 을 갖게 한다.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3012",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Tier 2: CI 에서는 **production 빌드**(`next build && next start`)로 서버를 띄운다 — `next dev`
  // 의 라우트 온디맨드 컴파일·비결정적 hydration/chunk timing 이 client-side navigation
  // (`router.push`→`waitForURL`) flake 의 뿌리다(profile-edit.spec 저자 주석 참조). 로컬은 이미 떠
  // 있는 dev server 재사용(빠른 반복). PLAYWRIGHT_NO_WEBSERVER=1 로 강제 비활성 가능.
  webServer: process.env.PLAYWRIGHT_NO_WEBSERVER
    ? undefined
    : {
        command: process.env.CI
          ? "npm run build && npm run start"
          : "npm run dev",
        url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3012",
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
