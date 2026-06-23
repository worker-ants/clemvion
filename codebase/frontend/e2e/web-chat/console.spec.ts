import { expect, test, type Page } from "@playwright/test";
import { mockAuth, PAGE_READY_TIMEOUT } from "../helpers/mock-auth";

/**
 * e2e: /web-chat 운영 콘솔 (spec/7-channel-web-chat/5-admin-console.md, NAV-WC-01..06).
 *
 * 웹채팅 인스턴스 = interaction 켜진 webhook 트리거. 응답 shape: backend
 * PaginatedResponseDto = `{ data: [...], pagination: {...} }`.
 *
 * 라이브 미리보기 iframe 은 동봉 위젯 + EIA 풀스택 의존이라 mock e2e 범위 밖 — 검증하지 않는다.
 */

const DIALOG_TIMEOUT = 10_000;

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

/**
 * 트리거 목록/생성 mock. POST 는 stateful — 생성 시 새 webhook+interaction 트리거를 목록에 추가해
 * 이어지는 GET 재조회(invalidate)에서 노출되게 한다(생성 happy-path 검증용).
 */
async function mockConsole(page: Page, initial: Record<string, unknown>[]) {
  const triggers = [...initial];
  await page.route(/\/api\/triggers(\?|$)/, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(triggersBody(triggers)) });
    } else if (method === "POST") {
      const body = route.request().postDataJSON() as { name?: string; workflowId?: string };
      triggers.push({
        id: "t-new",
        name: body?.name ?? "새 웹채팅",
        type: "webhook",
        isActive: true,
        workflowId: body?.workflowId ?? "wf-1",
        workflowName: "FAQ Bot",
        endpointPath: "endpoint-new",
        config: { interaction: { enabled: true, tokenStrategy: "per_execution" } },
      });
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
    await expect(page.getByText("고객지원 봇")).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    await expect(page.getByText("Plain webhook")).toHaveCount(0);

    // 첫 인스턴스 자동 선택 → 설치 스니펫(testid)에 endpointPath + ClemvionChat boot 포함
    const snippet = page.getByTestId("web-chat-install-snippet");
    await expect(snippet).toContainText("endpoint-uuid-abc");
    await expect(snippet).toContainText("ClemvionChat('boot'");
  });

  test("빈 상태에서 '웹채팅 만들기' → 생성 → 목록·스니펫 갱신 (editor+)", async ({ page }) => {
    await mockAuth(page);
    await mockConsole(page, []);

    await page.goto("/web-chat");

    // 빈 상태 안내
    await expect(page.getByText(/아직 웹채팅이 없|No web chats yet/i)).toBeVisible({ timeout: PAGE_READY_TIMEOUT });

    // 만들기 다이얼로그 진입 (owner 역할)
    await page.getByRole("button", { name: /웹채팅 만들기|New web chat/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: DIALOG_TIMEOUT });

    // 워크플로우 선택 + 이름 입력 → 제출
    await dialog.locator("#wc-create-workflow").selectOption("wf-1");
    await dialog.locator("#wc-create-name").fill("신규 봇");
    await dialog.getByRole("button", { name: /^만들기$|^Create$/i }).click();

    // 생성 후 목록에 신규 인스턴스 노출 + 자동 선택 → 신규 endpointPath 스니펫 렌더
    await expect(page.getByText("신규 봇")).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    await expect(page.getByTestId("web-chat-install-snippet")).toContainText("endpoint-new");
  });

  test("viewer 는 '웹채팅 만들기' 버튼이 보이지 않는다 (RoleGate)", async ({ page }) => {
    await mockAuth(page, { role: "viewer" });
    await mockConsole(page, [WEBCHAT_INSTANCE]);

    await page.goto("/web-chat");

    // 인스턴스는 보이되(viewer 도 조회 가능)
    await expect(page.getByText("고객지원 봇")).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    // 생성 버튼은 editor+ 전용 → viewer 에게 비노출
    await expect(page.getByRole("button", { name: /웹채팅 만들기|New web chat/i })).toHaveCount(0);
  });
});
