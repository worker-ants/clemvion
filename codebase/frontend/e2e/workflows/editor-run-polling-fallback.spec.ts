import { expect, test, type Page } from "@playwright/test";
import { mockAuth, PAGE_READY_TIMEOUT, WORKSPACE } from "../helpers/mock-auth";

/**
 * e2e: 에디터에서 실행했는데 WebSocket 이 막히면 하단 실행 결과 드로어를
 * REST 폴링(`GET /executions/:id`)이 채운다(CLE-EXEC-RUN, NERV Task CLE-T-KMQ43W).
 *
 * Socket.IO 의 두 전송(websocket · HTTP long-polling)을 모두 막아 구독이 실패하게
 * 하고, 실행 조회 응답만으로 드로어에 노드 목록과 최종 상태가 표시되는지 본다.
 * mock 응답으로 구성하며 실제 backend 에 연결하지 않는다.
 */

const WORKFLOW_ID = "wf-run-fallback";
const EXECUTION_ID = "exec-run-fallback";
const NODE_ID = "node-trigger-1";
const NODE_LABEL = "Manual Trigger";

const json = (data: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ data }),
});

function nodeExecution(status: "running" | "completed") {
  return {
    id: "6d1f2c3a-4b5e-4f60-8a71-92b3c4d5e6f7",
    executionId: EXECUTION_ID,
    nodeId: NODE_ID,
    status,
    startedAt: "2026-10-22T03:00:00.100Z",
    finishedAt: status === "completed" ? "2026-10-22T03:00:00.200Z" : null,
    durationMs: status === "completed" ? 100 : null,
    inputData: {},
    outputData: status === "completed" ? { output: { ok: true } } : null,
    error: null,
    retryCount: 0,
    parentNodeExecutionId: null,
    node: { id: NODE_ID, type: "manual_trigger", label: NODE_LABEL },
  };
}

function execution(status: "running" | "completed") {
  return {
    id: EXECUTION_ID,
    workflowId: WORKFLOW_ID,
    status,
    error: null,
    inputData: {},
    outputData: null,
    startedAt: "2026-10-22T03:00:00.000Z",
    finishedAt: status === "completed" ? "2026-10-22T03:00:00.300Z" : null,
    durationMs: status === "completed" ? 300 : null,
    triggerSource: "manual",
    triggerLabel: null,
    nodeExecutions: [nodeExecution(status)],
  };
}

/** Socket.IO 연결을 전송 방식과 무관하게 모두 실패시킨다. */
async function blockRealtime(page: Page) {
  await page.routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.route("**/socket.io/**", (route) => route.abort());
}

async function mockEditor(page: Page) {
  await page.route(`**/api/workflows/${WORKFLOW_ID}`, (route) =>
    route.fulfill(
      json({ id: WORKFLOW_ID, name: "Polling fallback e2e", workspaceId: WORKSPACE.id }),
    ),
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
  await page.route(`**/api/workflows/${WORKFLOW_ID}/save`, (route) =>
    route.fulfill(json({})),
  );
  await page.route(`**/api/workflows/${WORKFLOW_ID}/execute`, (route) =>
    route.fulfill(json({ executionId: EXECUTION_ID })),
  );
}

test.describe("에디터 실행 패널 — WebSocket 이 막혔을 때 REST 폴링", () => {
  test("구독이 실패해도 폴링으로 노드 목록과 최종 상태를 채운다", async ({ page }) => {
    await mockAuth(page);
    await blockRealtime(page);
    await mockEditor(page);

    // 첫 조회는 실행 중, 이후는 완료 — 폴링이 이어져야 최종 상태까지 간다.
    let executionCalls = 0;
    await page.route(`**/api/executions/${EXECUTION_ID}`, (route) => {
      executionCalls += 1;
      return route.fulfill(json(execution(executionCalls === 1 ? "running" : "completed")));
    });

    await page.clock.install();
    await page.goto(`/w/${WORKSPACE.slug}/workflows/${WORKFLOW_ID}`);
    const runButton = page.getByRole("button", { name: "실행", exact: true });
    await expect(runButton).toBeEnabled({ timeout: PAGE_READY_TIMEOUT });
    await runButton.click();

    // 실행이 시작돼 드로어가 열린 뒤(10초 무수신 타이머가 예약된 뒤)에 시간을 건너뛴다.
    // 막힌 소켓은 재연결 대기 중이라 연결 실패가 언제 다시 올지 정해져 있지 않으므로
    // 10초 타이머로 폴링이 켜지는 시점을 고정한다.
    const drawer = page.locator("[data-run-results-drawer]");
    await expect(drawer.getByRole("status")).toHaveText("실행 중...");
    await page.clock.fastForward(10_000);

    await expect(drawer.getByText(NODE_LABEL).first()).toBeVisible();
    await expect(drawer.getByRole("status")).toHaveText("완료");
    await expect(drawer.getByText("1/1 노드")).toBeVisible();
    expect(executionCalls).toBeGreaterThanOrEqual(2);
  });
});
