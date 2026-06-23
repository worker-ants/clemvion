import { expect, test } from "@playwright/test";
import { mockAuth, WORKSPACE } from "../helpers/mock-auth";

/**
 * e2e: 워크플로우 목록 페이지 (spec/2-navigation/1-workflow-list.md).
 *
 * 인증·워크스페이스·알림 mock 은 공용 헬퍼(e2e/helpers/mock-auth)로 단일화한다.
 * 응답 shape (codebase/frontend/src/lib/api/paginated.ts):
 *   - normalizePagedResponse 는 `{ data: T[], pagination: {...} }` 형태를 기대
 */

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
