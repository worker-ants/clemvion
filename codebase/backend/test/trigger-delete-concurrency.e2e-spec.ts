import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock';
import { raceUnderHeldLock } from './helpers/concurrency';

/**
 * e2e: 동시 트리거 DELETE — `workflow-/workspace-delete-concurrency.e2e-spec.ts` 의 세 번째 짝.
 *
 * 보호 대상: 두 요청이 겹쳐도 **`trigger.deleted` 감사 행은 하나**이고, 진 쪽은 404 를 받는다
 * (spec 트리거 목록 §4.4 가 정한 계약).
 *
 * **락의 종류가 형제 둘과 다르다.** 워크플로·워크스페이스는 부모 행을 `pessimistic_write` 로 잠그지만
 * 트리거 삭제는 **advisory lock**(`pg_advisory_xact_lock(hashtext('trigger-config:<id>'))`)을 쓴다 —
 * 행을 읽지 않으므로 «잠근 뒤 아직 있나» 를 따로 물어야 한다. 그래서 이 테스트도 행 락이 아니라
 * **같은 advisory key** 를 쥔다.
 *
 * **대기 상한이 판정에 끼어든다**: 삭제 경로는 락을 잡기 전에 `lock_timeout = 5000ms` 를 건다
 * (`TRIGGER_DELETE_LOCK_TIMEOUT_MS`). 테스트가 5초 넘게 쥐면 두 요청 **모두** 타임아웃으로 실패해
 * fixture 가 «겹침» 이 아니라 «둘 다 실패» 를 본다 — 그래서 1.5초만 쥔다.
 *
 * 판별력: 고치기 전 코드는 **둘 다 204** 를 돌려주고 감사 행이 **2** 가 된다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Trigger delete concurrency (e2e)', () => {
  let db: Client;
  /** 락을 쥐는 쪽 — 요청이 도는 동안 열려 있어야 하므로 별도 커넥션이다. */
  let locker: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('trgdel'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('TRGDEL'),
    );
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('trgdel-wf') });
    expect(wf.status).toBe(201);
    workflowId = (wf.body.data as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  it('두 DELETE 가 겹쳐도 감사 행은 하나이고 진 쪽은 404 다', async () => {
    // chatChannel 없는 webhook 트리거 — 외부 provider 호출을 만들지 않는다.
    const create = await request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        workflowId,
        type: 'webhook',
        name: uniqueName('trgdel-target'),
        // 서버가 endpoint_path 에 v4 UUID 형식을 강제한다.
        endpointPath: crypto.randomUUID(),
      });
    expect(create.status).toBe(201);
    const id = (create.body.data as { id: string }).id;

    const fireDelete = () =>
      request(BASE_URL)
        .delete(`/api/triggers/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .then(
          (res) => res.status,
          () => -1,
        );

    // 둘 다 잠금 없는 선조회를 통과한 뒤 트랜잭션 안에서 이 락을 기다린다.
    // 공허성 가드(겹침을 실제로 만들었는가)는 헬퍼가 건다 — `helpers/concurrency.ts`.
    const statuses = (
      await raceUnderHeldLock(
        locker,
        {
          sql: 'SELECT pg_advisory_xact_lock(hashtext($1))',
          params: [triggerConfigLockKey(id)],
        },
        [fireDelete, fireDelete],
      )
    ).sort((a, b) => a - b);

    // 하나는 지우고(204), 다른 하나는 이미 없다(404). 5초 상한에 걸렸다면 여기에 5xx 가 섞인다.
    expect(statuses).toEqual([204, 404]);

    const audits = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log
        WHERE resource_type = 'trigger' AND resource_id = $1 AND action = 'trigger.deleted'`,
      [id],
    );
    expect(audits.rows[0].count).toBe('1');
  }, 60_000);
});
