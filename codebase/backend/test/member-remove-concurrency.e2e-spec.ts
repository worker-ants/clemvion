import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';
import { raceUnderHeldLock } from './helpers/concurrency';

/**
 * e2e: 동시 멤버 제거 — 이 결함 클래스의 여섯 번째 짝
 * (`workflow-`/`workspace-`/`trigger-`/`schedule-`/`integration-delete-concurrency.e2e-spec.ts`).
 *
 * 보호 대상: 두 요청이 겹쳐도 **`member.removed` 감사 행은 하나**이고, 진 쪽은 404 를 받는다.
 *
 * **형제들을 그대로 베끼면 틀리는 자리가 둘 있다.**
 *
 * 1. 이 라우트는 204 가 아니라 **`200 {data:{ok:true}}`** 다. 성공 코드는 라우트별이 아니라
 *    **컨트롤러별로 갈린다** — `workflows`/`triggers`/`schedules`/`integrations` 컨트롤러는 각각
 *    `HttpCode(204)` 를 하나씩 갖는데 `workspaces.controller.ts` 는 **하나도 없고** `{ok:true}` 를
 *    다섯 곳에서 돌려준다(실측). 그래서 같은 파일의 `workspace-delete-concurrency.e2e-spec.ts` 도
 *    이미 `[200, 404]` 로 단언한다.
 * 2. 자가 탈퇴와 admin 제거가 **같은 감사 액션**(`member.removed`)을 쓰고 `details.mode`
 *    (`left` / `removed`)로만 갈린다. 그래서 감사를 셀 때 `mode='removed'` 까지 걸어야
 *    자가 탈퇴 경로와 섞이지 않는다 — 형제들은 액션 이름만으로 갈렸다.
 *
 * 겹침은 테스트가 만든다 — 통합 짝과 같이 **멤버 행 자체를 `SELECT … FOR UPDATE` 로** 쥔다.
 * 두 요청 모두 무락 조회와 가드(owner 금지 · admin 확인)를 통과한 뒤 삭제에서 멈추고,
 * COMMIT 으로 함께 풀린다.
 *
 * 판별력: 고치기 전 코드는 **둘 다 200** 을 돌려주고 감사 행이 **2** 가 된다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Workspace member remove concurrency (e2e)', () => {
  let db: Client;
  /** 락을 쥐는 쪽 — 요청이 도는 동안 열려 있어야 하므로 별도 커넥션이다. */
  let locker: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('memdel'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('MEMDEL'),
    );
    // 초대 엔드포인트의 분당 throttler 때문에 헬퍼가 최대 ~30s backoff 재시도를 한다.
  }, 120_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  it('두 제거 요청이 겹쳐도 감사 행은 하나이고 진 쪽은 404 다', async () => {
    const invitee = await inviteAndAccept(
      BASE_URL,
      ownerToken,
      workspaceId,
      uniqueEmail('memdel-target'),
      'editor',
      db,
    );

    const memberRow = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, invitee.userId],
    );
    expect(memberRow.rows).toHaveLength(1);
    const memberId = memberRow.rows[0].id;

    const fireRemove = () =>
      request(BASE_URL)
        .delete(`/api/workspaces/${workspaceId}/members/${memberId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Workspace-Id', workspaceId)
        .then(
          (res) => ({ status: res.status, code: res.body?.error?.code }),
          () => ({ status: -1, code: undefined as string | undefined }),
        );

    // 둘 다 무락 조회·가드를 통과한 뒤 삭제에서 이 락을 기다린다.
    // 공허성 가드(겹침을 실제로 만들었는가)는 헬퍼가 건다 — `helpers/concurrency.ts`.
    const results = (
      await raceUnderHeldLock<{ status: number; code?: string }>(
        locker,
        {
          sql: 'SELECT id FROM workspace_member WHERE id = $1 FOR UPDATE',
          params: [memberId],
        },
        [fireRemove, fireRemove],
      )
    ).sort((a, b) => a.status - b.status);

    // 하나는 지우고(200), 다른 하나는 이미 없다(404 MEMBER_NOT_FOUND).
    expect(results.map((r) => r.status)).toEqual([200, 404]);
    expect(results[1].code).toBe('MEMBER_NOT_FOUND');

    // `mode='removed'` 로 걸러야 한다 — 자가 탈퇴(`left`)가 같은 액션 이름을 쓴다.
    const audits = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log
        WHERE resource_type = 'member' AND resource_id = $1
          AND action = 'member.removed'
          AND details->>'mode' = 'removed'`,
      [memberId],
    );
    expect(audits.rows[0].count).toBe('1');
  }, 120_000);

  /**
   * 자가 탈퇴 갈래는 **이 PR 이 고치는 자리가 아니다** — `removeMember()` 가
   * `member.userId === requesterId` 일 때 `leaveWorkspace()` 로 위임하고, 그쪽은 트랜잭션 안에서
   * `pessimistic_write` 로 멤버십을 다시 읽으므로 진 쪽이 애초에 감사를 남기지 않는다.
   *
   * 그 문장을 트래커에 두 번 적었지만 코드로 확인한 적은 없었다. 위임 경계가 조용히 사라지면
   * (예: 누가 `leaveWorkspace` 의 락을 걷어내면) 같은 결함이 이 라우트로 되돌아오므로 고정한다.
   */
  it('자가 탈퇴 갈래는 이미 닫혀 있다 — 진 쪽은 403 이고 감사가 없다', async () => {
    const leaver = await inviteAndAccept(
      BASE_URL,
      ownerToken,
      workspaceId,
      uniqueEmail('memleave'),
      'editor',
      db,
    );

    const memberRow = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, leaver.userId],
    );
    expect(memberRow.rows).toHaveLength(1);
    const memberId = memberRow.rows[0].id;

    // 본인 토큰으로 본인 멤버 행을 지운다 → removeMember 가 leaveWorkspace 로 위임한다.
    const fireLeave = () =>
      request(BASE_URL)
        .delete(`/api/workspaces/${workspaceId}/members/${memberId}`)
        .set('Authorization', `Bearer ${leaver.accessToken}`)
        .set('X-Workspace-Id', workspaceId)
        .then(
          (res) => ({ status: res.status, code: res.body?.error?.code }),
          () => ({ status: -1, code: undefined as string | undefined }),
        );

    // 공허성 가드(겹침을 실제로 만들었는가)는 헬퍼가 건다 — `helpers/concurrency.ts`.
    const results = (
      await raceUnderHeldLock<{ status: number; code?: string }>(
        locker,
        {
          sql: 'SELECT id FROM workspace_member WHERE id = $1 FOR UPDATE',
          params: [memberId],
        },
        [fireLeave, fireLeave],
      )
    ).sort((a, b) => a.status - b.status);

    // 진 쪽은 404 가 아니라 403 이다 — 락 안에서 다시 읽어 «멤버가 아니다» 로 끝난다.
    expect(results.map((r) => r.status)).toEqual([200, 403]);
    expect(results[1].code).toBe('NOT_A_MEMBER');

    const audits = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log
        WHERE resource_type = 'member' AND resource_id = $1
          AND action = 'member.removed'
          AND details->>'mode' = 'left'`,
      [memberId],
    );
    expect(audits.rows[0].count).toBe('1');
  }, 120_000);
});
