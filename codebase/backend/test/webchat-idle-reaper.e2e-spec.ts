import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/5-system/14-external-interaction-api.md §3.4 EIA-RL-07 / §R19 — 공개 위젯
 * idle-wait execution 회수 reaper.
 *
 * 판정 쿼리(`execution_token` ⋈ `execution` ⋈ `trigger`, `GROUP BY … HAVING MAX(exp_at)<now-grace`)
 * 와 engine `markWebchatIdleTimeout`(조건부 UPDATE)는 real-SQL·상태전이 의존이라 유닛 mock 으로
 * 실증 불가 → 실 Postgres 로 검증한다. `WebchatIdleReaperService` 는 분 단위 repeatable 이므로
 * 시드 후 다음 cron tick(≤~60s)에서 회수되는 것을 poll 로 확인한다.
 *
 * 시나리오:
 *  (A) 익명(auth_config_id NULL) 트리거 + waiting_for_input + 모든 토큰 만료(exp_at 2h 전)
 *      → reaper 가 `cancelled` + error.code='WEBCHAT_IDLE_TIMEOUT' 로 회수.
 *  (B) 대조군: 동일 조건이나 토큰이 미만료(exp_at 1h 후) → 회수되지 않고 waiting_for_input 유지.
 *
 * grace 기본 1h(WEBCHAT_IDLE_REAP_GRACE_MS) 가정 — 시드 exp_at 은 2h 전(초과)/1h 후(미달).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const REAP_POLL_TIMEOUT_MS = 110_000; // reaper 는 분 단위 cron — 다음 tick + 처리 여유.
const REAP_POLL_INTERVAL_MS = 3_000;

describe('공개 위젯 idle-wait reaper (e2e, EIA-RL-07 §R19)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('reap'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('REAP'),
    );
  });

  afterAll(async () => {
    await db.end();
  });

  async function createWorkflow(): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set({ Authorization: `Bearer ${ownerToken}` })
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('reap-wf') });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  /** 익명 공개 위젯 트리거(auth_config_id NULL) + waiting execution + 토큰 1건 시드. */
  async function seedWidgetSession(
    workflowId: string,
    expAt: string,
  ): Promise<string> {
    const triggerId = randomUUID();
    const executionId = randomUUID();
    await db.query(
      `INSERT INTO trigger (id, workspace_id, workflow_id, type, name, auth_config_id, config, is_active)
       VALUES ($1, $2, $3, 'webhook', $4, NULL, '{}'::jsonb, true)`,
      [triggerId, workspaceId, workflowId, uniqueName('reap-trig')],
    );
    await db.query(
      `INSERT INTO execution (id, workflow_id, trigger_id, status, started_at)
       VALUES ($1, $2, $3, 'waiting_for_input', NOW())`,
      [executionId, workflowId, triggerId],
    );
    await db.query(
      `INSERT INTO execution_token (jti, execution_id, issued_at, exp_at)
       VALUES ($1, $2, NOW() - INTERVAL '3 hours', $3::timestamptz)`,
      [randomUUID(), executionId, expAt],
    );
    return executionId;
  }

  async function getExecution(
    executionId: string,
  ): Promise<{ status: string; error: { code?: string } | null }> {
    const row = await db.query(
      `SELECT status, error FROM execution WHERE id = $1`,
      [executionId],
    );
    return row.rows[0];
  }

  it('토큰 전 만료 익명 위젯 execution 을 cancelled(WEBCHAT_IDLE_TIMEOUT)로 회수; 미만료는 유지', async () => {
    const workflowId = await createWorkflow();
    // (A) 만료: exp_at 2h 전 → grace(1h) 초과.
    const expiredExecId = await seedWidgetSession(
      workflowId,
      new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    );
    // (B) 대조군: exp_at 1h 후 → 미만료 → 대상 아님.
    const freshExecId = await seedWidgetSession(
      workflowId,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    );

    // reaper cron tick 을 poll (≤~60s + 처리).
    const deadline = Date.now() + REAP_POLL_TIMEOUT_MS;
    let expired = await getExecution(expiredExecId);
    while (expired.status !== 'cancelled' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, REAP_POLL_INTERVAL_MS));
      expired = await getExecution(expiredExecId);
    }

    // (A) 만료 execution 회수 확인.
    expect(expired.status).toBe('cancelled');
    expect(expired.error?.code).toBe('WEBCHAT_IDLE_TIMEOUT');

    // (B) 미만료 대조군은 회수되지 않고 waiting_for_input 유지.
    const fresh = await getExecution(freshExecId);
    expect(fresh.status).toBe('waiting_for_input');
  }, 120_000);
});
