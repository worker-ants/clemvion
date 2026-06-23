import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: /web-chat 운영 콘솔 (spec/7-channel-web-chat/5-admin-console.md, NAV-WC-01..06).
 *
 * 웹채팅 인스턴스 = interaction 켜진 webhook 트리거. 응답 shape: backend
 * PaginatedResponseDto = `{ data: [...], pagination: {...} }`.
 *
 * 라이브 미리보기 iframe 은 동봉 위젯 + EIA 풀스택 의존이라 mock e2e 범위 밖 — 검증하지 않는다.
 */

const ACCESS = "mock-access-token";
const USER = { id: "user-1", email: "alice@example.com", name: "Alice", locale: "ko", theme: "light" };
const WORKSPACE = { id: "ws-1", name: "Personal", type: "personal", slug: "personal-alice", role: "owner" };

async function mockAuth(page: Page) {
  await page.context().addCookies([{ name: "has_session", value: "1", domain: "localhost", path: "/" }]);
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { accessToken: ACCESS } }) }),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: USER }) }),
  );
  await page.route("**/api/workspaces", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [WORKSPACE] }) })
      : route.continue(),
  );
  await page.route("**/api/notifications/unread-count", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: 0 }) }),
  );
  await page.route(/\/api\/notifications(\?|$)/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }),
  );
}

const WEBCHAT_INSTANCE = {
  id: "t-1",
  name: "고객지원 봇",
  type: "webhook",
  isActive: true,
  workflowId: "wf-1",
  workflowName: "FAQ Bot",
  endpointPath: "endpoint-uuid-abc",
  config: { interaction: { enabled: true, tokenStrategy: "per_execution" } },
};
// interaction 꺼진 webhook — 인스턴스 목록에서 제외돼야 한다.
const PLAIN_WEBHOOK = {
  id: "t-2",
  name: "Plain webhook",
  type: "webhook",
  isActive: true,
  workflowId: "wf-2",
  workflowName: "Other",
  endpointPath: "ep-2",
  config: {},
};

function triggersBody(items: unknown[]) {
  return { data: items, pagination: { page: 1, limit: 100, totalItems: items.length, totalPages: 1 } };
}

async function mockConsole(page: Page, triggers: unknown[]) {
  await page.route(/\/api\/triggers(\?|$)/, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(triggersBody(triggers)) });
    } else if (method === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "t-new", endpointPath: "endpoint-new" } }),
      });
    } else {
      await route.continue();
    }
  });
  await page.route(/\/api\/workflows(\?|$)/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ id: "wf-1", name: "FAQ Bot" }] }) }),
  );
}

test.describe("Web Chat console", () => {
  test("interaction 켜진 webhook 만 인스턴스로 노출 + 설치 스니펫 렌더", async ({ page }) => {
    await mockAuth(page);
    await mockConsole(page, [WEBCHAT_INSTANCE, PLAIN_WEBHOOK]);

    await page.goto("/web-chat");

    // interaction 켜진 것만 목록에 (Plain webhook 제외)
    await expect(page.getByText("고객지원 봇")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Plain webhook")).toHaveCount(0);

    // 첫 인스턴스 자동 선택 → 설치 스니펫(pre)에 endpointPath + ClemvionChat boot 포함
    const snippet = page.locator("pre");
    await expect(snippet).toContainText("endpoint-uuid-abc");
    await expect(snippet).toContainText("ClemvionChat('boot'");
  });

  test("빈 상태에서 '웹채팅 만들기' 다이얼로그 진입 (editor+)", async ({ page }) => {
    await mockAuth(page);
    await mockConsole(page, []);

    await page.goto("/web-chat");

    // 빈 상태 안내
    await expect(page.getByText(/아직 웹채팅이 없|No web chats yet/i)).toBeVisible({ timeout: 15_000 });

    // owner 역할이므로 만들기 버튼 노출 → 클릭 시 다이얼로그(워크플로우 선택 셀렉터)
    await page.getByRole("button", { name: /웹채팅 만들기|New web chat/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // 워크플로우 NativeSelect 에 mock 워크플로우 옵션이 채워졌는지 (option 은 visible 아님 → 텍스트 내용으로 검증)
    await expect(dialog.locator("select")).toContainText("FAQ Bot");
  });
});
