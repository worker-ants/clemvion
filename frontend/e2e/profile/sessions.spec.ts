import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: 프로필 세션 페이지 (spec/2-navigation/9-user-profile.md §sessions).
 *
 * /profile/sessions 의 활성 세션 목록 / 현재 세션 라벨 / 단일 revoke 확인 다이얼로그
 * 흐름을 mock 으로 검증.
 */

const ACCESS = "mock-access-token";
const USER = {
  id: "user-1",
  email: "alice@example.com",
  name: "Alice",
  emailVerified: true,
};
const WORKSPACE = {
  id: "ws-1",
  name: "Personal",
  type: "personal",
  role: "owner",
};

async function mockAuth(page: Page) {
  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { accessToken: ACCESS } }),
    });
  });
  await page.route("**/api/users/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: USER }),
    });
  });
  await page.route("**/api/workspaces", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [WORKSPACE] }),
      });
    } else {
      await route.continue();
    }
  });
}

const ACTIVE_SESSIONS = [
  {
    familyId: "fam-current",
    isCurrent: true,
    deviceLabel: "Chrome on macOS",
    ip: "127.0.0.1",
    lastUsedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
  {
    familyId: "fam-other",
    isCurrent: false,
    deviceLabel: "Safari on iPhone",
    ip: "10.0.0.7",
    lastUsedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
];

test.describe("Profile sessions page", () => {
  test("활성 세션 목록 + 현재 세션 표시", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/users/me/sessions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: ACTIVE_SESSIONS }),
      });
    });
    await page.route("**/api/users/me/login-history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], nextCursor: null } }),
      });
    });

    await page.goto("/profile/sessions");

    await expect(page.getByText(/Chrome on macOS/i)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/Safari on iPhone/i)).toBeVisible();

    // 현재 세션 라벨.
    await expect(
      page.getByText(/현재 세션|Current session|this device/i).first(),
    ).toBeVisible();
  });

  test("다른 세션 revoke → 다이얼로그 → 비밀번호 입력 → 200 후 목록 갱신", async ({
    page,
  }) => {
    await mockAuth(page);

    let revoked = false;
    await page.route("**/api/users/me/sessions", async (route) => {
      const body = revoked
        ? { data: [ACTIVE_SESSIONS[0]] }
        : { data: ACTIVE_SESSIONS };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.route("**/api/users/me/sessions/*/revoke", async (route) => {
      revoked = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [ACTIVE_SESSIONS[0]] }),
      });
    });
    await page.route("**/api/users/me/login-history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], nextCursor: null } }),
      });
    });

    await page.goto("/profile/sessions");
    await expect(page.getByText(/Safari on iPhone/i)).toBeVisible({
      timeout: 5_000,
    });

    // "종료" / "Revoke" 버튼 클릭. 다른 세션 행에 위치한 첫 버튼.
    const revokeBtn = page
      .getByRole("button", { name: /종료|Revoke|Sign out/i })
      .first();
    await revokeBtn.click();

    // 다이얼로그에서 비밀번호 입력.
    const dialogPassword = page
      .getByLabel(/비밀번호|Password/i)
      .first();
    await dialogPassword.fill("Whatever!1234");

    // 확인 버튼.
    await page
      .getByRole("button", { name: /확인|Confirm|종료|Revoke/i })
      .last()
      .click();

    // 목록에서 Safari 세션이 사라져야 함.
    await expect(page.getByText(/Safari on iPhone/i)).toBeHidden({
      timeout: 5_000,
    });
  });
});
