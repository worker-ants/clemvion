import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { ROOT_ENTITIES } from '../src/database/root-entities';
import { SecretStore } from '../src/modules/secret-store/entities/secret-store.entity';
import { SecretResolverService } from '../src/modules/secret-store/secret-resolver.service';
import { rewriteTriggerConfigLocked } from '../src/modules/triggers/trigger-config-lock';
import {
  deleteTriggerSecretsAfterCommit,
  undoAbsentTriggerWrite,
} from '../src/modules/triggers/trigger-resource-release';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';

/**
 * e2e: **트리거 행을 없애는 네 경로**가 그 트리거의 자원을 정리한다.
 *
 * 계약 SoT 는 `spec/2-navigation/2-trigger-list.md §4.3`(표 다음 문단). 경로는 트리거 화면 삭제 ·
 * 스케줄 화면 삭제 · 워크플로 삭제 · 워크스페이스 삭제이고, 뒤의 둘은 FK CASCADE 로 트리거를
 * 지운다. 이 파일 이전에는 **트리거 화면 삭제 하나만** 정리했다.
 *
 * ## 비밀 행은 SQL 로 심는다
 *
 * 공개 API 로 비밀을 만드는 길은 chat channel 뿐이고, e2e 에는 provider mock 이 없어 telegram
 * setup 이 호출당 최악 ~18초 걸린다. `notification.signing.secret` 은 DTO 에 없어 400 이다.
 * 정리는 복호화하지 않고 `ref` 접두로만 지우므로 **평문이 필요 없다** — 트리거는 API 로 만들고
 * `secret_store` 행은 `secret-store-like-prefix.e2e-spec.ts` 처럼 placeholder 암호문으로 넣는다.
 *
 * ## 대조군이 판별의 절반이다
 *
 * «지워졌다» 만 보면 **넓게 지우는** 결함(워크스페이스 전체 · 접두 전체)이 GREEN 이 된다. 그래서
 * 각 케이스는 **지우면 안 되는 이웃 트리거의 비밀**을 함께 심고 그것이 남는지 본다.
 *
 * ## 삭제와 겹친 쓰기 — HTTP 로는 끊을 자리가 없다
 *
 * 비밀 쓰기와 락 안 재기록 사이는 ms 다. e2e 에서 넓은 창(telegram setup ~18초)은 그 창 **뒤에**
 * 쓰는 비밀이 없어, 보상이 없어도 삭제 쪽 정리가 먼저 지워 GREEN 이 된다(판별 불가). 그래서 마지막
 * describe 는 운영 코드에 훅을 넣지 않고 실제 Postgres 에 붙어 **순서를 재진입으로 고정**한다 —
 * `trigger-update-save-window.e2e-spec.ts` 와 같은 방식이다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** `schedule-runner.service.ts` 의 `SCHEDULE_QUEUE` · job scheduler id 형식과 같아야 한다. */
const SCHEDULE_QUEUE = 'schedule-execution';
const schedulerId = (scheduleId: string) => `schedule:${scheduleId}`;

/**
 * job scheduler 가 **등록돼 있는가** — 스케줄러 목록(zset) 소속으로 판정한다.
 *
 * `Queue.getJobScheduler(id)` 로 판정하면 안 된다. id 에 `:` 가 있으면(`schedule:<id>`) bullmq 5 가
 * 해시가 지워진 뒤에도 레거시 경로(`keyToData`)로 `{ pattern: null, next: null, … }` 껍데기를
 * 돌려줘 **해제 뒤에도 undefined 가 아니다**. 그 API 로 쓴 첫 판은 «해제됐다» 가 항상 실패했고
 * «남아 있다»(403 케이스)는 항상 참이었다 — 실측으로 확인했다.
 */
async function schedulerRegistered(
  queue: Queue,
  scheduleId: string,
): Promise<boolean> {
  const schedulers = await queue.getJobSchedulers(0, -1);
  return schedulers.some((sch) => sch.key === schedulerId(scheduleId));
}

/** 한 트리거에 심는 ref 들 — 서로 다른 이름 둘이라 «접두 전체» 가 지워지는지 본다. */
const SECRET_NAMES = ['bot-token', 'notification-signing'] as const;

describe('트리거 행을 없애는 네 경로의 자원 정리 (e2e)', () => {
  let db: Client;
  let scheduleQueue: Queue;
  let ownerToken: string;
  let ownerEmail: string;

  function auth(ws: string) {
    return {
      Authorization: `Bearer ${ownerToken}`,
      'X-Workspace-Id': ws,
    };
  }

  async function createWorkflow(ws: string, tag: string): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set(auth(ws))
      .send({ name: uniqueName(`del-release-wf-${tag}`) });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  async function createWebhookTrigger(
    ws: string,
    workflowId: string,
    tag: string,
  ): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/triggers')
      .set(auth(ws))
      .send({
        workflowId,
        type: 'webhook',
        name: uniqueName(`del-release-tr-${tag}`),
        endpointPath: crypto.randomUUID(),
      });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  /** 활성 스케줄을 만들고 `{ scheduleId, triggerId }` 를 돌려준다. */
  async function createActiveSchedule(
    ws: string,
    workflowId: string,
    tag: string,
  ): Promise<{ scheduleId: string; triggerId: string }> {
    const res = await request(BASE_URL)
      .post('/api/schedules')
      .set(auth(ws))
      .send({
        workflowId,
        name: uniqueName(`del-release-sched-${tag}`),
        cronExpression: '0 3 * * *',
        timezone: 'Asia/Seoul',
      });
    expect(res.status).toBe(201);
    const scheduleId = res.body.data.id as string;
    const row = await db.query<{ trigger_id: string }>(
      'SELECT trigger_id FROM schedule WHERE id = $1',
      [scheduleId],
    );
    return { scheduleId, triggerId: row.rows[0].trigger_id };
  }

  async function seedSecrets(triggerId: string, ws: string): Promise<void> {
    for (const name of SECRET_NAMES) {
      await db.query(
        'INSERT INTO secret_store (ref, workspace_id, encrypted) VALUES ($1, $2, $3)',
        [
          `secret://triggers/${triggerId}/${name}`,
          ws,
          Buffer.from('ciphertext-placeholder'),
        ],
      );
    }
  }

  async function secretCount(triggerId: string): Promise<number> {
    const res = await db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM secret_store WHERE ref LIKE $1',
      [`secret://triggers/${triggerId}/%`],
    );
    return Number(res.rows[0].n);
  }

  async function triggerExists(triggerId: string): Promise<boolean> {
    const res = await db.query('SELECT 1 FROM trigger WHERE id = $1', [
      triggerId,
    ]);
    return res.rows.length === 1;
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
    ownerEmail = uniqueEmail('del-release');
    const owner = await registerAndLogin(BASE_URL, ownerEmail, db);
    ownerToken = owner.accessToken;
  }, 60_000);

  afterAll(async () => {
    await scheduleQueue.close();
    await db.end();
  });

  /**
   * 워크플로 삭제가 `trigger` 를 `workflow_id` 로 세 번 찾는다(외부 해제 열거 · 잠금 안 열거 · FK CASCADE).
   * V111 이 그 인덱스를 만든다. **`indisvalid` 까지 본다** — `CREATE INDEX CONCURRENTLY` 가 실패하면 이름만
   * 점유한 invalid 인덱스가 남고, 존재만 보는 단언은 그것을 초록으로 통과시킨다.
   *
   * 근거·실측: `plan/complete/spec-draft-trigger-workflow-index.md`,
   * SoT: `spec/1-data-model.md` §3 · `spec/data-flow/10-triggers.md` §2.1.
   */
  it('schema: trigger (workflow_id) 인덱스가 유효하게 있다 (V111)', async () => {
    const res = await db.query<{ indexdef: string; indisvalid: boolean }>(
      `SELECT i.indisvalid, pg_get_indexdef(i.indexrelid) AS indexdef
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       WHERE c.relname = 'idx_trigger_workflow_id'`,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].indisvalid).toBe(true);
    // 세 쿼리가 모두 `workflow_id` 등치 하나뿐이다 — 선두가 다르거나 부분 인덱스면 CASCADE 가 쓰지 못한다.
    expect(res.rows[0].indexdef).toMatch(
      /ON public\.trigger USING btree \(workflow_id\)$/,
    );
  });

  it('워크플로 삭제 — 그 워크플로 트리거의 비밀이 지워지고, 옆 워크플로 트리거의 비밀은 남는다', async () => {
    const ws = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('DELWF'),
    );
    const target = await createWorkflow(ws, 'target');
    const neighbour = await createWorkflow(ws, 'neighbour');
    const targetTrigger = await createWebhookTrigger(ws, target, 'target');
    const neighbourTrigger = await createWebhookTrigger(
      ws,
      neighbour,
      'neighbour',
    );
    await seedSecrets(targetTrigger, ws);
    await seedSecrets(neighbourTrigger, ws);
    // 심은 것이 실제로 셀 수 있는 형태인지 먼저 고정한다 — 아니면 아래 0 이 vacuous 하다.
    expect(await secretCount(targetTrigger)).toBe(SECRET_NAMES.length);

    const del = await request(BASE_URL)
      .delete(`/api/workflows/${target}`)
      .set(auth(ws));
    expect(del.status).toBe(204);

    expect(await triggerExists(targetTrigger)).toBe(false);
    expect(await secretCount(targetTrigger)).toBe(0);
    expect(await secretCount(neighbourTrigger)).toBe(SECRET_NAMES.length);
  });

  it('워크플로 삭제 — 그 워크플로 스케줄의 BullMQ job scheduler 가 해제된다', async () => {
    const ws = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('DELWFJOB'),
    );
    const wf = await createWorkflow(ws, 'job');
    const { scheduleId } = await createActiveSchedule(ws, wf, 'job');
    // 활성 스케줄이 실제로 등록돼 있어야 «해제됐다» 가 판별된다.
    expect(await schedulerRegistered(scheduleQueue, scheduleId)).toBe(true);

    const del = await request(BASE_URL)
      .delete(`/api/workflows/${wf}`)
      .set(auth(ws));
    expect(del.status).toBe(204);

    expect(await schedulerRegistered(scheduleQueue, scheduleId)).toBe(false);
  });

  it('워크스페이스 삭제 — 그 워크스페이스 트리거의 비밀·스케줄 job 이 정리되고, 다른 워크스페이스 트리거의 비밀은 남는다', async () => {
    const ws = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('DELWS'),
    );
    const other = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('DELWSOTHER'),
    );
    const wf = await createWorkflow(ws, 'ws');
    const webhook = await createWebhookTrigger(ws, wf, 'ws');
    const { scheduleId, triggerId: scheduleTrigger } =
      await createActiveSchedule(ws, wf, 'ws');
    const otherTrigger = await createWebhookTrigger(
      other,
      await createWorkflow(other, 'other'),
      'other',
    );
    await seedSecrets(webhook, ws);
    await seedSecrets(scheduleTrigger, ws);
    await seedSecrets(otherTrigger, other);
    expect(await schedulerRegistered(scheduleQueue, scheduleId)).toBe(true);

    const del = await request(BASE_URL)
      .delete(`/api/workspaces/${ws}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(del.status).toBe(200);

    expect(await triggerExists(webhook)).toBe(false);
    expect(await secretCount(webhook)).toBe(0);
    expect(await secretCount(scheduleTrigger)).toBe(0);
    expect(await schedulerRegistered(scheduleQueue, scheduleId)).toBe(false);
    expect(await secretCount(otherTrigger)).toBe(SECRET_NAMES.length);
  });

  it('워크스페이스 삭제 권한이 없으면(403) 아무것도 정리하지 않는다 — 권한 검사가 외부 해제보다 먼저다', async () => {
    const ws = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('DELWS403'),
    );
    const wf = await createWorkflow(ws, 'forbidden');
    const { scheduleId, triggerId } = await createActiveSchedule(
      ws,
      wf,
      'forbidden',
    );
    await seedSecrets(triggerId, ws);
    const editor = await inviteAndAccept(
      BASE_URL,
      ownerToken,
      ws,
      uniqueEmail('del-release-editor'),
      'editor',
      db,
    );

    const del = await request(BASE_URL)
      .delete(`/api/workspaces/${ws}`)
      .set('Authorization', `Bearer ${editor.accessToken}`);
    expect(del.status).toBe(403);

    // 외부 해제가 권한 검사보다 앞서면 job 이 먼저 뜯긴다 — 이 단언이 그 순서를 문다.
    expect(await schedulerRegistered(scheduleQueue, scheduleId)).toBe(true);
    expect(await triggerExists(triggerId)).toBe(true);
    expect(await secretCount(triggerId)).toBe(SECRET_NAMES.length);
  });

  it('스케줄 삭제 — 그 스케줄 트리거의 비밀이 지워진다', async () => {
    const ws = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('DELSCHED'),
    );
    const wf = await createWorkflow(ws, 'sched');
    const { scheduleId, triggerId } = await createActiveSchedule(
      ws,
      wf,
      'sched',
    );
    const neighbour = await createWebhookTrigger(ws, wf, 'sched-neighbour');
    await seedSecrets(triggerId, ws);
    await seedSecrets(neighbour, ws);

    const del = await request(BASE_URL)
      .delete(`/api/schedules/${scheduleId}`)
      .set(auth(ws));
    expect(del.status).toBe(204);

    expect(await triggerExists(triggerId)).toBe(false);
    expect(await secretCount(triggerId)).toBe(0);
    expect(await secretCount(neighbour)).toBe(SECRET_NAMES.length);
  });

  it('트리거 삭제 — 그 트리거의 비밀이 지워지고, 같은 워크플로 옆 트리거의 비밀은 남는다', async () => {
    const ws = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('DELTR'),
    );
    const wf = await createWorkflow(ws, 'tr');
    const target = await createWebhookTrigger(ws, wf, 'tr-target');
    const neighbour = await createWebhookTrigger(ws, wf, 'tr-neighbour');
    await seedSecrets(target, ws);
    await seedSecrets(neighbour, ws);

    const del = await request(BASE_URL)
      .delete(`/api/triggers/${target}`)
      .set(auth(ws));
    expect(del.status).toBe(204);

    expect(await triggerExists(target)).toBe(false);
    expect(await secretCount(target)).toBe(0);
    expect(await secretCount(neighbour)).toBe(SECRET_NAMES.length);
  });
});

/**
 * **보상 합성** — 삭제 쪽 정리가 끝난 **뒤에** 쓴 비밀은 쓰기 쪽이 스스로 되돌려야 한다.
 *
 * 순서를 고정한다: T(부모 삭제 → 트리거 CASCADE) → S(커밋 뒤 비밀 정리 — 아직 쓴 것이 없어 0건)
 * → A(락 밖 비밀 쓰기) → R(`rewriteTriggerConfigLocked` — 행이 없어 `false`) → C(보상).
 * A 가 S 보다 늦은 이 인터리빙이 **보상 없이는 고아가 남는 유일한 순서**다 — A 가 S 보다 빠르면
 * S 가 지운다(spec 트리거 목록 §3 · `trigger-resource-release.ts`).
 *
 * 서비스 다섯 자리가 `false` 에서 보상을 **부르는지**는 단위 테스트가 문다. 여기는 그 두 규칙이
 * 실제 DB 위에서 **합쳐져 닫히는지**를 문다.
 */
describe('삭제와 겹친 비밀 쓰기 — 보상 합성 (실제 Postgres)', () => {
  let db: Client;
  let ds: DataSource;
  let token: string;
  let workspaceId: string;
  const logged: string[] = [];
  const logger = { error: (msg: string) => logged.push(msg) };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    ds = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'postgres',
      port: Number(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USERNAME ?? 'clemvion',
      password: process.env.DB_PASSWORD ?? 'clemvion-e2e',
      database: process.env.DB_DATABASE ?? 'clemvion_e2e',
      // `ROOT_ENTITIES` 는 `readonly` 튜플이라 펼쳐 넘긴다 — `app.module.ts` 와 같은 형태.
      entities: [...ROOT_ENTITIES],
      synchronize: false,
    });
    await ds.initialize();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('del-release-undo'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('DELUNDO'),
    );
  }, 60_000);

  afterAll(async () => {
    await ds?.destroy().catch(() => undefined);
    await db?.end().catch(() => undefined);
  });

  it('정리 뒤에 쓴 비밀은 락 안 재기록의 false 를 받은 보상이 지운다', async () => {
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('del-release-undo-wf') });
    const workflowId = wf.body.data.id as string;
    const tr = await request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        workflowId,
        type: 'webhook',
        name: uniqueName('del-release-undo-tr'),
        endpointPath: crypto.randomUUID(),
      });
    expect(tr.status).toBe(201);
    const triggerId = tr.body.data.id as string;
    // `deleteByPrefix` 는 복호화하지 않는다 — 마스터키 없이 만든 인스턴스로 충분하다.
    const secrets = new SecretResolverService(
      ds.getRepository(SecretStore),
      new ConfigService(),
    );
    const count = async () =>
      Number(
        (
          await db.query<{ n: string }>(
            'SELECT count(*)::text AS n FROM secret_store WHERE ref LIKE $1',
            [`secret://triggers/${triggerId}/%`],
          )
        ).rows[0].n,
      );

    // T — 부모 삭제. 트리거는 CASCADE 로 사라진다.
    await db.query('DELETE FROM workflow WHERE id = $1', [workflowId]);
    // S — 커밋 뒤 정리. 아직 쓴 비밀이 없다.
    await deleteTriggerSecretsAfterCommit(secrets, logger, [triggerId], 'e2e');
    // A — 쓰기 경로가 정리보다 늦었다.
    await db.query(
      'INSERT INTO secret_store (ref, workspace_id, encrypted) VALUES ($1, $2, $3)',
      [
        `secret://triggers/${triggerId}/bot-token`,
        workspaceId,
        Buffer.from('ciphertext-placeholder'),
      ],
    );
    // R — 락 안 재기록은 행이 없어 쓰지 못한다.
    const wrote = await rewriteTriggerConfigLocked(
      ds.manager,
      triggerId,
      (config) => config,
    );
    expect(wrote).toBe(false);
    // **보상 전 상태가 판별 입력이다** — 여기서 1 이 아니면 아래 0 은 아무것도 증명하지 않는다.
    expect(await count()).toBe(1);

    // C — 보상.
    await undoAbsentTriggerWrite({ secrets, logger }, triggerId, 'e2e');

    expect(await count()).toBe(0);
    expect(logged).toEqual([]);
  });
});
