import { expect, test, type Page } from "@playwright/test";
import { ACCESS, PAGE_READY_TIMEOUT, USER, WORKSPACE, mockAuth } from "../helpers/mock-auth";

/**
 * e2e: 로그인 뒤 원래 화면으로 돌아오기.
 *
 * - [세션과 토큰](CLE-ACCT-SESSION) REQ-SESSION-035 · 038 — 보호 경로는 경로와 쿼리를 `redirect` 에 담아
 *   로그인 화면으로 보내고, 로그인에 성공하면 그 경로로 돌아온다(CLE-T-7WZKFB).
 * - [워크스페이스와 멤버](CLE-ACCT-WS) 「초대 가입 화면」 — 로그인하지 않은 기존 가입자가 초대 가입
 *   링크를 열면 로그인 화면으로 가고, 로그인 뒤 초대 수락 페이지에서 수락한다(CLE-T-YZ9VEX).
 *
 * 백엔드 호출은 page.route 로 mock 한다. proxy 는 `has_session` 힌트 쿠키로 보호 경로를 가르므로
 * 세션 없는 출발점을 만들려고 mockAuth 뒤에 쿠키를 지운다.
 */

const SLUG = WORKSPACE.slug;
const TOKEN = "e2e-invite-token";
/** 초대 만료 시각을 지금부터 얼마 뒤로 둘지. */
const ONE_HOUR_MS = 3_600_000;

async function mockSignedOut(page: Page) {
  await mockAuth(page);
  await page.context().clearCookies();
}

async function mockPasswordLogin(page: Page) {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { accessToken: ACCESS } }),
    }),
  );
}

async function submitLogin(page: Page) {
  await page.getByLabel(/이메일|Email/i).first().fill(USER.email);
  await page.getByLabel(/비밀번호|Password/i).first().fill("Password1!");
  await page.getByRole("button", { name: /^(로그인|Sign in)$/ }).click();
}

test.describe("로그인 뒤 redirect 복귀", () => {
  test("보호 경로 → 로그인 → 같은 경로와 쿼리로 돌아온다", async ({ page }) => {
    await mockSignedOut(page);
    await mockPasswordLogin(page);
    await page.route(/\/api\/workflows(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], pagination: { total: 0 } }),
      }),
    );

    const target = `/w/${SLUG}/workflows?q=abc`;
    await page.goto(target);

    // proxy 가 경로와 쿼리를 통째로 redirect 에 담는다.
    await page.waitForURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(target);

    await submitLogin(page);

    await page.waitForURL((url) => url.pathname === `/w/${SLUG}/workflows`, {
      timeout: PAGE_READY_TIMEOUT,
    });
    expect(new URL(page.url()).searchParams.get("q")).toBe("abc");
  });

  test("외부 URL 을 담은 redirect 는 따르지 않고 대시보드로 간다", async ({ page }) => {
    await mockSignedOut(page);
    await mockPasswordLogin(page);

    await page.goto(`/login?redirect=${encodeURIComponent("https://evil.example.com/x")}`);
    await submitLogin(page);

    await page.waitForURL(new RegExp(`/w/${SLUG}/dashboard`), { timeout: PAGE_READY_TIMEOUT });
    expect(new URL(page.url()).host).not.toContain("evil.example.com");
  });

  // OAuth 는 `/callback` 으로 돌아와 `?redirect=` 를 들고 올 수 없다. 로그인 화면이 남긴 sessionStorage
  // 값으로 돌아가고, 콜백이 `has_session` 힌트 쿠키를 심어야 proxy 가 다시 /login 으로 돌리지 않는다.
  test("OAuth 콜백 → 로그인 화면이 남긴 경로로 돌아온다 (힌트 쿠키 없이 시작)", async ({
    page,
  }) => {
    await mockSignedOut(page);
    await page.route(/\/api\/workflows(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], pagination: { total: 0 } }),
      }),
    );

    const target = `/w/${SLUG}/workflows?q=oauth`;
    await page.goto("/login");
    await page.evaluate((value) => {
      window.sessionStorage.setItem("clemvion.postLoginRedirect", value);
    }, target);

    await page.goto("/callback?success=true");

    await page.waitForURL((url) => url.pathname === `/w/${SLUG}/workflows`, {
      timeout: PAGE_READY_TIMEOUT,
    });
    expect(new URL(page.url()).searchParams.get("q")).toBe("oauth");
    expect(
      await page.evaluate(() => window.sessionStorage.getItem("clemvion.postLoginRedirect")),
    ).toBeNull();
  });
});

test.describe("초대 가입 링크 — 이미 가입된 이메일", () => {
  test("가입 화면 → 로그인 → 초대 수락 페이지에서 수락", async ({ page }) => {
    await mockSignedOut(page);
    await mockPasswordLogin(page);
    await page.route(`**/api/invitations/${TOKEN}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            workspaceName: "Team Alpha",
            invitedByName: "Bob",
            email: USER.email,
            role: "editor",
            expiresAt: new Date(Date.now() + ONE_HOUR_MS).toISOString(),
          },
        }),
      }),
    );
    let checkEmailCalls = 0;
    await page.route("**/api/auth/check-email", (route) => {
      checkEmailCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { available: false } }),
      });
    });
    let acceptBody: unknown = null;
    await page.route("**/api/workspaces/invitations/accept", (route) => {
      acceptBody = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { workspaceId: WORKSPACE.id, role: "editor" } }),
      });
    });

    await page.goto(`/register?invitationToken=${TOKEN}`);

    // 가입 폼 대신 로그인 화면으로 간다. 돌아올 곳은 초대 수락 페이지다.
    await page.waitForURL(/\/login\?/, { timeout: PAGE_READY_TIMEOUT });
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(
      `/invitations/accept?token=${TOKEN}`,
    );
    expect(checkEmailCalls).toBe(1);
    await expect(
      page.getByText(/로그인하면 초대 수락 화면으로 이동해요|Sign in to continue to the invitation/),
    ).toBeVisible();

    await submitLogin(page);

    // 슬러그 없는 수락 경로는 현재 워크스페이스 슬러그로 흡수되고 토큰 쿼리는 그대로 남는다.
    await page.waitForURL(
      (url) =>
        url.pathname === `/w/${SLUG}/invitations/accept` &&
        url.searchParams.get("token") === TOKEN,
      { timeout: PAGE_READY_TIMEOUT },
    );

    await page.getByRole("button", { name: /^(수락|Accept)$/ }).click();

    await expect(page.getByText(/워크스페이스에 합류했어요|joined/i).first()).toBeVisible();
    expect(acceptBody).toEqual({ token: TOKEN });
  });
});
