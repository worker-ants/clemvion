import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: Execution 상세 페이지 (`/workflows/[id]/executions/[executionId]`) 의
 * Background 노드 카드에서 본문 실행 결과 섹션이 노출되는지 검증한다.
 * spec/3-workflow-editor/3-execution.md §10.15.
 *
 * mock 응답으로 구성 — 실 backend 연결 없이 Run Results 표시 계층만 검증.
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

const WORKFLOW_ID = "wf-bg-1";
const EXECUTION_ID = "exec-bg-1";
const BACKGROUND_NODE_EXEC_ID = "ne-bg-1";
const BACKGROUND_RUN_ID = "8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234";

async function mockAuth(page: Page) {
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
}

async function mockWorkflowAndExecution(page: Page) {
  await page.route(`**/api/workflows/${WORKFLOW_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: WORKFLOW_ID,
          name: "Background e2e workflow",
          workspaceId: WORKSPACE.id,
        },
      }),
    });
  });

  // Adjacent executions query — 인접 navigation. 빈 리스트로 fall-through.
  await page.route(
    new RegExp(`/api/executions/workflow/${WORKFLOW_ID}(\\?|$)`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0 },
        }),
      });
    },
  );

  // 메인 execution 응답 — Background 노드 1개 포함.
  await page.route(`**/api/executions/${EXECUTION_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: EXECUTION_ID,
          workflowId: WORKFLOW_ID,
          status: "completed",
          startedAt: "2026-05-15T05:04:37.000Z",
          finishedAt: "2026-05-15T05:04:37.500Z",
          durationMs: 500,
          triggerSource: "manual",
          triggerLabel: "Manual",
          nodeExecutions: [
            {
              id: BACKGROUND_NODE_EXEC_ID,
              executionId: EXECUTION_ID,
              nodeId: "bg-node-1",
              status: "completed",
              startedAt: "2026-05-15T05:04:37.000Z",
              finishedAt: "2026-05-15T05:04:37.100Z",
              durationMs: 100,
              inputData: {},
              outputData: {
                config: { notifyOnFailure: true, maxDurationMs: 300000 },
                output: {},
                meta: {
                  durationMs: 0,
                  backgroundRunId: BACKGROUND_RUN_ID,
                  forkedAt: "2026-05-15T05:04:37.123Z",
                },
                port: "main",
              },
              error: null,
              retryCount: 0,
              parentNodeExecutionId: null,
              node: {
                id: "bg-node-1",
                type: "background",
                label: "Background",
              },
            },
          ],
        },
      }),
    });
  });
}

async function mockBackgroundRun(page: Page) {
  await page.route(
    `**/api/executions/${EXECUTION_ID}/background-runs/${BACKGROUND_RUN_ID}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            backgroundRunId: BACKGROUND_RUN_ID,
            executionId: EXECUTION_ID,
            parentNodeExecutionId: BACKGROUND_NODE_EXEC_ID,
            status: "completed",
            startedAt: "2026-05-15T05:04:37.123Z",
            completedAt: "2026-05-15T05:04:42.000Z",
            durationMs: 4877,
            nodeExecutions: {
              data: [
                {
                  id: "ne-body-1",
                  executionId: EXECUTION_ID,
                  nodeId: "code-node",
                  parentNodeExecutionId: BACKGROUND_NODE_EXEC_ID,
                  status: "completed",
                  startedAt: "2026-05-15T05:04:38.000Z",
                  finishedAt: "2026-05-15T05:04:42.000Z",
                  durationMs: 4000,
                  inputData: null,
                  outputData: null,
                  error: null,
                },
              ],
              nextCursor: null,
              hasMore: false,
            },
            notifications: [],
          },
        }),
      });
    },
  );
}

test("Execution 상세 페이지에서 Background 노드 선택 시 본문 실행 결과 섹션 표시", async ({
  page,
}) => {
  await mockAuth(page);
  await mockWorkflowAndExecution(page);
  await mockBackgroundRun(page);

  await page.goto(`/workflows/${WORKFLOW_ID}/executions/${EXECUTION_ID}`);

  // Background 노드 카드 선택. 페이지 헤딩 ("Background e2e workflow — 실행
  // 상세") 도 "Background" 텍스트를 포함하므로 노드 리스트의 버튼만 골라
  // 클릭. ResultDetail 컴포넌트가 nodeButton 으로 렌더링된다.
  await page.getByRole("button", { name: /^Background\s/ }).click();

  // BackgroundRunSection 의 핵심 표식 — `Background body run` 헤더.
  await expect(
    page.getByRole("heading", { name: /Background body run/i }),
  ).toBeVisible({ timeout: 5000 });

  // Run ID 표시 확인 — backgroundRunId 가 그대로 노출.
  await expect(page.getByText(`Run ID: ${BACKGROUND_RUN_ID}`)).toBeVisible();

  // 본문 노드 1개가 리스트에 표시되는지.
  await expect(page.getByText("Body nodes (1)")).toBeVisible();
  await expect(page.getByText("code-node")).toBeVisible();

  // status 뱃지: "Completed".
  await expect(page.getByText("Completed").first()).toBeVisible();
});

test("Background 노드여도 backgroundRunId 부재(legacy)면 본문 섹션 미렌더", async ({
  page,
}) => {
  await mockAuth(page);

  // outputData.meta.backgroundRunId 가 부재한 옛 NodeExecution 만 포함.
  await page.route(`**/api/workflows/${WORKFLOW_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: WORKFLOW_ID,
          name: "Legacy Background workflow",
          workspaceId: WORKSPACE.id,
        },
      }),
    });
  });
  await page.route(
    new RegExp(`/api/executions/workflow/${WORKFLOW_ID}(\\?|$)`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0 },
        }),
      });
    },
  );
  await page.route(`**/api/executions/${EXECUTION_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: EXECUTION_ID,
          workflowId: WORKFLOW_ID,
          status: "completed",
          startedAt: "2026-05-15T05:04:37.000Z",
          finishedAt: "2026-05-15T05:04:37.500Z",
          durationMs: 500,
          triggerSource: "manual",
          triggerLabel: "Manual",
          nodeExecutions: [
            {
              id: BACKGROUND_NODE_EXEC_ID,
              executionId: EXECUTION_ID,
              nodeId: "bg-node-1",
              status: "completed",
              startedAt: "2026-05-15T05:04:37.000Z",
              finishedAt: "2026-05-15T05:04:37.100Z",
              durationMs: 100,
              inputData: {},
              // outputData 에 meta.backgroundRunId 가 없는 옛 row.
              outputData: { config: {}, output: {}, port: "main" },
              error: null,
              retryCount: 0,
              parentNodeExecutionId: null,
              node: {
                id: "bg-node-1",
                type: "background",
                label: "Background",
              },
            },
          ],
        },
      }),
    });
  });
  // Background API 는 호출되지 않아야 함 — 호출되면 의도 위반.
  let bgApiHit = false;
  await page.route(
    `**/api/executions/${EXECUTION_ID}/background-runs/**`,
    async (route) => {
      bgApiHit = true;
      await route.fulfill({ status: 404, body: "{}" });
    },
  );

  await page.goto(`/workflows/${WORKFLOW_ID}/executions/${EXECUTION_ID}`);
  await page.getByRole("button", { name: /^Background\s/ }).click();

  // 본문 섹션이 노출되지 않아야 한다.
  await expect(
    page.getByRole("heading", { name: /Background body run/i }),
  ).toHaveCount(0);
  expect(bgApiHit).toBe(false);
});
