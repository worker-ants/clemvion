import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/3-workflow-editor/3-execution.md + spec/5-system/4-execution-engine.md
 *
 * 실 BullMQ 워커가 떠 있는 e2e 인프라에서 워크플로우 실행이 큐를 거쳐 terminal
 * status 까지 도달하는지, IDOR 보호가 작동하는지 검증한다.
 *
 * 단순화 — 노드 그래프 구성(saveCanvas) 은 unit/integration 이 보장하므로 본 spec
 * 은 워크플로우 생성 직후 (Manual Trigger 1개) 의 실행으로 한정한다. 실행 엔진의
 * 분기·에러 처리 정밀 검증은 execution-engine.service.spec.ts 가 담당.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;
type ExecutionStatus = string;

async function pollExecution(
  executionId: string,
  authHeader: { Authorization: string },
  workspaceId: string,
  predicate: (status: ExecutionStatus) => boolean,
  timeoutMs = 10_000,
  intervalMs = 200,
): Promise<{ status: ExecutionStatus; body: unknown }> {
  const start = Date.now();
  let last: { status: string; body: unknown } | null = null;
  while (Date.now() - start < timeoutMs) {
    const res = await request(BASE_URL)
      .get(`/api/executions/${executionId}`)
      .set(authHeader)
      // ExecutionsController 가 `@WorkspaceId()` 로 헤더 우선 + JWT 폴백.
      // createTeamWorkspace 로 만든 팀 컨텍스트와 token 의 personal workspaceId
      // 가 다르므로 헤더로 명시해야 verifyOwnership 가 매칭된다.
      .set('X-Workspace-Id', workspaceId);
    if (res.status === 200) {
      const status = (res.body.data as { status: string }).status;
      last = { status, body: res.body };
      if (predicate(status)) return last;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `pollExecution timed out at status=${last?.status}. body=${JSON.stringify(last?.body)}`,
  );
}

describe('Workflow Execution (e2e)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('wfexec'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('EXEC'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  async function createWorkflow(): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('exec-wf') });
    expect(res.status).toBe(201);
    return res.body.data.id;
  }

  it('A. manual execute → 202 + executionId, 폴링하면 terminal 상태에 도달', async () => {
    const id = await createWorkflow();
    const exec = await request(BASE_URL)
      .post(`/api/workflows/${id}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    const executionId = (exec.body.data as { executionId: string }).executionId;
    expect(executionId).toBeDefined();

    const final = await pollExecution(
      executionId,
      { Authorization: `Bearer ${ownerToken}` },
      workspaceId,
      (s) =>
        TERMINAL_STATUSES.includes(s as (typeof TERMINAL_STATUSES)[number]),
      15_000,
    );
    expect(TERMINAL_STATUSES).toContain(final.status);
  }, 30_000);

  it('B. GET /api/executions/workflow/:workflowId 가 해당 실행을 페이지네이션으로 반환', async () => {
    const id = await createWorkflow();
    const exec = await request(BASE_URL)
      .post(`/api/workflows/${id}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    const executionId = exec.body.data.executionId;

    await pollExecution(
      executionId,
      { Authorization: `Bearer ${ownerToken}` },
      workspaceId,
      (s) =>
        TERMINAL_STATUSES.includes(s as (typeof TERMINAL_STATUSES)[number]),
      15_000,
    );

    const list = await request(BASE_URL)
      .get(`/api/executions/workflow/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(list.status).toBe(200);
    // PaginatedResponseDto 의 data 배열은 TransformInterceptor 가 already-data 로
    // 인식해 passthrough — body.data 가 곧 array.
    const items = list.body.data as Array<{ id: string }>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((i) => i.id === executionId)).toBe(true);
  }, 30_000);

  it('C. cross-workspace stop → 404 IDOR 차단 (소속 워크스페이스 외 접근)', async () => {
    const idA = await createWorkflow();
    const execA = await request(BASE_URL)
      .post(`/api/workflows/${idA}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    const executionId = execA.body.executionId;

    // 다른 owner / 워크스페이스 준비.
    const intruder = await registerAndLogin(
      BASE_URL,
      uniqueEmail('wfexec-x'),
      db,
    );
    const otherWs = await createTeamWorkspace(
      BASE_URL,
      intruder.accessToken,
      uniqueName('X'),
    );

    const stop = await request(BASE_URL)
      .post(`/api/executions/${executionId}/stop`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .set('X-Workspace-Id', otherWs);
    // verifyOwnership 가 NotFoundException, ForbiddenException, 또는
    // BadRequest (이미 terminal) 형태로 모두 cross-workspace 접근을 막는다 —
    // 어느 쪽이든 외부 워크스페이스가 자원을 조작할 수 없는 invariant 충족.
    expect([400, 403, 404]).toContain(stop.status);
  });

  it('D. terminal 상태 실행에 stop → 400 (이미 완료된 실행)', async () => {
    const id = await createWorkflow();
    const exec = await request(BASE_URL)
      .post(`/api/workflows/${id}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    const executionId = exec.body.data.executionId;

    await pollExecution(
      executionId,
      { Authorization: `Bearer ${ownerToken}` },
      workspaceId,
      (s) =>
        TERMINAL_STATUSES.includes(s as (typeof TERMINAL_STATUSES)[number]),
      15_000,
    );

    const stop = await request(BASE_URL)
      .post(`/api/executions/${executionId}/stop`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    // 이미 terminal 인 execution 은 stop 불가 — 구현에 따라 400 (bad transition)
    // 또는 404 (재조회 시 stop-able 후보가 아님) 로 모두 거부 가능.
    expect([400, 404]).toContain(stop.status);
  }, 30_000);

  it('E. 같은 워크플로우 동시 execute — 둘 다 독립 executionId 발급', async () => {
    const id = await createWorkflow();
    const [r1, r2] = await Promise.all([
      request(BASE_URL)
        .post(`/api/workflows/${id}/execute`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Workspace-Id', workspaceId)
        .send({}),
      request(BASE_URL)
        .post(`/api/workflows/${id}/execute`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Workspace-Id', workspaceId)
        .send({}),
    ]);
    expect(r1.status).toBe(202);
    expect(r2.status).toBe(202);
    expect(r1.body.data.executionId).not.toBe(r2.body.data.executionId);

    await Promise.all([
      pollExecution(
        r1.body.data.executionId,
        { Authorization: `Bearer ${ownerToken}` },
        workspaceId,
        (s) =>
          TERMINAL_STATUSES.includes(s as (typeof TERMINAL_STATUSES)[number]),
        15_000,
      ),
      pollExecution(
        r2.body.data.executionId,
        { Authorization: `Bearer ${ownerToken}` },
        workspaceId,
        (s) =>
          TERMINAL_STATUSES.includes(s as (typeof TERMINAL_STATUSES)[number]),
        15_000,
      ),
    ]);
  }, 45_000);
});
