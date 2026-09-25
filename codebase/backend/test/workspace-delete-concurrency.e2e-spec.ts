import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import { raceUnderHeldLock } from './helpers/concurrency';

/**
 * e2e: 동시 워크스페이스 DELETE — `workflow-delete-concurrency.e2e-spec.ts` 의 워크스페이스 짝.
 *
 * 보호 대상: 진 쪽이 **404** 를 받는다. 종전엔 403(`OWNER_REQUIRED`)이었다 —
 * `assertWorkspaceDeletable` 이 멤버십을 존재보다 **먼저** 보는데, 이긴 쪽이 커밋하며 멤버 행까지
 * 지워 «owner 가 아니다» 로 읽혔기 때문이다. 그리고 바깥 `.catch` 가 그것을 «수동 정리가 필요하다» 는
 * 거짓 ERROR 로 남겼다.
 *
 * **이 테스트가 있어야 하는 이유**: 그 결함은 단위 mock 으로는 보이지 않는다. mock 은
 * `parentPresence: 'absent'` 를 **직접 주입**하므로 «멤버 행도 함께 사라진다» 는 현실을 재현하지
 * 못한다(그 비대칭을 `/ai-review` `review/code/2026/09/20/20_06_26` WARNING 1 이 읽기로 잡았고,
 * `20_43_03` WARNING 1 이 «실 DB 로 고정하라» 고 요구했다).
 *
 * 겹침은 우연에 맡기지 않는다 — 테스트가 그 워크스페이스 행의 락을 직접 쥔다.
 *
 * **404 는 «둘 다 가드를 지난 뒤 서비스의 락에서 만난» 경우의 답이다** (2026-09-25~). `RolesGuard` 가
 * 경로 워크스페이스(`@WorkspaceParam`)의 멤버십을 먼저 조회하는데, 그 조회는 `workspace_member` 의
 * 잠금 없는 SELECT 라 이 테스트의 워크스페이스 행 락에 막히지 않는다 — 두 요청 모두 멤버로 읽혀
 * 통과한다. 이긴 쪽이 **커밋한 뒤에** 도착한 요청은 가드가 `403 NOT_A_MEMBER` 로 막는다(부재와
 * 비멤버를 구분하지 않는다 — `data-flow/12-workspace.md` §"가드 거부의 오류 코드"). 그건 의도된 답이다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Workspace delete concurrency (e2e)', () => {
  let db: Client;
  /** 락을 쥐는 쪽 — 요청이 도는 동안 열려 있어야 하므로 별도 커넥션이다. */
  let locker: Client;
  let token: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('wsdel'), db);
    token = owner.accessToken;
  }, 60_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  it('두 DELETE 가 겹치면 진 쪽은 404 다 — 403 이 아니다', async () => {
    const workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('WSDEL'),
    );

    const fireDelete = () =>
      request(BASE_URL)
        .delete(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .then(
          (res) => ({ status: res.status, code: res.body?.error?.code }),
          () => ({ status: -1, code: undefined }),
        );

    // 공허성 가드(겹침을 실제로 만들었는가)는 헬퍼가 건다 — `helpers/concurrency.ts`.
    const results = (
      await raceUnderHeldLock<{ status: number; code?: string }>(
        locker,
        {
          sql: 'SELECT id FROM workspace WHERE id = $1 FOR UPDATE',
          params: [workspaceId],
        },
        [fireDelete, fireDelete],
      )
    ).sort((a, b) => a.status - b.status);

    expect(results.map((r) => r.status)).toEqual([200, 404]);
    // 코드까지 본다 — 상태만 보면 `WORKSPACE_NOT_FOUND` 가 아닌 404 로 바뀌어도 통과한다.
    expect(results[1].code).toBe('WORKSPACE_NOT_FOUND');

    // 연관 리소스도 함께 정리됐다 — 진 쪽이 롤백돼도 이긴 쪽의 삭제는 온전하다.
    const rows = await db.query<{ count: string }>(
      `SELECT (SELECT COUNT(*) FROM workspace WHERE id = $1)
            + (SELECT COUNT(*) FROM workspace_member WHERE workspace_id = $1)
            + (SELECT COUNT(*) FROM workspace_invitation WHERE workspace_id = $1) AS count`,
      [workspaceId],
    );
    expect(rows.rows[0].count).toBe('0');
  }, 60_000);
});
