import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import { raceUnderHeldLock } from './helpers/concurrency';

/**
 * e2e: 동시 모델 설정 DELETE — 이 결함 클래스의 여덟 번째 짝
 * (`workflow-`/`workspace-`/`trigger-`/`schedule-`/`integration-`/`auth-config-delete-concurrency` ·
 * `member-remove-concurrency`).
 *
 * 보호 대상: 두 요청이 겹쳐도 **`model_config.delete` 감사 행은 하나**이고, 진 쪽은 404 를 받는다.
 *
 * 처방은 형제들과 같다 — 이 경로에도 잠글 것이 없어 락을 새로 들이지 않고
 * **단일 원자적 `DELETE` 의 `affected`** 를 판별자로 쓴다.
 *
 * **진 쪽 코드가 형제들과 다르다**: 이 모듈은 `RESOURCE_NOT_FOUND` 가 아니라 도메인 고유
 * `MODEL_CONFIG_NOT_FOUND` 를 쓴다(`findEntity` 와 같은 `notFound()` 헬퍼). 형제 단언을 그대로
 * 베끼면 틀린다 — 진 쪽이 조회 실패와 **같은 코드**를 받아야 «없어서 404» 와 «져서 404» 가
 * 클라이언트에게 구분되지 않는다.
 *
 * 겹침은 테스트가 만든다 — `model_config` 행 자체를 `SELECT … FOR UPDATE` 로 쥔다.
 *
 * 판별력: 고치기 전 코드는 **둘 다 204** 를 돌려주고 감사 행이 **2** 가 된다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Model config delete concurrency (e2e)', () => {
  let db: Client;
  /** 락을 쥐는 쪽 — 요청이 도는 동안 열려 있어야 하므로 별도 커넥션이다. */
  let locker: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('mcdel'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('MCDEL'),
    );
  }, 60_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  it('두 DELETE 가 겹쳐도 감사 행은 하나이고 진 쪽은 404 다', async () => {
    // `isDefault: false` — `remove()` 는 `isDefault`/`saveWithDefaultSwap` 을 전혀 참조하지
    // 않으므로(실측) 판별에는 영향 없다. 다른 형제 e2e 와 fixture 형태를 맞추기 위한 고정값이다.
    const create = await request(BASE_URL)
      .post('/api/model-configs')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        kind: 'chat',
        provider: 'openai',
        name: uniqueName('mcdel-target'),
        apiKey: 'stub-not-used',
        defaultModel: 'stub-model',
        defaultParams: {},
        isDefault: false,
      });
    expect(create.status).toBe(201);
    const id = (create.body.data as { id: string }).id;

    const fireDelete = () =>
      request(BASE_URL)
        .delete(`/api/model-configs/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .then(
          (res) => ({ status: res.status, code: res.body?.error?.code }),
          () => ({ status: -1, code: undefined as string | undefined }),
        );

    // 둘 다 무락 `findEntity` 를 통과한 뒤 DELETE 에서 이 락을 기다린다.
    // 공허성 가드(겹침을 실제로 만들었는가)는 헬퍼가 건다 — `helpers/concurrency.ts`.
    const results = (
      await raceUnderHeldLock<{ status: number; code?: string }>(
        locker,
        {
          sql: 'SELECT id FROM model_config WHERE id = $1 FOR UPDATE',
          params: [id],
        },
        [fireDelete, fireDelete],
      )
    ).sort((a, b) => a.status - b.status);

    // 하나는 지우고(204), 다른 하나는 이미 없다(404 MODEL_CONFIG_NOT_FOUND).
    expect(results.map((r) => r.status)).toEqual([204, 404]);
    expect(results[1].code).toBe('MODEL_CONFIG_NOT_FOUND');

    const audits = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log
        WHERE resource_type = 'model_config' AND resource_id = $1
          AND action = 'model_config.delete'`,
      [id],
    );
    expect(audits.rows[0].count).toBe('1');
  }, 60_000);
});
