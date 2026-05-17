import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: /integrations 목록 페이지 (spec/2-navigation/4-integration.md).
 *
 * 응답 shape: backend PaginatedResponseDto = `{ data: [...], pagination: {...} }`.
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
  await page.route("**/api/integrations/services", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
}

interface IntegrationFixture {
  id: string;
  serviceType: string;
  name: string;
}

function integrationsResponseBody(items: IntegrationFixture[]) {
  return {
    data: items.map((i) => ({
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
    pagination: {
      page: 1,
      limit: 20,
      totalItems: items.length,
      totalPages: 1,
    },
  };
}

test.describe("Integrations list page", () => {
  test("목록 렌더 + 카드 표시", async ({ page }) => {
    await mockAuth(page);
    await page.route(/\/api\/integrations(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          integrationsResponseBody([
            { id: "i-1", serviceType: "http", name: "API Backend" },
            { id: "i-2", serviceType: "github", name: "Source Repo" },
          ]),
        ),
      });
    });

    await page.goto("/integrations");

    await expect(page.getByText(/API Backend/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Source Repo/i)).toBeVisible();
  });

  test("빈 목록 → empty state", async ({ page }) => {
    await mockAuth(page);
    await page.route(/\/api\/integrations(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(integrationsResponseBody([])),
      });
    });

    await page.goto("/integrations");

    await expect(
      page.getByText(/통합|Integration|연동/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
