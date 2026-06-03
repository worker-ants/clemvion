import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';

/**
 * e2e: spec/5-system/13-replay-rerun.md §8 (Re-run) — 실 인프라(BullMQ 워커 + Postgres)
 * 위에서 다음 계약을 검증한다.
 *
 *   POST /api/executions/:id/re-run  → 201 + 새 ExecutionDetail (reRunOf / chainId / dryRun)
 *   GET  /api/executions/:id/chain   → 200 + chain(started_at ASC), original + re-run 포함
 *
 * 검증 대상 invariants:
 *   A. useOriginalInput(기본) → 새 실행 생성, reRunOf == 원본 id, chainId 세팅, dryRun=false
 *   B. inputOverride(useOriginalInput=false) → 새 실행 inputData 가 manual trigger 형태로 재구성
 *   C. dryRun=true (부수효과 노드 없는 워크플로) → 201 dryRun=true (assertDryRunSupported 통과)
 *   D. GET chain → started_at ASC 로 original + re-run 모두 반환, chainId 공유
 *   E. cross-workspace re-run → 404 RERUN_EXECUTION_NOT_FOUND (IDOR / ID enumeration 차단)
 *
 * dry-run 노드 출력(`_dryRun: true`) 주의:
 *   `_dryRun: true` mock 출력은 INTEGRATION(외부 부수효과) 노드가 dry-run 모드일 때만
 *   생성된다(http-request 등). 본 e2e 의 bare 워크플로(Manual Trigger 1개)는 부수효과
 *   노드가 없어 assertDryRunSupported 를 통과하지만 `_dryRun` mock 출력을 낼 노드가
 *   없다. 따라서 C 는 execution 레벨 dryRun 플래그(201 / body.dryRun / DB dry_run=true)
 *   까지만 검증한다. 노드 레벨 `_dryRun: true` mock 은 dry-run.util 의 unit/integration
 *   spec 이 담당.
 *
 * 단순화 — 노드 그래프 구성(saveCanvas) 은 unit/integration 이 보장하므로 본 spec 은
 * 워크플로우 생성 직후(Manual Trigger 1개)의 실행으로 한정한다. re-run 의 입력/권한/
 * chain 계약 정밀 검증은 executions-rerun.service.spec.ts 가 담당.
 *
 * RR-PL-06 (403 RERUN_PERMISSION_DENIED) 주의:
 *   서비스의 owner/admin 판정(isOwnerOrAdmin)은 JwtPayload.role 을 사용하는데, 이 role
 *   은 JwtStrategy 가 사용자의 **개인 워크스페이스** 멤버십에서 도출한다(항상 'owner').
 *   따라서 표준 HTTP 인증 경로로는 어떤 사용자도 isOwnerOrAdmin → true 가 되어 403 이
 *   재현되지 않는다. 이 e2e 는 따라서 403 을 강제하지 않고, cross-workspace 격리(404, E)
 *   로 IDOR 불변식을 검증한다. (해당 quirk 는 service unit spec 의 모킹된 role 로만 도달)
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;
type ExecutionStatus = string;

async function pollExecution(
  executionId: string,
  authToken: string,
  workspaceId: string,
  predicate: (status: ExecutionStatus) => boolean,
  timeoutMs = 15_000,
  intervalMs = 200,
): Promise<{
  status: ExecutionStatus;
  body: { data: Record<string, unknown> };
}> {
  const start = Date.now();
  let last: { status: string; body: { data: Record<string, unknown> } } | null =
    null;
  while (Date.now() - start < timeoutMs) {
    const res = await request(BASE_URL)
      .get(`/api/executions/${executionId}`)
      .set('Authorization', `Bearer ${authToken}`)
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

const isTerminal = (s: ExecutionStatus): boolean =>
  TERMINAL_STATUSES.includes(s as (typeof TERMINAL_STATUSES)[number]);

describe('Execution Re-run (e2e)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('rerun'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('RERUN'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  async function createWorkflow(
    token = ownerToken,
    ws = workspaceId,
  ): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', ws)
      .send({ name: uniqueName('rerun-wf') });
    expect(res.status).toBe(201);
    return res.body.data.id;
  }

  /** 워크플로우를 만들고 한 번 실행해 terminal 상태까지 도달한 executionId 를 회수. */
  async function createAndRunWorkflow(): Promise<{
    workflowId: string;
    executionId: string;
  }> {
    const workflowId = await createWorkflow();
    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    const executionId = (exec.body.data as { executionId: string }).executionId;
    expect(executionId).toBeDefined();
    await pollExecution(executionId, ownerToken, workspaceId, isTerminal);
    return { workflowId, executionId };
  }

  it('A. re-run (useOriginalInput) → 201 + 새 실행, reRunOf == 원본, chainId 세팅, dryRun=false', async () => {
    const { executionId } = await createAndRunWorkflow();

    const res = await request(BASE_URL)
      .post(`/api/executions/${executionId}/re-run`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ useOriginalInput: true });

    expect(res.status).toBe(201);
    const body = res.body.data as {
      id: string;
      reRunOf: string;
      chainId: string;
      dryRun: boolean;
    };
    expect(body.id).toBeDefined();
    expect(body.id).not.toBe(executionId);
    expect(body.reRunOf).toBe(executionId);
    // 원본이 chain root 이므로 chainId 는 원본 id 와 동일.
    expect(body.chainId).toBe(executionId);
    expect(body.dryRun).toBe(false);

    // 새 실행이 실제 DB 에 별도 row 로 존재하고 re_run_of 가 영속됐는지 확인.
    const row = await db.query<{
      re_run_of: string | null;
      chain_id: string | null;
    }>('SELECT re_run_of, chain_id FROM execution WHERE id = $1', [body.id]);
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].re_run_of).toBe(executionId);
    expect(row.rows[0].chain_id).toBe(executionId);
  }, 45_000);

  it('B. re-run (inputOverride, useOriginalInput=false) → 201 + inputData 가 manual trigger 형태로 재구성', async () => {
    const { executionId } = await createAndRunWorkflow();

    const res = await request(BASE_URL)
      .post(`/api/executions/${executionId}/re-run`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        useOriginalInput: false,
        inputOverride: { foo: 'bar', count: 7 },
      });

    expect(res.status).toBe(201);
    const body = res.body.data as {
      id: string;
      reRunOf: string;
      inputData?: Record<string, unknown> | null;
    };
    expect(body.reRunOf).toBe(executionId);

    // useOriginalInput=false 경로는 executionInput 을
    // { __triggerSource: 'manual', parameters } 로 재구성한다 (service §292-317).
    // bare 워크플로우(파라미터 스키마 없음)에선 parameters 가 {} 로 정규화되지만,
    // manual trigger envelope 형태 자체는 계약으로 보장된다.
    const input = body.inputData ?? {};
    expect(input.__triggerSource).toBe('manual');
    expect(input).toHaveProperty('parameters');
    expect(typeof input.parameters).toBe('object');
  }, 45_000);

  it('C. dryRun=true (부수효과 노드 없는 워크플로) → 201 + dryRun=true (assertDryRunSupported 통과)', async () => {
    const { executionId } = await createAndRunWorkflow();

    const res = await request(BASE_URL)
      .post(`/api/executions/${executionId}/re-run`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ dryRun: true });

    // bare 워크플로(Manual Trigger 만)는 INTEGRATION 부수효과 노드가 없어
    // assertDryRunSupported 를 통과한다 → dry-run 실행 생성 (201).
    expect(res.status).toBe(201);
    const body = res.body.data as {
      id: string;
      reRunOf: string;
      chainId: string;
      dryRun: boolean;
    };
    expect(body.dryRun).toBe(true);
    expect(body.reRunOf).toBe(executionId);
    expect(body.chainId).toBe(executionId);

    // execution.dry_run 이 DB 에 영속됐는지 확인.
    const row = await db.query<{ dry_run: boolean }>(
      'SELECT dry_run FROM execution WHERE id = $1',
      [body.id],
    );
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].dry_run).toBe(true);

    // dry-run 실행도 동일 chain 에 포함된다.
    await pollExecution(body.id, ownerToken, workspaceId, isTerminal);
    const chain = await request(BASE_URL)
      .get(`/api/executions/${executionId}/chain`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(chain.status).toBe(200);
    const items = chain.body.data as Array<{ id: string; dryRun?: boolean }>;
    const ids = items.map((i) => i.id);
    expect(ids).toContain(executionId);
    expect(ids).toContain(body.id);
    const dryRunRow = items.find((i) => i.id === body.id);
    expect(dryRunRow?.dryRun).toBe(true);
  }, 60_000);

  it('D. GET chain → started_at ASC 로 original + re-run 모두 반환, chainId 공유', async () => {
    const { executionId } = await createAndRunWorkflow();

    // 두 번 re-run → chain = [original, rerun1, rerun2].
    const r1 = await request(BASE_URL)
      .post(`/api/executions/${executionId}/re-run`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ useOriginalInput: true });
    expect(r1.status).toBe(201);
    const rerun1 = r1.body.data.id as string;
    await pollExecution(rerun1, ownerToken, workspaceId, isTerminal);

    const r2 = await request(BASE_URL)
      .post(`/api/executions/${rerun1}/re-run`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ useOriginalInput: true });
    expect(r2.status).toBe(201);
    const rerun2 = r2.body.data.id as string;
    // chainId 는 원본 root 로 유지돼야 한다 (rerun1 의 id 가 아니라 원본).
    expect(r2.body.data.chainId).toBe(executionId);

    const chain = await request(BASE_URL)
      .get(`/api/executions/${rerun2}/chain`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(chain.status).toBe(200);
    const items = chain.body.data as Array<{
      id: string;
      reRunOf?: string | null;
      chainId?: string | null;
      startedAt?: string;
    }>;
    const ids = items.map((i) => i.id);
    expect(ids).toContain(executionId);
    expect(ids).toContain(rerun1);
    expect(ids).toContain(rerun2);

    // started_at ASC — 첫 항목이 원본.
    expect(ids[0]).toBe(executionId);

    // 동일 chain root 공유 (root == 원본 id; root row 의 chain_id 는 null 일 수
    // 있어 chainId 또는 자기 id 가 root 와 일치하면 통과로 본다).
    for (const it of items) {
      const root = it.chainId ?? it.id;
      expect(root).toBe(executionId);
    }
  }, 60_000);

  it('E. cross-workspace re-run → 404 RERUN_EXECUTION_NOT_FOUND (IDOR 차단)', async () => {
    const { executionId } = await createAndRunWorkflow();

    // 별도 owner / 워크스페이스. 자기 워크스페이스 컨텍스트(X-Workspace-Id=otherWs)로
    // 타 워크스페이스 실행을 re-run 시도 → service 의 workspace 격리 검증이 404 로 막는다.
    const intruder = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rerun-x'),
      db,
    );
    const otherWs = await createTeamWorkspace(
      BASE_URL,
      intruder.accessToken,
      uniqueName('XRR'),
    );

    const res = await request(BASE_URL)
      .post(`/api/executions/${executionId}/re-run`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .set('X-Workspace-Id', otherWs)
      .send({ useOriginalInput: true });

    // 본인 워크스페이스(otherWs) owner 이므로 @Roles('editor') 통과 →
    // service 진입 → 원본 실행의 workflow.workspaceId !== otherWs → 404.
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RERUN_EXECUTION_NOT_FOUND');

    // 같은 격리가 chain 조회에도 적용.
    const chain = await request(BASE_URL)
      .get(`/api/executions/${executionId}/chain`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .set('X-Workspace-Id', otherWs);
    expect(chain.status).toBe(404);
    expect(chain.body.error.code).toBe('RERUN_EXECUTION_NOT_FOUND');

    // inviteAndAccept 헬퍼 import 유지(다른 RBAC 시나리오 확장 지점). lint no-unused 회피.
    void inviteAndAccept;
  }, 60_000);
});
