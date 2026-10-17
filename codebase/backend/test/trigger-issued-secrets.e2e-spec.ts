// 서버가 발급하는 트리거 비밀(알림 서명 시크릿 `wsk_*` · 트리거 단위 토큰 `itk_*`)의 계약을 실제 Postgres ·
// Redis 위에서 고정한다(NERV Task `CLE-T-EQDYC1`).
// 근거: [트리거 관리 「API」](CLE-TRIG-MANAGE#api)
// 근거: [트리거 관리 「PATCH 본문 계약」](CLE-TRIG-MANAGE#patch-본문-계약)
// 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰)
// 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체)
// 근거: [감사 로그 「감사 액션 카탈로그」](CLE-OBS-AUDIT#감사-액션-카탈로그)
//
// 세 가지를 본다.
// 1. 생성 · PATCH 응답은 그 요청이 발급한 평문만 `data.secrets` 에 한 번 싣는다. 다시 읽으면 없다.
//    감사 기록에는 발급한 비밀의 종류 이름만 남고 평문은 남지 않는다.
// 2. 원시 `config` 로 `interaction.triggerToken` 을 심을 수 없다. 원시 `config` PATCH 도 저장된 토큰을 지킨다.
// 3. 교체(`rotate-secret`)와 승격 job 이 같은 트리거에서 겹쳐도 새로 교체한 v2 가 지워지지 않는다.
//
// 생성의 원자성(발급이 실패하면 트리거 행이 남지 않는다)은 실패를 주입해야 해서 `triggers.service.spec.ts` 가 본다.
//
// 이 파일도 `secret_store` 행을 만들고 raw `DELETE FROM trigger` 로는 지워지지 않는다. 그 고아 행이
// 무해한 이유는 `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 주석이 정본이다.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request, { type Response } from 'supertest';
import { type Job, Queue, QueueEvents } from 'bullmq';

import { notificationSigningSecretRef } from '../src/modules/triggers/notification-signing-secret-ref';
import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'redis',
  port: Number(process.env.REDIS_PORT ?? '6379'),
  ...(process.env.REDIS_PASSWORD
    ? { password: process.env.REDIS_PASSWORD }
    : {}),
};

// `notification-secret-rotator.service.ts` 의 큐 · job 이름. 그 파일을 import 하면 TriggersService 전체를
// 끌어오므로 값을 옮겨 적는다. 워커는 job 이름을 보지 않고 큐의 모든 job 에서 승격을 돈다.
const ROTATOR_QUEUE = 'notification-secret-rotator';
const PROMOTE_JOB = 'promote-rotated-notification-secrets';

/** 겹침을 기다리는 상한. 넘으면 겹침을 만들지 못한 것이라 테스트를 실패시킨다. */
const OVERLAP_WAIT_MS = 10_000;
const POLL_MS = 50;

const NOTIFICATION = {
  url: 'https://hooks.example.com/issued-secrets',
  events: ['execution.completed'],
};
const PER_TRIGGER_ON = { enabled: true, tokenStrategy: 'per_trigger' };

interface TriggerRow {
  config: {
    interaction?: { triggerToken?: string };
    notification?: { signing?: { secretRef?: string } };
  };
  notification_secret_v2: string | null;
  notification_rotated_at: Date | null;
}

describe('트리거가 발급하는 비밀 (e2e)', () => {
  let db: Client;
  /** 잠금 전용 연결. 잠금을 쥔 채로 `db` 에서 관측해야 해서 따로 둔다. */
  let lockDb: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  const createdTriggerIds: string[] = [];

  function api() {
    return {
      post: (path: string, body: object = {}) =>
        request(BASE_URL)
          .post(path)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Workspace-Id', workspaceId)
          .send(body),
      patch: (path: string, body: object) =>
        request(BASE_URL)
          .patch(path)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Workspace-Id', workspaceId)
          .send(body),
      get: (path: string) =>
        request(BASE_URL)
          .get(path)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Workspace-Id', workspaceId),
    };
  }

  async function createTrigger(extra: object) {
    const res = await api().post('/api/triggers', {
      workflowId,
      type: 'webhook',
      name: uniqueName('issued-secrets'),
      endpointPath: crypto.randomUUID(),
      ...extra,
    });
    if (res.status === 201) createdTriggerIds.push(res.body.data.id as string);
    return res;
  }

  async function readTrigger(triggerId: string): Promise<TriggerRow> {
    const res = await db.query<TriggerRow>(
      `SELECT config, notification_secret_v2, notification_rotated_at
         FROM trigger WHERE id = $1`,
      [triggerId],
    );
    if (!res.rows[0]) throw new Error(`trigger ${triggerId} 행이 없다`);
    return res.rows[0];
  }

  async function auditDetails(
    triggerId: string,
    action: 'trigger.created' | 'trigger.updated',
  ): Promise<Array<Record<string, unknown>>> {
    const res = await db.query<{ details: Record<string, unknown> }>(
      `SELECT details FROM audit_log
        WHERE resource_type = 'trigger' AND resource_id = $1 AND action = $2
        ORDER BY created_at ASC`,
      [triggerId, action],
    );
    return res.rows.map((r) => r.details);
  }

  async function readSigningSecretRow(triggerId: string): Promise<Buffer> {
    const res = await db.query<{ encrypted: Buffer }>(
      'SELECT encrypted FROM secret_store WHERE ref = $1',
      [notificationSigningSecretRef(triggerId)],
    );
    if (!res.rows[0])
      throw new Error(`secret_store 에 ${triggerId} 의 서명 비밀 행이 없다`);
    return res.rows[0].encrypted;
  }

  /** 이 트리거의 설정 잠금을 기다리는 연결 수. */
  async function lockWaiters(triggerId: string): Promise<number> {
    // `pg_advisory_xact_lock(bigint)` 은 키의 아래 32비트를 objid 에 둔다.
    const res = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM pg_locks
        WHERE locktype = 'advisory' AND NOT granted AND objsubid = 1
          AND objid::bigint = (hashtext($1)::bigint & 4294967295)`,
      [triggerConfigLockKey(triggerId)],
    );
    return res.rows[0].n;
  }

  async function waitForLockWaiters(
    triggerId: string,
    atLeast: number,
  ): Promise<void> {
    const deadline = Date.now() + OVERLAP_WAIT_MS;
    while (Date.now() < deadline) {
      if ((await lockWaiters(triggerId)) >= atLeast) return;
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    throw new Error(
      `설정 잠금 대기자가 ${atLeast} 개가 되지 않았다. 겹침을 만들지 못했으니 이 테스트의 단언은 의미가 없다.`,
    );
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    lockDb = createDbClient();
    await lockDb.connect();

    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('issued-secrets'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('ISSUED'),
    );
    const wf = await api().post('/api/workflows', {
      name: uniqueName('issued-secrets-wf'),
    });
    workflowId = wf.body.data.id as string;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await lockDb.end().catch(() => undefined);
    await db.end();
  });

  describe('발급한 평문은 그 응답에만 실린다', () => {
    it('생성: 알림과 per_trigger 인터랙션을 함께 켜면 두 평문을 한 번 싣고 다시 읽으면 없다', async () => {
      const created = await createTrigger({
        notification: NOTIFICATION,
        interaction: PER_TRIGGER_ON,
      });
      expect(created.status).toBe(201);
      const triggerId = created.body.data.id as string;
      const secrets = created.body.data.secrets as Record<string, string>;
      expect(Object.keys(secrets).sort()).toEqual([
        'interactionToken',
        'notificationSigningSecret',
      ]);
      expect(secrets.notificationSigningSecret).toMatch(/^wsk_/);
      expect(secrets.interactionToken).toMatch(/^itk_/);
      // 응답의 config 에는 서버가 관리하는 값이 없다.
      expect(created.body.data.config.interaction).not.toHaveProperty(
        'triggerToken',
      );
      expect(
        created.body.data.config.notification.signing ?? {},
      ).not.toHaveProperty('secretRef');

      // 저장된 값이 응답의 평문과 같다. 서명 시크릿은 시크릿 저장소에 있다.
      const row = await readTrigger(triggerId);
      expect(row.config.interaction?.triggerToken).toBe(
        secrets.interactionToken,
      );
      expect(row.config.notification?.signing?.secretRef).toBe(
        notificationSigningSecretRef(triggerId),
      );
      await readSigningSecretRow(triggerId);

      const fetched = await api().get(`/api/triggers/${triggerId}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body.data).not.toHaveProperty('secrets');
      expect(fetched.body.data.config.interaction).not.toHaveProperty(
        'triggerToken',
      );
      expect(JSON.stringify(fetched.body)).not.toContain(
        secrets.interactionToken,
      );
      expect(JSON.stringify(fetched.body)).not.toContain(
        secrets.notificationSigningSecret,
      );

      // 감사 기록에는 종류 이름만 남는다.
      const [details] = await auditDetails(triggerId, 'trigger.created');
      expect(details.issuedSecrets).toEqual([
        'notificationSigningSecret',
        'interactionToken',
      ]);
      expect(JSON.stringify(details)).not.toContain(secrets.interactionToken);
      expect(JSON.stringify(details)).not.toContain(
        secrets.notificationSigningSecret,
      );
    });

    it('생성: 발급한 비밀이 없으면 secrets 키도 issuedSecrets 키도 없다', async () => {
      const created = await createTrigger({
        interaction: { enabled: true, tokenStrategy: 'per_execution' },
      });
      expect(created.status).toBe(201);
      const triggerId = created.body.data.id as string;
      expect(created.body.data).not.toHaveProperty('secrets');
      expect(
        (await readTrigger(triggerId)).config.interaction,
      ).not.toHaveProperty('triggerToken');
      const [details] = await auditDetails(triggerId, 'trigger.created');
      expect(details).not.toHaveProperty('issuedSecrets');
    });

    it('PATCH: per_trigger 를 처음 켤 때만 토큰을 발급하고 끈 뒤 다시 켜도 새로 발급하지 않는다', async () => {
      const created = await createTrigger({});
      expect(created.status).toBe(201);
      const triggerId = created.body.data.id as string;
      const path = `/api/triggers/${triggerId}`;

      const turnedOn = await api().patch(path, { interaction: PER_TRIGGER_ON });
      expect(turnedOn.status).toBe(200);
      expect(turnedOn.body.data.secrets).toEqual({
        interactionToken: expect.stringMatching(/^itk_/),
      });
      const issued = turnedOn.body.data.secrets.interactionToken as string;
      expect(
        (await readTrigger(triggerId)).config.interaction?.triggerToken,
      ).toBe(issued);

      const turnedOff = await api().patch(path, {
        interaction: { enabled: false, tokenStrategy: 'per_trigger' },
      });
      expect(turnedOff.status).toBe(200);
      expect(turnedOff.body.data).not.toHaveProperty('secrets');

      const turnedOnAgain = await api().patch(path, {
        interaction: PER_TRIGGER_ON,
      });
      expect(turnedOnAgain.status).toBe(200);
      expect(turnedOnAgain.body.data).not.toHaveProperty('secrets');
      // 끄는 PATCH 는 토큰 값을 남긴다. 다시 켜면 그 토큰이 그대로 유효하다.
      expect(
        (await readTrigger(triggerId)).config.interaction?.triggerToken,
      ).toBe(issued);

      const updates = await auditDetails(triggerId, 'trigger.updated');
      expect(updates).toHaveLength(3);
      expect(updates[0].issuedSecrets).toEqual(['interactionToken']);
      expect(updates[1]).not.toHaveProperty('issuedSecrets');
      expect(updates[2]).not.toHaveProperty('issuedSecrets');
      expect(JSON.stringify(updates)).not.toContain(issued);
    });
  });

  describe('원시 config 와 트리거 단위 토큰', () => {
    const PLANTED = 'itk_planted_by_caller';

    it('생성: 원시 config 에 triggerToken 을 실으면 400 이고 트리거가 생기지 않는다', async () => {
      const endpointPath = crypto.randomUUID();
      const res = await api().post('/api/triggers', {
        workflowId,
        type: 'webhook',
        name: uniqueName('issued-secrets-planted'),
        endpointPath,
        config: {
          interaction: { ...PER_TRIGGER_ON, triggerToken: PLANTED },
        },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual({
        field: 'config.interaction.triggerToken',
        code: 'INVALID_FIELD',
      });
      const rows = await db.query(
        'SELECT 1 FROM trigger WHERE endpoint_path = $1',
        [endpointPath],
      );
      expect(rows.rowCount).toBe(0);
    });

    it('PATCH: 원시 config 에 triggerToken 을 실으면 400 이고 저장된 토큰은 그대로다', async () => {
      const created = await createTrigger({ interaction: PER_TRIGGER_ON });
      expect(created.status).toBe(201);
      const triggerId = created.body.data.id as string;
      const issued = created.body.data.secrets.interactionToken as string;

      const res = await api().patch(`/api/triggers/${triggerId}`, {
        config: { interaction: { ...PER_TRIGGER_ON, triggerToken: PLANTED } },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual({
        field: 'config.interaction.triggerToken',
        code: 'INVALID_FIELD',
      });
      expect(
        (await readTrigger(triggerId)).config.interaction?.triggerToken,
      ).toBe(issued);
    });

    it('PATCH: triggerToken 없는 원시 config 로 per_trigger 를 유지하면 저장된 토큰을 지킨다', async () => {
      const created = await createTrigger({ interaction: PER_TRIGGER_ON });
      expect(created.status).toBe(201);
      const triggerId = created.body.data.id as string;
      const issued = created.body.data.secrets.interactionToken as string;

      const res = await api().patch(`/api/triggers/${triggerId}`, {
        config: { interaction: PER_TRIGGER_ON, custom: { note: 'raw' } },
      });
      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('secrets');
      const row = await readTrigger(triggerId);
      expect(row.config.interaction?.triggerToken).toBe(issued);
    });
  });

  describe('교체와 승격이 겹칠 때', () => {
    let queue: Queue;
    let queueEvents: QueueEvents;

    beforeAll(async () => {
      queue = new Queue(ROTATOR_QUEUE, { connection: redisConnection });
      queueEvents = new QueueEvents(ROTATOR_QUEUE, {
        connection: redisConnection,
      });
      await queueEvents.waitUntilReady();
    });

    afterAll(async () => {
      await queueEvents.close();
      await queue.close();
    });

    // 판별 조건: 교체 B 가 먼저 잠금을 얻어 v2 를 B 로 바꾸고, 그 뒤 승격 job 이 잠금 밖에서 골라 둔 옛 v2(A)를
    // 들고 들어온다. 잠금 안에서 다시 읽지 않는 승격은 v2 를 비우거나 A 를 주 시크릿으로 옮긴다.
    // Postgres 는 같은 잠금의 대기자를 온 순서대로 깨우므로 B 의 대기를 먼저 확인하고 job 을 넣는다.
    it('승격 job 이 잠금을 기다리는 동안 들어온 교체의 v2 를 지우지도 옮기지도 않는다', async () => {
      const created = await createTrigger({ notification: NOTIFICATION });
      expect(created.status).toBe(201);
      const triggerId = created.body.data.id as string;
      const rotatePath = `/api/triggers/${triggerId}/notification/rotate-secret`;

      // 교체 A 를 하고 유예(24시간)가 지난 것으로 만든다. 승격 job 이 A 를 후보로 고른다.
      const rotatedA = await api().post(rotatePath);
      expect(rotatedA.status).toBe(200);
      const secretA = rotatedA.body.data.secret as string;
      await db.query(
        `UPDATE trigger SET notification_rotated_at = now() - interval '25 hours'
          WHERE id = $1`,
        [triggerId],
      );
      const primaryBefore = await readSigningSecretRow(triggerId);

      let bSettled = false;
      let pendingB: Promise<Response> | undefined;
      let job: Job | undefined;
      let promoted: Promise<unknown> | undefined;
      await lockDb.query('BEGIN');
      try {
        await lockDb.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          triggerConfigLockKey(triggerId),
        ]);

        pendingB = api()
          .post(rotatePath)
          .then((res) => {
            bSettled = true;
            return res;
          });
        await waitForLockWaiters(triggerId, 1);

        job = await queue.add(PROMOTE_JOB, {});
        // 승격 job 은 후보 조회를 잠금 밖에서 끝내고 이 트리거의 잠금에서 B 뒤에 선다.
        await waitForLockWaiters(triggerId, 2);
        expect(bSettled).toBe(false);
        // 끝나기 전에 구독한다. 잠금을 놓은 뒤에 구독하면 이미 끝난 job 을 기다릴 수 있다.
        promoted = job.waitUntilFinished(queueEvents, OVERLAP_WAIT_MS);

        await lockDb.query('COMMIT');

        const rotatedB = await pendingB;
        expect(rotatedB.status).toBe(200);
        const secretB = rotatedB.body.data.secret as string;
        expect(secretB).not.toBe(secretA);
        await promoted;

        const row = await readTrigger(triggerId);
        // ① 새로 교체한 v2 가 남는다.
        expect(row.notification_secret_v2).toBe(secretB);
        // ② 유예는 B 의 교체 시각부터 다시 센다.
        expect(row.notification_rotated_at).not.toBeNull();
        expect(
          Date.now() - (row.notification_rotated_at as Date).getTime(),
        ).toBeLessThan(60 * 60 * 1000);
        // ③ 덮인 A 는 주 시크릿이 되지 않는다.
        expect(
          (await readSigningSecretRow(triggerId)).equals(primaryBefore),
        ).toBe(true);
      } finally {
        await lockDb.query('ROLLBACK').catch(() => undefined);
        await pendingB?.catch(() => undefined);
        await promoted?.catch(() => undefined);
        await job?.remove().catch(() => undefined);
      }
    }, 60_000);
  });
});
