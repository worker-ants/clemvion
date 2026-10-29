import { expect, test, type Page } from "@playwright/test";
import { mockAuth, PAGE_READY_TIMEOUT, USER, WORKSPACE } from "../helpers/mock-auth";

/**
 * e2e: 버전을 복원하면서 서버가 쓸 수 없는 통합 참조를 비웠으면, 에디터를 다시
 * 불러온 뒤 그 노드 레이블을 담은 경고 토스트가 뜬다(REQ-WFVER-027, NERV Task CLE-T-1BQZ10).
 *
 * 복원 직후 `window.location.reload()` 로 메모리 상태가 사라지므로 비운 목록은
 * sessionStorage 로 넘긴다. 이 스펙은 그 인계가 실제 새로고침을 넘어 이어지는지 본다.
 * mock 응답으로 구성하며 실제 backend 에 연결하지 않는다.
 */

const WORKFLOW_ID = "wf-restore-cleared";
const NODE_ID = "node-trigger-1";
const NODE_LABEL = "Manual Trigger";
const CLEARED_LABEL = "Send mail";

const json = (data: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ data }),
});

const VERSIONS = [2, 1].map((version) => ({
  id: `ver-${version}`,
  workflowId: WORKFLOW_ID,
  version,
  changeSummary: null,
  createdBy: USER.id,
  createdAt: `2026-10-2${version}T03:00:00.000Z`,
  creator: { id: USER.id, name: USER.name, email: USER.email },
}));

async function mockEditor(page: Page) {
  const workflow = {
    id: WORKFLOW_ID,
    name: "Restore warning e2e",
    workspaceId: WORKSPACE.id,
    createdBy: USER.id,
  };
  await page.route(`**/api/workflows/${WORKFLOW_ID}`, (route) =>
    route.fulfill(json(workflow)),
  );
  await page.route(`**/api/workflows/${WORKFLOW_ID}/nodes`, (route) =>
    route.fulfill(
      json([
        {
          id: NODE_ID,
          workflowId: WORKFLOW_ID,
          type: "manual_trigger",
          category: "trigger",
          label: NODE_LABEL,
          config: {},
          positionX: 200,
          positionY: 200,
          isDisabled: false,
          containerId: null,
        },
      ]),
    ),
  );
  await page.route(`**/api/workflows/${WORKFLOW_ID}/edges`, (route) =>
    route.fulfill(json([])),
  );
  await page.route("**/api/nodes/definitions", (route) =>
    route.fulfill(
      json({
        definitions: [
          {
            metadata: {
              type: "manual_trigger",
              category: "trigger",
              label: NODE_LABEL,
              description: "",
              icon: "play",
              color: "#22c55e",
            },
            ports: { inputs: [], outputs: [{ id: "out", label: "Out", type: "data" }] },
            configSchema: { type: "object", properties: {} },
            defaultConfig: {},
          },
        ],
        categories: [],
      }),
    ),
  );
  await page.route(`**/api/workflows/${WORKFLOW_ID}/versions`, (route) =>
    route.fulfill(json(VERSIONS)),
  );
}

test.describe("버전 복원 — 비운 통합 참조 경고", () => {
  test("복원으로 비운 노드를 새로고침 뒤 경고 토스트로 알린다", async ({ page }) => {
    await mockAuth(page);
    await mockEditor(page);

    let restoreCalls = 0;
    await page.route(`**/api/workflows/${WORKFLOW_ID}/versions/ver-1/restore`, (route) => {
      restoreCalls += 1;
      return route.fulfill(
        json({
          workflow: { id: WORKFLOW_ID },
          nodes: [],
          edges: [],
          clearedIntegrationRefs: [
            { nodeId: "node-mail", nodeLabel: CLEARED_LABEL, field: "config.integrationId" },
          ],
        }),
      );
    });

    await page.goto(`/w/${WORKSPACE.slug}/workflows/${WORKFLOW_ID}`);
    const moreMenu = page.getByTestId("editor-toolbar-more-menu");
    await expect(moreMenu).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    await moreMenu.click();
    await page.getByRole("button", { name: "버전 기록" }).click();

    const panel = page.getByTestId("version-history-panel");
    await panel.getByRole("button", { name: "v1 복원" }).click();
    const dialog = page.getByRole("dialog", { name: "복원 확인" });

    // 복원 응답 뒤 페이지 전체가 다시 불러와진다.
    await Promise.all([
      page.waitForEvent("load"),
      dialog.getByRole("button", { name: "복원", exact: true }).click(),
    ]);

    await expect(
      page.getByText(new RegExp(`복원하면서 ${CLEARED_LABEL} 노드의 통합 선택을 비웠어요`)),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    expect(restoreCalls).toBe(1);

    // 경고는 한 번만 뜬다. 다시 불러와도 남은 목록이 없다.
    // 캔버스에 노드가 보이면 로더가 워크플로우를 받아 경고 여부를 이미 판정한 뒤다.
    await page.reload();
    await expect(page.getByText(NODE_LABEL).first()).toBeVisible({
      timeout: PAGE_READY_TIMEOUT,
    });
    await expect(page.getByText(/복원하면서/)).toHaveCount(0);
  });
});
