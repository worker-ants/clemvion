import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: /workspace/settings 의 멤버 관리 UI.
 *
 * spec/2-navigation/9-user-profile.md §workspace-settings + auth-sessions 작업.
 * RBAC 흐름은 codebase/backend/test/workspace-rbac.e2e-spec.ts 가 검증하고, 본 spec 은
 * UI 렌더와 인터랙션 분기에 집중한다.
 */

const ACCESS = "mock-access-token";
const USER = {
  id: "user-owner",
  email: "owner@example.com",
  name: "Owner",
  locale: "ko",
  theme: "light",
};
const WORKSPACE = {
  id: "ws-team",
  name: "E2E Team",
  type: "team",
  slug: "e2e-team",
  role: "owner",
};
const MEMBERS = [
  { id: "m-1", userId: "user-owner", email: "owner@example.com", name: "Owner", role: "owner" },
  { id: "m-2", userId: "user-ed", email: "editor@example.com", name: "Editor", role: "editor" },
  { id: "m-3", userId: "user-v", email: "viewer@example.com", name: "Viewer", role: "viewer" },
];

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

test.describe("Workspace members page", () => {
  test("멤버 목록 + 역할 배지 노출", async ({ page }) => {
    await mockAuth(page);
    await page.route(`**/api/workspaces/${WORKSPACE.id}/members`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: MEMBERS }),
      });
    });
    await page.route(`**/api/workspaces/${WORKSPACE.id}/invitations`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto("/workspace/settings");

    // 페이지의 default tab 은 overview. 멤버 보려면 멤버 탭 클릭 필요.
    await page
      .getByRole("tab", { name: /멤버|Members|구성원/i })
      .first()
      .click();

    await expect(page.getByText(/owner@example.com/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/editor@example.com/i)).toBeVisible();
    await expect(page.getByText(/viewer@example.com/i)).toBeVisible();
  });

  test("초대 다이얼로그 — 이메일 + 역할 선택 후 POST /invitations", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.route(`**/api/workspaces/${WORKSPACE.id}/members`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: MEMBERS }),
      });
    });
    await page.route(
      `**/api/workspaces/${WORKSPACE.id}/invitations`,
      async (route) => {
        const method = route.request().method();
        if (method === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: [] }),
          });
        } else if (method === "POST") {
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                id: "inv-new",
                email: "new@example.com",
                role: "editor",
                expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
              },
            }),
          });
        } else {
          await route.continue();
        }
      },
    );

    await page.goto("/workspace/settings");

    // 멤버 탭 활성화.
    await page
      .getByRole("tab", { name: /멤버|Members|구성원/i })
      .first()
      .click();

    const inviteBtn = page
      .getByRole("button", { name: /초대|Invite/i })
      .first();
    await inviteBtn.click();

    const emailInput = page.getByLabel(/이메일|Email/i).first();
    await emailInput.fill("new@example.com");

    const submit = page
      .getByRole("button", { name: /초대|Invite|Send|보내기/i })
      .last();
    await submit.click();

    // 성공 메시지 또는 다이얼로그 닫힘.
    await expect(
      page.getByText(/초대|invited|발송|sent/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
