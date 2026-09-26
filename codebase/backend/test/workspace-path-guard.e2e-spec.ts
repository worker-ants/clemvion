import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';
import { NIL_WS } from '../src/common/__test-utils__/workspace-id-fixtures';

/**
 * e2e: 경로로 워크스페이스를 받는 라우트도 `RolesGuard` 가 본다 — `@WorkspaceParam('id')`.
 *
 * 근거: `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" ·
 * "가드 거부의 오류 코드". 2026-09-25 전에는 `workspaces.controller.ts` 14곳 · 전환 1곳이 평범한
 * `@Param('id')` 라 가드가 경로 값을 보지 않았고, 인가는 서비스 계층 검사에만 남았다.
 *
 * 보호 대상 invariants:
 *   - 비멤버는 워크스페이스의 **존재 · 유형과 무관하게** 같은 `403 NOT_A_MEMBER` 를 받는다
 *     (종전 `leaveWorkspace` · `addMemberByEmail` 은 없음 404 · 개인 · 팀을 구분해 답했다)
 *   - 멤버의 역할 미달은 라우트가 요구하는 최소 역할의 코드다
 *   - 형식이 아닌 경로 값은 `400`(내장 `ParseUUIDPipe`), 형식은 맞는 nil UUID 는 `403`
 *   - `@Roles('owner')` 는 **경로 워크스페이스**에 대해 판정한다 — 헤더 · 토큰의 워크스페이스가 아니다
 *
 * 헤더를 붙이지 않는 요청이 기본이다 — 경로 라우트는 헤더를 쓰지 않으므로 헤더는 결과를 바꾸면 안
 * 되고, 헤더를 붙이는 케이스는 그 성질을 보려고 일부러 붙인다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** 어느 워크스페이스에도 없는 UUID(v4 형식). */
const ABSENT_WS = '7d3b1c52-0d7e-4a8e-9f0b-5b2f4c6a1e90';

describe('Workspace path guard (e2e)', () => {
  let db: Client;
  let owner: { userId: string; accessToken: string };
  let viewer: { userId: string; accessToken: string };
  let admin: { userId: string; accessToken: string };
  let outsider: { userId: string; accessToken: string };
  let ws: string;
  let ownerPersonalWs: string;

  const answerOf = (res: request.Response): string =>
    `${res.status} ${res.body?.error?.code ?? ''}`.trim();

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    owner = await registerAndLogin(BASE_URL, uniqueEmail('wpg-own'), db);
    ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('WPG'),
    );
    viewer = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('wpg-view'),
      'viewer',
      db,
    );
    // 초대 API 는 admin 역할도 받지만 헬퍼 `inviteAndAccept` 의 타입이 admin 을 빼 둔다 — editor 로
    // 초대한 뒤 owner 가 승격한다. 그 PATCH 가 Admin 라우트의 성공 경로(owner → 200)도 함께 확인한다.
    admin = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('wpg-adm'),
      'editor',
      db,
    );
    const adminMember = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [ws, admin.userId],
    );
    const promote = await request(BASE_URL)
      .patch(`/api/workspaces/${ws}/members/${adminMember.rows[0].id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'admin' });
    expect(promote.status).toBe(200);

    outsider = await registerAndLogin(BASE_URL, uniqueEmail('wpg-out'), db);

    const personal = await db.query<{ id: string }>(
      `SELECT w.id FROM workspace w
         JOIN workspace_member m ON m.workspace_id = w.id
        WHERE m.user_id = $1 AND w.type = 'personal'`,
      [owner.userId],
    );
    expect(personal.rows).toHaveLength(1);
    ownerPersonalWs = personal.rows[0].id;
  }, 120_000);

  afterAll(async () => {
    await db.end();
  });

  /**
   * 라우트 클래스(멤버 · Admin · Owner) 하나씩 + 오라클이 있던 두 라우트(`leave` · `addMember`).
   * 비멤버의 답이 대상 워크스페이스의 상태(팀 · 개인 · 부재)에 따라 달라지면 그 자체가 누설이다.
   */
  it.each([
    [
      '멤버 — GET /:id/members',
      'get',
      (id: string) => `/api/workspaces/${id}/members`,
      undefined,
    ],
    [
      'Admin — GET /:id/invitations',
      'get',
      (id: string) => `/api/workspaces/${id}/invitations`,
      undefined,
    ],
    [
      'Owner — DELETE /:id',
      'delete',
      (id: string) => `/api/workspaces/${id}`,
      undefined,
    ],
    [
      '멤버 — POST /:id/leave (종전 오라클)',
      'post',
      (id: string) => `/api/workspaces/${id}/leave`,
      {},
    ],
    [
      // 종전엔 가드가 토큰 워크스페이스(누구나 personal 의 owner)로 판정해 서비스까지 닿았고, 서비스는
      // 워크스페이스를 먼저 읽어 «없음 404 · 개인 · 팀 비-owner» 로 갈렸다.
      'Owner — POST /:id/transfer-ownership (종전 오라클)',
      'post',
      (id: string) => `/api/workspaces/${id}/transfer-ownership`,
      { newOwnerMemberId: ABSENT_WS },
    ],
    [
      'Admin — POST /:id/members (종전 오라클)',
      'post',
      (id: string) => `/api/workspaces/${id}/members`,
      { email: 'nobody@example.com', role: 'editor' },
    ],
  ] as const)(
    '%s — 비멤버는 팀 · 개인 · 부재 워크스페이스 모두 403 NOT_A_MEMBER',
    async (_label, method, pathOf, body) => {
      const probe = async (id: string): Promise<string> => {
        let req = request(BASE_URL)
          [method](pathOf(id))
          .set('Authorization', `Bearer ${outsider.accessToken}`);
        if (body !== undefined) req = req.send(body);
        return answerOf(await req);
      };

      const answers = [
        await probe(ws),
        await probe(ownerPersonalWs),
        await probe(ABSENT_WS),
      ];
      expect(answers).toEqual([
        '403 NOT_A_MEMBER',
        '403 NOT_A_MEMBER',
        '403 NOT_A_MEMBER',
      ]);
    },
    60_000,
  );

  it('멤버의 역할 미달은 라우트가 요구하는 최소 역할의 코드다', async () => {
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

    // Admin 라우트 — viewer 는 ADMIN_REQUIRED. 초대 라우트는 종전에 서비스가 소문자
    // `admin_required` 로 답했다(가드가 먼저 막아 이제 대문자 코드다).
    const listInv = await request(BASE_URL)
      .get(`/api/workspaces/${ws}/invitations`)
      .set(auth(viewer.accessToken));
    expect(answerOf(listInv)).toBe('403 ADMIN_REQUIRED');
    const createInv = await request(BASE_URL)
      .post(`/api/workspaces/${ws}/invitations`)
      .set(auth(viewer.accessToken))
      .send({ email: uniqueEmail('wpg-inv'), role: 'viewer' });
    expect(answerOf(createInv)).toBe('403 ADMIN_REQUIRED');

    // Owner 라우트 — admin 은 OWNER_REQUIRED.
    const del = await request(BASE_URL)
      .delete(`/api/workspaces/${ws}`)
      .set(auth(admin.accessToken));
    expect(answerOf(del)).toBe('403 OWNER_REQUIRED');

    // 멤버 라우트 — viewer 도 통과한다.
    const members = await request(BASE_URL)
      .get(`/api/workspaces/${ws}/members`)
      .set(auth(viewer.accessToken));
    expect(members.status).toBe(200);

    // 워크스페이스는 그대로다.
    const still = await db.query('SELECT 1 FROM workspace WHERE id = $1', [ws]);
    expect(still.rows).toHaveLength(1);
  }, 60_000);

  it('형식이 아닌 경로 값은 400, 형식은 맞는 nil UUID 는 403 NOT_A_MEMBER', async () => {
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const paths = (id: string) => [
      request(BASE_URL).get(`/api/workspaces/${id}/members`).set(auth),
      request(BASE_URL).get(`/api/workspaces/${id}/invitations`).set(auth),
      request(BASE_URL).delete(`/api/workspaces/${id}`).set(auth),
      request(BASE_URL).post(`/api/auth/workspaces/${id}/switch`).set(auth),
    ];

    // 가드는 파이프보다 먼저 돈다 — 형식이 아니면 판정하지 않고 넘기고, 내장 파이프가 400 을 낸다.
    for (const res of await Promise.all(paths('not-a-uuid'))) {
      expect(res.status).toBe(400);
    }
    // 종전 `ParseUUIDPipe` 400 이던 자리 — 이제 가드가 조회해 403 이다.
    for (const res of await Promise.all(paths(NIL_WS))) {
      expect(answerOf(res)).toBe('403 NOT_A_MEMBER');
    }
  }, 60_000);

  it('경로 라우트는 헤더를 쓰지 않는다 — 형식이 깨진 X-Workspace-Id 여도 400 이 아니다', async () => {
    const res = await request(BASE_URL)
      .get(`/api/workspaces/${ws}/members`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('X-Workspace-Id', 'not-a-uuid');
    expect(res.status).toBe(200);
  }, 60_000);

  /**
   * 판별 케이스 — 종전 가드는 `@Roles('owner')` 를 **헤더 · 토큰의 워크스페이스**로 판정했다. 그래서
   * 자기 워크스페이스의 owner 가 헤더에 viewer 인 다른 워크스페이스를 실어 보내면 정당한 이양이 403
   * 이었고, 반대로 헤더에 자기 owner 워크스페이스를 실으면 남의 워크스페이스에서 가드를 통과했다
   * (서비스가 뒤에서 막았다). 두 방향을 다 본다.
   */
  describe('transferOwnership 은 경로 워크스페이스로 판정한다', () => {
    it('경로 워크스페이스의 owner 는 헤더가 viewer 인 워크스페이스를 가리켜도 이양할 수 있다', async () => {
      // viewer 는 ws 의 viewer 이고, 자기 팀 워크스페이스 wsV 의 owner 다.
      const wsV = await createTeamWorkspace(
        BASE_URL,
        viewer.accessToken,
        uniqueName('WPGV'),
      );
      const heir = await inviteAndAccept(
        BASE_URL,
        viewer.accessToken,
        wsV,
        uniqueEmail('wpg-heir'),
        'editor',
        db,
      );
      const heirMember = await db.query<{ id: string }>(
        'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
        [wsV, heir.userId],
      );

      const transfer = await request(BASE_URL)
        .post(`/api/workspaces/${wsV}/transfer-ownership`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .set('X-Workspace-Id', ws)
        .send({ newOwnerMemberId: heirMember.rows[0].id });
      // 종전 가드는 헤더 워크스페이스(viewer)로 판정해 여기서 403 이었다.
      expect(transfer.status).toBe(200);

      const roles = await db.query<{ user_id: string; role: string }>(
        'SELECT user_id, role FROM workspace_member WHERE workspace_id = $1',
        [wsV],
      );
      expect(roles.rows.find((r) => r.user_id === heir.userId)?.role).toBe(
        'owner',
      );
    }, 60_000);

    it('헤더에 자기 owner 워크스페이스를 실어도 경로 워크스페이스의 owner 가 아니면 가드가 막는다', async () => {
      const viewerMember = await db.query<{ id: string }>(
        'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
        [ws, viewer.userId],
      );
      // admin 은 ws 의 admin 이고, 자기 personal 워크스페이스의 owner 다.
      const adminPersonal = await db.query<{ id: string }>(
        `SELECT w.id FROM workspace w
           JOIN workspace_member m ON m.workspace_id = w.id
          WHERE m.user_id = $1 AND w.type = 'personal' AND m.role = 'owner'`,
        [admin.userId],
      );
      expect(adminPersonal.rows).toHaveLength(1);
      const res = await request(BASE_URL)
        .post(`/api/workspaces/${ws}/transfer-ownership`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .set('X-Workspace-Id', adminPersonal.rows[0].id)
        .send({ newOwnerMemberId: viewerMember.rows[0].id });
      expect(answerOf(res)).toBe('403 OWNER_REQUIRED');
      // 본문 메시지로 **어느 층이** 막았는지 가른다 — 서비스의 OWNER_REQUIRED 는 «owner 이양은 현재
      // owner 만 수행할 수 있습니다.» 이고, 가드의 것은 아래 문장이다. 코드만 보면 두 층이 같아
      // 가드가 빠져도 이 테스트가 초록이 된다.
      expect(res.body.error.message).toBe('Owner 권한이 필요합니다.');
    }, 60_000);
  });
});
