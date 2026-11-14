import { expect, test, type Page } from "@playwright/test";
import { mockAuth, PAGE_READY_TIMEOUT, WORKSPACE } from "../helpers/mock-auth";

/**
 * e2e: 에디터에서 실행했는데 WebSocket 이 막히면 하단 실행 결과 드로어를
 * REST 폴링(`GET /executions/:id`)이 채운다(CLE-EXEC-RUN, NERV Task CLE-T-KMQ43W).
 *
 * Socket.IO 의 두 전송(websocket · HTTP long-polling)을 모두 막아 구독이 실패하게
 * 하고, 실행 조회 응답만으로 드로어에 노드 목록과 최종 상태가 표시되는지 본다.
 * mock 응답으로 구성하며 실제 backend 에 연결하지 않는다.
 *
 * 입력 대기(CLE-T-5P1ADY): 소켓이 끊겨 있으면 폼은 REST `POST /executions/:id/continue`
 * 로 보내고, 버튼 · 대화 · 재시도는 보내지 않고 안내한다.
 * 마지막 턴 재시도를 폴링으로 따라가는 경로(CLE-T-GKVH1B)는 이 파일에서 다루지 않는다.
 * 재시도 명령은 소켓 연결이 있어야 보내지고, 소켓을 막으면 재시도 버튼부터 보낼 수 없다.
 * 그 경로는 단위 테스트(apply-execution-snapshot · use-execution-polling-fallback)가 맡는다.
 */

const WORKFLOW_ID = "wf-run-fallback";
const EXECUTION_ID = "exec-run-fallback";
const NODE_ID = "node-trigger-1";
const NODE_LABEL = "Manual Trigger";
/** 폴링 대체 경로의 요청 간격(`use-execution-polling-fallback.ts` 의 `EXECUTION_POLL_INTERVAL_MS`). */
const EXECUTION_POLL_INTERVAL_MS = 2_000;

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

/** 입력 대기 노드의 드로어 분류(presentation)를 정하는 최소 노드 정의. */
function presentationDefinition(type: string, label: string) {
  return {
    metadata: {
      type,
      category: "presentation",
      label,
      description: "",
      icon: "layout",
      color: "#6366f1",
    },
    ports: {
      inputs: [{ id: "in", label: "In", type: "data" }],
      outputs: [{ id: "out", label: "Out", type: "data" }],
    },
    configSchema: { type: "object", properties: {} },
    defaultConfig: {},
  };
}

const WAITING_NODE_ID = "node-waiting-1";

/** 트리거는 끝났고 두 번째 노드가 입력을 기다리는(또는 그 뒤 끝난) 실행. */
function inputWaitExecution(
  waitingNode: {
    type: "form" | "template";
    label: string;
    config: Record<string, unknown>;
    interactionType: "form" | "buttons";
  },
  status: "waiting_for_input" | "completed",
) {
  const done = status === "completed";
  const waitingRow = {
    id: "7e2a3b4c-5d6e-4f70-8b81-a2c3d4e5f607",
    executionId: EXECUTION_ID,
    nodeId: WAITING_NODE_ID,
    status,
    startedAt: "2026-10-22T03:00:00.200Z",
    finishedAt: done ? "2026-10-22T03:00:05.000Z" : null,
    durationMs: done ? 4800 : null,
    inputData: {},
    outputData: done
      ? { config: waitingNode.config, output: { comment: "승인합니다" }, status: "completed" }
      : {
          config: waitingNode.config,
          output: {},
          status: "waiting_for_input",
          meta: { interactionType: waitingNode.interactionType },
        },
    error: null,
    retryCount: 0,
    parentNodeExecutionId: null,
    node: { id: WAITING_NODE_ID, type: waitingNode.type, label: waitingNode.label },
  };
  return {
    ...execution("completed"),
    status,
    finishedAt: done ? "2026-10-22T03:00:05.100Z" : null,
    durationMs: done ? 5100 : null,
    nodeExecutions: [nodeExecution("completed"), waitingRow],
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
          presentationDefinition("form", "Form"),
          presentationDefinition("template", "Template"),
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

    // 첫 폴링 응답(실행 중)이 반영된 뒤 폴링 간격만큼 건너뛰어 다음 요청(완료)을 바로 보낸다.
    await expect(drawer.getByText(NODE_LABEL).first()).toBeVisible();
    await page.clock.fastForward(EXECUTION_POLL_INTERVAL_MS);
    await expect(drawer.getByRole("status")).toHaveText("완료");
    await expect(drawer.getByText("1/1 노드")).toBeVisible();
    expect(executionCalls).toBeGreaterThanOrEqual(2);
  });
});

test.describe("에디터 실행 패널 — 소켓이 끊긴 채 입력을 기다릴 때", () => {
  /** 실행을 시작하고 10초 무수신 타이머를 넘겨 폴링이 입력 대기를 채우게 한다. */
  async function runUntilWaiting(page: Page) {
    await page.clock.install();
    await page.goto(`/w/${WORKSPACE.slug}/workflows/${WORKFLOW_ID}`);
    const runButton = page.getByRole("button", { name: "실행", exact: true });
    await expect(runButton).toBeEnabled({ timeout: PAGE_READY_TIMEOUT });
    await runButton.click();

    const drawer = page.locator("[data-run-results-drawer]");
    await expect(drawer.getByRole("status")).toHaveText("실행 중...");
    await page.clock.fastForward(10_000);
    await expect(drawer.getByRole("status")).toHaveText("입력 대기 중...");
    return drawer;
  }

  test("폼은 REST 로 제출하고 이어 진행된 결과를 폴링으로 받는다", async ({ page }) => {
    await mockAuth(page);
    await blockRealtime(page);
    await mockEditor(page);

    const form = {
      type: "form" as const,
      label: "승인 요청",
      interactionType: "form" as const,
      config: {
        title: "승인 요청",
        fields: [{ name: "comment", type: "text", label: "의견" }],
        submitLabel: "제출",
      },
    };
    const continueBodies: unknown[] = [];
    await page.route(`**/api/executions/${EXECUTION_ID}/continue`, (route) => {
      continueBodies.push(route.request().postDataJSON());
      return route.fulfill(json({ success: true }));
    });
    // 제출이 접수된 뒤의 조회는 완료로 바뀐다(워커가 곧바로 이어 진행한 것으로 본다).
    await page.route(`**/api/executions/${EXECUTION_ID}`, (route) =>
      route.fulfill(
        json(
          inputWaitExecution(
            form,
            continueBodies.length > 0 ? "completed" : "waiting_for_input",
          ),
        ),
      ),
    );

    const drawer = await runUntilWaiting(page);
    await drawer.getByLabel("의견").fill("승인합니다");
    await drawer.getByRole("button", { name: "제출" }).click();

    await expect.poll(() => continueBodies).toEqual([
      { formData: { comment: "승인합니다" } },
    ]);
    // 제출이 접수된 뒤 폴링 간격만큼 건너뛰어 다음 조회(완료)를 바로 보낸다.
    await page.clock.fastForward(EXECUTION_POLL_INTERVAL_MS);
    await expect(drawer.getByRole("status")).toHaveText("완료");
    await expect(drawer.getByText("2/2 노드")).toBeVisible();
  });

  test("버튼은 보내지 않고 연결이 돌아온 뒤 다시 하라고 안내한다", async ({ page }) => {
    await mockAuth(page);
    await blockRealtime(page);
    await mockEditor(page);

    const buttons = {
      type: "template" as const,
      label: "결재 선택",
      interactionType: "buttons" as const,
      config: {
        outputFormat: "text",
        buttonConfig: {
          buttons: [{ id: "approve", label: "승인", type: "port" }],
        },
      },
    };
    let continueCalls = 0;
    await page.route(`**/api/executions/${EXECUTION_ID}/continue`, (route) => {
      continueCalls += 1;
      return route.fulfill(json({ success: true }));
    });
    await page.route(`**/api/executions/${EXECUTION_ID}`, (route) =>
      route.fulfill(json(inputWaitExecution(buttons, "waiting_for_input"))),
    );

    const drawer = await runUntilWaiting(page);
    await drawer.getByRole("button", { name: "승인", exact: true }).click();

    await expect(
      page.getByText(
        "실시간 연결이 끊겨 있어 지금은 이 입력을 보낼 수 없어요. 연결이 돌아오면 다시 시도해 주세요.",
      ),
    ).toBeVisible();
    // 보내지 않았으니 입력 대기도 그대로이고 버튼도 남아 있다.
    await expect(drawer.getByRole("status")).toHaveText("입력 대기 중...");
    await expect(drawer.getByRole("button", { name: "승인", exact: true })).toBeVisible();
    expect(continueCalls).toBe(0);
  });
});
