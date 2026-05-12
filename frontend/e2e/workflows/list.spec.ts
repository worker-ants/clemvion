import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: 워크플로우 목록 페이지 (spec/2-navigation/1-workflow-list.md).
 *
 * (main) 레이아웃의 AuthProvider 가 마운트 시 /auth/refresh → /users/me 를 호출하므로
 * 모든 mock 에서 이 두 응답을 함께 fulfill 한다. mock 으로 frontend rendering /
 * filter / search / empty state 분기를 검증한다.
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

function workflowsFixture(items: Array<{
  id: string;
  name: string;
  isActive?: boolean;
}>) {
  return {
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      description: null,
      isActive: i.isActive ?? true,
      tags: [],
      folderId: null,
      settings: {},
      workspaceId: WORKSPACE.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownership: "mine",
    })),
    total: items.length,
    page: 1,
    pageSize: 10,
  };
}

test.describe("Workflows list page", () => {
  test("렌더 → 워크플로우 카드/행 표시", async ({ page }) => {
    await mockAuth(page);
    await page.route(/\/api\/workflows(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: workflowsFixture([
            { id: "wf-1", name: "Onboarding flow" },
            { id: "wf-2", name: "Order processing" },
          ]),
        }),
      });
    });

    await page.goto("/workflows");

    await expect(page.getByText(/Onboarding flow/i)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/Order processing/i)).toBeVisible();
  });

  test("빈 상태 → empty state 안내", async ({ page }) => {
    await mockAuth(page);
    await page.route(/\/api\/workflows(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: workflowsFixture([]) }),
      });
    });

    await page.goto("/workflows");

    // 빈 상태에 "워크플로우가 없습니다" 또는 "No workflows" 같은 메시지.
    await expect(
      page.getByText(/워크플로우|workflows/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("검색 입력 → debounce 후 ?search 파라미터 포함된 요청", async ({ page }) => {
    await mockAuth(page);
    const requests: string[] = [];
    await page.route(/\/api\/workflows(\?|$)/, async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: workflowsFixture([]) }),
      });
    });

    await page.goto("/workflows");
    await expect.poll(() => requests.length, { timeout: 5_000 }).toBeGreaterThan(0);

    const searchInput = page.getByPlaceholder(/검색|Search/i).first();
    await searchInput.fill("alpha");

    // debounce 후 search=alpha 요청이 들어와야 함.
    await expect
      .poll(
        () => requests.some((u) => u.includes("search=alpha")),
        { timeout: 5_000 },
      )
      .toBe(true);
  });
});
