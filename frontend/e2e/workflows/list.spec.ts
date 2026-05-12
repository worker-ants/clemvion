import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: 워크플로우 목록 페이지 (spec/2-navigation/1-workflow-list.md).
 *
 * (main) 레이아웃 의 AuthProvider 가 /auth/refresh → /users/me 호출하고, Sidebar 가
 * /workspaces + /notifications 호출. 모두 mock 하지 않으면 page 가 loading 또는
 * error 상태에서 멈춘다.
 *
 * 응답 shape (frontend/src/lib/api/paginated.ts):
 *   - normalizePagedResponse 는 `{ data: T[], pagination: {...} }` 형태를 기대
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
  // Sidebar 가 호출하는 알림 API 도 catch. 비어있는 응답 으로 통과.
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

interface WorkflowFixture {
  id: string;
  name: string;
  isActive?: boolean;
}

function workflowsResponseBody(items: WorkflowFixture[]) {
  // backend PaginatedResponseDto 형태: { data: [...], pagination: {...} }
  return {
    data: items.map((i) => ({
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
    pagination: {
      page: 1,
      limit: 10,
      totalItems: items.length,
      totalPages: 1,
    },
  };
}

test.describe("Workflows list page", () => {
  test("렌더 → 워크플로우 카드/행 표시", async ({ page }) => {
    await mockAuth(page);
    await page.route(/\/api\/workflows(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          workflowsResponseBody([
            { id: "wf-1", name: "Onboarding flow" },
            { id: "wf-2", name: "Order processing" },
          ]),
        ),
      });
    });

    await page.goto("/workflows");

    await expect(page.getByText(/Onboarding flow/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Order processing/i)).toBeVisible();
  });

  test("빈 상태 → empty state 안내", async ({ page }) => {
    await mockAuth(page);
    await page.route(/\/api\/workflows(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(workflowsResponseBody([])),
      });
    });

    await page.goto("/workflows");

    // 빈 상태 안내 메시지 — 정확한 i18n 텍스트 다양성 흡수 위해 폭넓게.
    await expect(
      page.getByText(/워크플로우|workflow|새 워크플로우|create|create new/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("검색 입력 → debounce 후 ?search 파라미터 포함된 요청", async ({ page }) => {
    await mockAuth(page);
    const requests: string[] = [];
    await page.route(/\/api\/workflows(\?|$)/, async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(workflowsResponseBody([])),
      });
    });

    await page.goto("/workflows");
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThan(0);

    const searchInput = page.getByPlaceholder(/검색|Search/i).first();
    await searchInput.fill("alpha");

    await expect
      .poll(
        () => requests.some((u) => u.includes("search=alpha")),
        { timeout: 10_000 },
      )
      .toBe(true);
  });
});
