import { expect, test, type Page } from "@playwright/test";
import {
  PAGE_READY_TIMEOUT,
  USER,
  makeWorkspace,
  mockAuth,
} from "../helpers/mock-auth";

/**
 * e2e: 통합 화면이 역할과 통합 소유에 맞춰 추가 · 변경 동작을 보이는지 본다.
 *
 * 근거: NERV CLE-INT-MANAGE 「권한」, Task CLE-T-EDQYGH. 서버 쪽 역할 하한은
 * codebase/backend/test/integration-role-floor.e2e-spec.ts 가 보고, 이 스펙은 실제 라우트에서 화면이
 * 같은 규칙으로 버튼을 숨기는지 본다. 판정 표 전체는 unit(`integration-permissions.test.ts`)이 맡는다.
 */

const SLUG = makeWorkspace().slug;
const INTEGRATION_ID = "int-role-1";

/** 목록 · 서비스 카탈로그 · 상세 응답을 mock 한다. 상세는 주어진 통합 하나를 돌려준다. */
async function mockIntegrations(
  page: Page,
  integration?: { scope: "personal" | "organization"; createdBy: string },
) {
  await page.route("**/api/integrations/services", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route(/\/api\/integrations(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
      }),
    }),
  );
  if (!integration) return;
  await page.route(`**/api/integrations/${INTEGRATION_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: INTEGRATION_ID,
          workspaceId: "ws-1",
          serviceType: "http",
          name: "Role Gate API",
          authType: "api_key",
          credentials: {},
          scope: integration.scope,
          status: "connected",
          statusReason: null,
          credentialsStatus: "ok",
          tokenExpiresAt: null,
          lastUsedAt: null,
          lastRotatedAt: null,
          lastError: null,
          autoRefresh: false,
          meta: { appType: null },
          appUrl: null,
          createdBy: integration.createdBy,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      }),
    }),
  );
}

test.describe("통합 화면의 역할 게이트", () => {
  test("뷰어에게는 추가 버튼이 없고 N 키로도 서비스 선택 창이 열리지 않는다", async ({
    page,
  }) => {
    await mockAuth(page, { role: "viewer" });
    await mockIntegrations(page);

    await page.goto(`/w/${SLUG}/integrations`);
    await expect(page.getByText("아직 통합이 없어요")).toBeVisible({
      timeout: PAGE_READY_TIMEOUT,
    });

    await expect(page.getByRole("button", { name: /통합 추가/ })).toHaveCount(
      0,
    );
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("편집자는 N 키로 서비스 선택 창을 연다", async ({ page }) => {
    await mockAuth(page, { role: "editor" });
    await mockIntegrations(page);

    await page.goto(`/w/${SLUG}/integrations`);
    await expect(page.getByText("아직 통합이 없어요")).toBeVisible({
      timeout: PAGE_READY_TIMEOUT,
    });

    await page.keyboard.press("n");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("뷰어가 추가 화면 주소로 들어오면 안내와 목록 링크만 보인다", async ({
    page,
  }) => {
    await mockAuth(page, { role: "viewer" });
    await mockIntegrations(page);

    await page.goto(`/w/${SLUG}/integrations/new`);
    await expect(
      page.getByText("통합 추가는 편집자 이상만 할 수 있어요."),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    await expect(
      page.getByRole("link", { name: /통합 목록으로/ }),
    ).toBeVisible();
  });

  test("편집자는 조직 통합 상세에서 수정 버튼과 위험 영역 탭을 보지 못한다", async ({
    page,
  }) => {
    await mockAuth(page, { role: "editor" });
    await mockIntegrations(page, { scope: "organization", createdBy: USER.id });

    await page.goto(`/w/${SLUG}/integrations/${INTEGRATION_ID}`);
    await expect(
      page.getByRole("heading", { name: "Role Gate API" }),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });

    // 연결 테스트는 조회라 누구에게나 보인다.
    await expect(
      page.getByRole("button", { name: "연결 테스트" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "수정" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "위험 영역" })).toHaveCount(
      0,
    );
  });

  test("관리자는 조직 통합 상세에서 수정 버튼과 위험 영역 탭을 본다", async ({
    page,
  }) => {
    await mockAuth(page, { role: "admin" });
    await mockIntegrations(page, {
      scope: "organization",
      createdBy: "user-other",
    });

    await page.goto(`/w/${SLUG}/integrations/${INTEGRATION_ID}`);
    await expect(
      page.getByRole("heading", { name: "Role Gate API" }),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });

    await expect(page.getByRole("button", { name: "수정" })).toBeVisible();
    await expect(page.getByRole("button", { name: "위험 영역" })).toBeVisible();
  });
});
