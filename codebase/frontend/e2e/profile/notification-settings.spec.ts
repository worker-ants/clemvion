import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: 알림 설정 화면 (CLE-OBS-NOTIFY-SETTINGS 「알림 설정 화면과 수신 거부 링크」,
 * CLE-ACCT-PROFILE REQ-PROFILE-005, CLE-T-EJFQ1Y).
 */

const ACCESS = "mock-access-token";
const USER = {
  id: "user-1",
  email: "alice@example.com",
  name: "Alice",
  locale: "ko",
  theme: "light",
};
const WORKSPACE = {
  id: "ws-1",
  name: "Personal",
  type: "personal",
  slug: "personal-alice",
  role: "owner",
};

async function mockAuth(page: Page) {
  // proxy.ts 가 has_session cookie 없으면 server-side 로 /login redirect.
  await page.context().addCookies([
    {
      name: "has_session",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
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
  await page.route("**/api/notifications/unread-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: 0 }),
    });
  });
  await page.route(/\/api\/notifications(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
}

const DEFAULT_SETTINGS = {
  executionFailedInApp: true,
  executionFailedEmail: true,
  scheduleFailedInApp: true,
  scheduleFailedEmail: true,
  integrationExpiryInApp: true,
  integrationExpiryEmail: false,
};

async function mockSettings(page: Page) {
  let settings = { ...DEFAULT_SETTINGS };
  const patches: Array<Record<string, boolean>> = [];
  await page.route("**/api/notifications/settings", async (route) => {
    const req = route.request();
    if (req.method() === "PATCH") {
      const patch = req.postDataJSON() as Record<string, boolean>;
      patches.push(patch);
      settings = { ...settings, ...patch };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: settings }),
    });
  });
  return patches;
}

test.describe("Notification settings page", () => {
  test("프로필의 알림 설정 링크로 들어간다", async ({ page }) => {
    await mockAuth(page);
    await mockSettings(page);

    await page.goto("/profile");
    await page.getByRole("link", { name: /알림 설정/ }).click();

    await expect(page).toHaveURL(/\/w\/personal-alice\/profile\/notifications$/);
    await expect(
      page.getByRole("heading", { name: "알림 설정" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("토글을 바꾸면 그 키만 저장하고 둘 다 끄면 안내를 보인다", async ({
    page,
  }) => {
    await mockAuth(page);
    const patches = await mockSettings(page);

    await page.goto("/profile/notifications");

    const inApp = page.getByLabel("스케줄 실행 실패 벨 알림");
    const email = page.getByLabel("스케줄 실행 실패 이메일");
    await expect(inApp).toBeChecked({ timeout: 10_000 });
    await expect(page.getByLabel("통합 연결 만료 이메일")).not.toBeChecked();

    await inApp.click();
    await expect(inApp).not.toBeChecked();
    await expect(email).toBeEnabled();
    await email.click();
    await expect(email).not.toBeChecked();

    expect(patches).toEqual([
      { scheduleFailedInApp: false },
      { scheduleFailedEmail: false },
    ]);
    await expect(
      page.getByText("벨과 이메일을 모두 끄면 이 알림은 받지 않아요."),
    ).toBeVisible();
  });
});
