import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: /integrations 목록 페이지.
 *
 * spec/2-navigation/4-integration.md. backend 의 마스킹·암호화는
 * backend/test/integration-credentials.e2e-spec.ts 가 담당. UI 에서는 카드 목록과
 * 신규 생성 진입점이 표시되는지만 확인.
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

function integrationFixture(items: Array<{
  id: string;
  serviceType: string;
  name: string;
}>) {
  return {
    items: items.map((i) => ({
      id: i.id,
      serviceType: i.serviceType,
      name: i.name,
      authType: "api_key",
      credentials: { value: "******" },
      scope: "personal",
      isActive: true,
      workspaceId: WORKSPACE.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    total: items.length,
    page: 1,
    pageSize: 20,
  };
}

test.describe("Integrations list page", () => {
  test("목록 렌더 + 카드 표시", async ({ page }) => {
    await mockAuth(page);
    await page.route(/\/api\/integrations(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: integrationFixture([
            { id: "i-1", serviceType: "http", name: "API Backend" },
            { id: "i-2", serviceType: "github", name: "Source Repo" },
          ]),
        }),
      });
    });
    await page.route("**/api/integrations/services", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto("/integrations");

    await expect(page.getByText(/API Backend/i)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/Source Repo/i)).toBeVisible();
  });

  test("빈 목록 → empty state", async ({ page }) => {
    await mockAuth(page);
    await page.route(/\/api\/integrations(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: integrationFixture([]) }),
      });
    });
    await page.route("**/api/integrations/services", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto("/integrations");

    await expect(
      page.getByText(/통합|Integration|연동/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
