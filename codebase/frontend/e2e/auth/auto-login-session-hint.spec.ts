import { expect, test, type Page } from "@playwright/test";
import { ACCESS, PAGE_READY_TIMEOUT, mockAuth } from "../helpers/mock-auth";

/**
 * e2e: 자동 로그인 경로도 로그인 힌트 쿠키를 둔다.
 *
 * [세션과 토큰](CLE-ACCT-SESSION) REQ-SESSION-037 — 토큰을 받은 모든 경로가 같은 진입점(`establishSession`)으로
 * 로그인 상태와 `has_session` 힌트 쿠키를 둔다. 이메일 인증 링크와 초대 가입은 예전에 액세스 토큰만 두고
 * 힌트 쿠키를 심지 않아서, `/dashboard` 로 이동하는 요청을 proxy 가 `/login` 으로 되돌렸다(CLE-T-1X7DMR).
 *
 * 백엔드 호출은 page.route 로 mock 한다. 세션 없는 출발점을 만들려고 mockAuth 뒤에 쿠키를 지운다.
 */

const INVITE_TOKEN = "b".repeat(64);
/** 초대 만료 시각을 지금부터 얼마 뒤로 둘지. */
const ONE_HOUR_MS = 3_600_000;

async function mockSignedOut(page: Page) {
  await mockAuth(page);
  await page.context().clearCookies();
}

async function expectSignedInOnDashboard(page: Page) {
  // proxy 가 힌트 쿠키 없이 /login 으로 돌리면 이 대기가 실패한다.
  await page.waitForURL(/\/dashboard/, { timeout: PAGE_READY_TIMEOUT });
  await expect(page).not.toHaveURL(/\/login/);
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "has_session")?.value).toBe("1");
}

test.describe("자동 로그인 경로의 힌트 쿠키", () => {
  test("이메일 인증 링크 → 로그인 화면을 거치지 않고 대시보드로 간다", async ({
    page,
  }) => {
    await mockSignedOut(page);
    await page.route("**/api/auth/verify-email", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { accessToken: ACCESS } }),
      }),
    );

    await page.goto("/verify-email?token=e2e-verify-token");

    await expectSignedInOnDashboard(page);
  });

  test("초대 가입 → 로그인 화면을 거치지 않고 대시보드로 간다", async ({
    page,
  }) => {
    await mockSignedOut(page);
    await page.route(`**/api/invitations/${INVITE_TOKEN}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            workspaceName: "Team Alpha",
            invitedByName: "Alice",
            email: "invited@example.com",
            role: "editor",
            expiresAt: new Date(Date.now() + ONE_HOUR_MS).toISOString(),
          },
        }),
      }),
    );
    // 가입 화면은 메타 조회 뒤 가입 여부를 묻는다. 미가입 이메일로 두어 가입 폼을 띄운다.
    await page.route("**/api/auth/check-email", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { available: true } }),
      }),
    );
    // 초대 토큰 가입은 이메일 인증을 건너뛰고 액세스 토큰을 바로 준다.
    await page.route("**/api/auth/register", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { accessToken: ACCESS } }),
      }),
    );

    await page.goto(`/register?invitationToken=${INVITE_TOKEN}`);
    await expect(page.getByLabel(/이메일|Email/)).toHaveValue(
      "invited@example.com",
    );

    await page.getByLabel(/^(이름|Name)$/).fill("Invitee");
    await page.getByLabel(/^(비밀번호|Password)$/).fill("Password1!");
    await page.locator('input[type="checkbox"]').check();
    await page
      .getByRole("button", { name: /계정 만들기|Create [Aa]ccount/ })
      .click();

    await expectSignedInOnDashboard(page);
  });
});
