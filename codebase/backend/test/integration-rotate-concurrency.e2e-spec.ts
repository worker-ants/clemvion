import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 동시 rotate 의 lost update — spec/2-navigation/4-integration.md §9.2 rotate.
 *
 * 보호 대상: `rotate()` 가 **요청 시작 시점 스냅샷**이 아니라 **락 안에서 다시 읽은 행** 위에 머지한다.
 * 그러지 않으면 연결 테스트(실제 접속이라 수 초)가 도는 동안 다른 요청이 커밋한 필드가 옛 값으로 되돌아간다.
 *
 * **겹침을 우연에 맡기지 않는다** — 테스트가 그 행의 락을 직접 쥔다(`SELECT … FOR UPDATE`, 자기 커넥션).
 * 그래야 «rotate 가 읽은 뒤, 쓰기 전에, 다른 교체가 커밋된다» 는 전제가 매번 성립한다.
 * 선례: `plan/complete/trigger-config-lost-update.md` §C (advisory lock 을 테스트가 쥐는 같은 기법).
 *
 * **동시 교체를 어떻게 흉내 내나**: `credentials` 는 컬럼 transformer 가 암호화하므로 평문 JSONB 를 SQL 로 써넣을
 * 수 없고, 락을 쥔 채 rotate API 를 한 번 더 부르면 그 호출까지 같은 락에 막힌다. 그래서 **donor 통합을 API 로
 * 만들어 두고 그 행의 암호문을 복사**한다 — transformer 는 전역 키 + 값 안의 IV 라 행에 묶이지 않는다.
 *
 * 판별력: 고치기 전 코드는 donor 가 넣은 `key_name` 을 옛 스냅샷 값으로 되돌린다(①이 RED).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Integration rotate concurrency (e2e)', () => {
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
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('rotconc'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('ROTCONC'),
    );
  }, 60_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  /** base_url 이 없는 HTTP 통합 — 연결 테스터가 외부로 나가지 않는다(연결 테스트 e2e 의 D · E 와 같은 패턴). */
  async function createApiKeyIntegration(keyName: string): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/integrations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        serviceType: 'http',
        name: uniqueName('rot-conc'),
        authType: 'api_key',
        credentials: {
          location: 'header',
          key_name: keyName,
          value: 'old-secret',
        },
        scope: 'personal',
      });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  }

  it('연결 테스트 동안 다른 요청이 커밋한 필드를 되돌리지 않는다', async () => {
    const target = await createApiKeyIntegration('X-Api-Key');
    // donor — 「동시 rotate 가 key_name 을 이 값으로 바꿔 커밋했다」 는 상태의 암호문 공급원.
    const donor = await createApiKeyIntegration('X-Concurrent');

    // ── 테스트가 락을 쥔다. 이 행에 대한 rotate 의 쓰기(고치기 전) · 재읽기(고친 뒤)가 COMMIT 까지 멈춘다.
    await locker.query('BEGIN');
    await locker.query('SELECT id FROM integration WHERE id = $1 FOR UPDATE', [
      target,
    ]);

    // 요청 B: `value` 만 바꾼다. 시작 시점 스냅샷의 key_name 은 아직 'X-Api-Key' 다.
    const rotateB = request(BASE_URL)
      .post(`/api/integrations/${target}/rotate`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ credentials: { value: 'new-secret' } });
    const pending = rotateB.then(
      (res) => ({ settled: true as const, status: res.status }),
      (err: Error) => ({ settled: true as const, status: -1, err }),
    );

    // 요청 A 를 대신한다 — 락을 쥔 채 donor 의 암호문을 복사해 「다른 필드가 방금 교체됐다」 를 만든다.
    await locker.query(
      `UPDATE integration
          SET credentials = (SELECT credentials FROM integration WHERE id = $2),
              last_rotated_at = now()
        WHERE id = $1`,
      [target, donor],
    );

    // 공허성 가드 — 락을 놓기 **전에** B 가 아직 끝나지 않았음을 관측한다. 먼저 끝났다면 이 fixture 는
    // 겹침을 만들지 못한 것이고, 아래 단언은 고치기 전 코드도 통과시킨다.
    const raced = await Promise.race([
      pending,
      new Promise<{ settled: false }>((resolve) =>
        setTimeout(() => resolve({ settled: false }), 1_500),
      ),
    ]);
    expect(raced.settled).toBe(false);

    const donorCipher = (
      await db.query<{ credentials: string }>(
        'SELECT credentials::text AS credentials FROM integration WHERE id = $1',
        [donor],
      )
    ).rows[0].credentials;

    await locker.query('COMMIT');
    // POST 라 201 이다(인접 e2e 도 `[200, 201]` 로 받는다) — 여기서 보려는 것은 «막혔다 풀려서 성공했다» 다.
    expect([200, 201]).toContain((await pending).status);

    const after = await request(BASE_URL)
      .get(`/api/integrations/${target}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(after.status).toBe(200);
    const creds = (after.body.data as { credentials: Record<string, unknown> })
      .credentials;

    // ① 동시 교체가 넣은 필드가 살아 있다 — 고치기 전에는 'X-Api-Key' 로 되돌아간다.
    expect(creds.key_name).toBe('X-Concurrent');
    // ② 그리고 B 도 실제로 저장했다 — 비밀 필드는 마스킹되므로 암호문이 donor 의 것과 달라진 것으로 본다
    //    (같은 평문도 매 저장마다 새 IV 라 «달라졌다» 는 «저장이 일어났다» 를 뜻한다 — 연결 테스트 e2e 의 D 와 같은 판정).
    const afterCipher = (
      await db.query<{ credentials: string }>(
        'SELECT credentials::text AS credentials FROM integration WHERE id = $1',
        [target],
      )
    ).rows[0].credentials;
    expect(afterCipher).not.toBe(donorCipher);
    expect(creds.value).toBe('********');
  }, 60_000);
});
