import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Job, Queue } from 'bullmq';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import { nextE2eClientIp } from './helpers/e2e-client-ip';
import { setupChatChannelTrigger } from './helpers/e2e-chat-channel-fixture';

/**
 * e2e: 꺼진 워크플로우는 웹훅 · 채팅 채널 · 스케줄로 실행되지 않는다 (NERV Task `CLE-T-XRWFMJ`).
 *
 * - 일반 웹훅: 꺼진 트리거와 같은 자리에서 `410 WORKFLOW_INACTIVE`. 켜면 `202`.
 * - 채팅 채널: 메시지는 `202 ignored`. 프로바이더 handshake(Discord PING)에는 답한다.
 * - 스케줄: job 이 와도 건너뛴다. 켜면 실행한다.
 *
 * 각 경로는 끈 상태에서 실행 행이 없음을 보고, 같은 입력으로 켠 뒤 실행 행이 생기는 것까지 본다.
 * 켠 쪽을 함께 봐야 "다른 이유로 실행이 안 생긴 것" 과 가를 수 있다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** `schedule-runner.service.ts` 의 `SCHEDULE_QUEUE` 와 같아야 한다. */
const SCHEDULE_QUEUE = 'schedule-execution';

describe('꺼진 워크플로우의 실행 관문 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let scheduleQueue: Queue;
  let telegramUpdateId = Math.floor(Date.now() / 1000);

  const auth = () => ({
    Authorization: `Bearer ${token}`,
    'X-Workspace-Id': workspaceId,
  });

  async function createWorkflow(isActive: boolean): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set(auth())
      .send({ name: uniqueName('wf-gate'), isActive });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  async function setWorkflowActive(
    workflowId: string,
    isActive: boolean,
  ): Promise<void> {
    const res = await request(BASE_URL)
      .patch(`/api/workflows/${workflowId}`)
      .set(auth())
      .send({ isActive });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(isActive);
  }

  async function executionCount(workflowId: string): Promise<number> {
    const res = await db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM execution WHERE workflow_id = $1',
      [workflowId],
    );
    return Number(res.rows[0].n);
  }

  /** job 이 끝날 때까지 기다려 최종 상태를 돌려준다. */
  async function waitForJobEnd(job: Job): Promise<string> {
    for (let i = 0; i < 60; i++) {
      const state = await job.getState();
      if (state === 'completed' || state === 'failed') return state;
      await new Promise((r) => setTimeout(r, 250));
    }
    return 'timeout';
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    scheduleQueue = new Queue(SCHEDULE_QUEUE, {
      connection: {
        host: process.env.REDIS_HOST ?? 'redis',
        port: Number(process.env.REDIS_PORT ?? '6379'),
        ...(process.env.REDIS_PASSWORD
          ? { password: process.env.REDIS_PASSWORD }
          : {}),
      },
    });
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('wf-gate'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('WFGATE'),
    );
  }, 60_000);

  afterAll(async () => {
    await scheduleQueue.close();
    await db.end();
  });

  it('일반 웹훅 — 410 WORKFLOW_INACTIVE 로 답하고 실행이 없다. 켜면 202', async () => {
    const workflowId = await createWorkflow(false);
    const endpointPath = crypto.randomUUID();
    const created = await request(BASE_URL)
      .post('/api/triggers')
      .set(auth())
      .send({
        workflowId,
        type: 'webhook',
        name: uniqueName('wf-gate-hook'),
        endpointPath,
        isActive: true,
      });
    expect(created.status).toBe(201);

    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .send({ hello: 'world' });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('WORKFLOW_INACTIVE');
    expect(await executionCount(workflowId)).toBe(0);

    await setWorkflowActive(workflowId, true);
    const ok = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .send({ hello: 'world' });
    expect(ok.status).toBe(202);
    expect(await executionCount(workflowId)).toBe(1);
  });

  it('채팅 채널 — 메시지는 202 ignored 로 답하고 실행이 없다. 켜면 실행을 시작한다', async () => {
    const setup = await setupChatChannelTrigger({ db, provider: 'telegram' });
    await db.query(
      `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, 'manual_trigger', 'trigger', 'trg', $3, 0, 0, NOW(), NOW())`,
      [
        crypto.randomUUID(),
        setup.workflowId,
        JSON.stringify({ parameters: [] }),
      ],
    );
    await db.query('UPDATE workflow SET is_active = false WHERE id = $1', [
      setup.workflowId,
    ]);
    const sendStart = () =>
      request(BASE_URL)
        .post(`/api/hooks/${setup.endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .send(
          JSON.stringify({
            update_id: ++telegramUpdateId,
            message: {
              message_id: 1,
              chat: { id: 70001, type: 'private' },
              from: { id: 80001, is_bot: false },
              text: '/start',
            },
          }),
        );

    try {
      const ignored = await sendStart();
      expect(ignored.status).toBe(202);
      expect(ignored.body.data.executionId).toBe('ignored');
      expect(await executionCount(setup.workflowId)).toBe(0);

      await db.query('UPDATE workflow SET is_active = true WHERE id = $1', [
        setup.workflowId,
      ]);
      const started = await sendStart();
      expect(started.status).toBe(202);
      expect(started.body.data.executionId).not.toBe('ignored');
      expect(await executionCount(setup.workflowId)).toBe(1);
    } finally {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
        .catch(() => undefined);
    }
  });

  it('채팅 채널 — 워크플로우가 꺼져 있어도 Discord PING 에는 답한다', async () => {
    const setup = await setupChatChannelTrigger({ db, provider: 'discord' });
    await db.query('UPDATE workflow SET is_active = false WHERE id = $1', [
      setup.workflowId,
    ]);

    try {
      const res = await request(BASE_URL)
        .post(`/api/hooks/${setup.endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .send(
          JSON.stringify({
            id: 'I-ping-gate',
            application_id: 'A',
            type: 1,
            token: 'tok',
            version: 1,
          }),
        );
      expect(res.status).toBe(200);
      expect(res.body.type).toBe(1);
    } finally {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
        .catch(() => undefined);
    }
  });

  it('스케줄 — 꺼진 워크플로우는 job 이 와도 실행하지 않는다. 켜면 실행한다', async () => {
    const workflowId = await createWorkflow(true);
    const created = await request(BASE_URL)
      .post('/api/schedules')
      .set(auth())
      .send({
        workflowId,
        name: uniqueName('wf-gate-sched'),
        // 테스트 중에 스스로 발화하지 않는 cron(1월 1일 03:00).
        cronExpression: '0 3 1 1 *',
        timezone: 'Asia/Seoul',
      });
    expect(created.status).toBe(201);
    const scheduleId = created.body.data.id as string;
    await setWorkflowActive(workflowId, false);
    // 건너뛴 발화도 "다음 실행" 을 다음 cron 발화로 옮기는지 보려고 지난 시각을 넣어 둔다.
    await db.query(
      `UPDATE schedule SET next_run_at = '2020-01-01T00:00:00Z' WHERE id = $1`,
      [scheduleId],
    );

    const jobOpts = { removeOnComplete: false, removeOnFail: false };
    const skipped = await scheduleQueue.add(
      'e2e-workflow-gate',
      { scheduleId, workspaceId },
      jobOpts,
    );
    expect(await waitForJobEnd(skipped)).toBe('completed');
    expect(await executionCount(workflowId)).toBe(0);
    const afterSkip = await db.query<{ moved: boolean; last: Date | null }>(
      `SELECT next_run_at > NOW() AS moved, last_run_at AS last FROM schedule WHERE id = $1`,
      [scheduleId],
    );
    expect(afterSkip.rows[0]).toEqual({ moved: true, last: null });

    await setWorkflowActive(workflowId, true);
    const fired = await scheduleQueue.add(
      'e2e-workflow-gate',
      { scheduleId, workspaceId },
      jobOpts,
    );
    expect(await waitForJobEnd(fired)).toBe('completed');
    expect(await executionCount(workflowId)).toBe(1);

    await skipped.remove().catch(() => undefined);
    await fired.remove().catch(() => undefined);
  });
});
