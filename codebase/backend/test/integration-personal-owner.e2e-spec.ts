import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';

/**
 * e2e: Personal 통합은 생성자에게만 보이고, Organization 통합의 변경은 Admin 이상이다.
 *
 * 근거: `spec/2-navigation/4-integration.md` §8 «판정 규칙» · Rationale «Personal 통합 소유자 강제 — 404 존재 은닉 ·
 * 역할 우위 없음 · 노드 실행은 후속». 2026-09-25 전에는 코드 어디도 `created_by` 를 보지 않았고, reauthorize 는 역할
 * 검사가 없어 Viewer 가 Organization 통합을 자기 외부 계정으로 재인증할 수 있었다.
 *
 * 보호 대상 invariants:
 *   - 남의 personal 은 목록에서 빠지고, `:id` 경로는 **없는 id 와 같은** `404 RESOURCE_NOT_FOUND` 다 — Owner 에게도
 *   - Organization 통합의 수정 · 삭제 · 재인증은 Editor · Viewer 에게 `403 ADMIN_REQUIRED` 다
 *   - `oauth/begin` 의 reauthorize 모드(`integrationId` 지정)도 같은 판정을 받는다 — `:id/reauthorize` 우회 입구가 아니다
 *   - 생성자는 자기 personal 을 바꾸고 지운다
 *
 * 액터: Owner(=Admin 이상, Organization 통합 생성) · Admin(승격) · Editor(personal 생성자) · Viewer.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** 어느 통합도 아닌 UUID(v4 형식) — «없는 통합» 의 기준 응답을 얻는 데 쓴다. */
const ABSENT_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

type Actor = { userId: string; accessToken: string };

describe('Integration personal-owner enforcement (e2e)', () => {
  let db: Client;
  let owner: Actor;
  let admin: Actor;
  let editor: Actor;
  let viewer: Actor;
  let ws: string;
  let personalId: string; // editor 의 personal
  let orgId: string; // owner 가 만든 organization

  const as = (actor: Actor) => ({
    get: (url: string) =>
      request(BASE_URL)
        .get(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws),
    post: (url: string, body: object = {}) =>
      request(BASE_URL)
        .post(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws)
        .send(body),
    patch: (url: string, body: object) =>
      request(BASE_URL)
        .patch(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws)
        .send(body),
    delete: (url: string) =>
      request(BASE_URL)
        .delete(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws),
  });

  const answerOf = (res: request.Response): string =>
    `${res.status} ${res.body?.error?.code ?? ''}`.trim();

  const createHttp = async (actor: Actor, scope: string): Promise<string> => {
    const res = await as(actor).post('/api/integrations', {
      serviceType: 'http',
      name: uniqueName(`ipo-${scope}`),
      authType: 'bearer_token',
      credentials: { token: `e2e-ipo-${scope}` },
      scope,
    });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    owner = await registerAndLogin(BASE_URL, uniqueEmail('ipo-own'), db);
    ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('IPO'),
    );
    editor = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('ipo-edit'),
      'editor',
      db,
    );
    viewer = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('ipo-view'),
      'viewer',
      db,
    );
    // 헬퍼 `inviteAndAccept` 는 admin 을 받지 않는다 — editor 로 초대한 뒤 owner 가 승격한다.
    admin = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('ipo-adm'),
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

    personalId = await createHttp(editor, 'personal');
    orgId = await createHttp(owner, 'organization');
  }, 120_000);

  afterAll(async () => {
    await db.end();
  });

  it('목록 — 남의 personal 은 Owner · Admin · Viewer 목록에서 빠지고, 생성자 목록에는 있다', async () => {
    const idsOf = async (actor: Actor) => {
      const res = await as(actor).get('/api/integrations?limit=100');
      expect(res.status).toBe(200);
      return (res.body.data as Array<{ id: string }>).map((r) => r.id);
    };
    for (const actor of [owner, admin, viewer]) {
      const ids = await idsOf(actor);
      expect(ids).not.toContain(personalId);
      expect(ids).toContain(orgId); // 목록 자체는 비어 있지 않다 — 공허성 가드
    }
    expect(await idsOf(editor)).toEqual(
      expect.arrayContaining([personalId, orgId]),
    );
  });

  /** 남의 personal 에 닿는 `:id` 경로 — 요청자는 Owner(최상위 역할)다. 역할 우위가 없음을 보인다. */
  it.each([
    ['GET /:id', (id: string) => as(owner).get(`/api/integrations/${id}`)],
    [
      'GET /:id/usages',
      (id: string) => as(owner).get(`/api/integrations/${id}/usages`),
    ],
    [
      'GET /:id/activity',
      (id: string) => as(owner).get(`/api/integrations/${id}/activity`),
    ],
    [
      'POST /:id/test',
      (id: string) => as(owner).post(`/api/integrations/${id}/test`),
    ],
    [
      'PATCH /:id',
      (id: string) =>
        as(owner).patch(`/api/integrations/${id}`, { name: uniqueName('x') }),
    ],
    [
      'POST /:id/reauthorize',
      (id: string) => as(owner).post(`/api/integrations/${id}/reauthorize`),
    ],
    [
      'PATCH /:id/scope',
      (id: string) =>
        as(owner).patch(`/api/integrations/${id}/scope`, {
          scope: 'organization',
        }),
    ],
    [
      'DELETE /:id',
      (id: string) => as(owner).delete(`/api/integrations/${id}`),
    ],
  ])(
    '%s — 남의 personal 은 Owner 에게도 없는 통합과 같은 404',
    async (_label, send) => {
      const absent = await send(ABSENT_ID);
      const hidden = await send(personalId);
      expect(answerOf(hidden)).toBe('404 RESOURCE_NOT_FOUND');
      expect(answerOf(hidden)).toBe(answerOf(absent));
      expect(hidden.body?.error?.message).toBe(absent.body?.error?.message);
    },
  );

  it('oauth/begin reauthorize 모드 — 남의 personal integrationId 는 404 (`:id/reauthorize` 우회 불가)', async () => {
    const res = await as(admin).post('/api/integrations/oauth/begin', {
      service: 'google',
      scopes: [],
      mode: 'reauthorize',
      integrationId: personalId,
    });
    expect(answerOf(res)).toBe('404 RESOURCE_NOT_FOUND');
  });

  it.each([
    ['Viewer', () => viewer],
    ['Editor', () => editor],
  ])(
    'Organization 통합 재인증 — %s 는 403 ADMIN_REQUIRED (`:id/reauthorize` · `oauth/begin` 둘 다)',
    async (_label, actorOf) => {
      const actor = actorOf();
      const direct = await as(actor).post(
        `/api/integrations/${orgId}/reauthorize`,
      );
      expect(answerOf(direct)).toBe('403 ADMIN_REQUIRED');
      const viaBegin = await as(actor).post('/api/integrations/oauth/begin', {
        service: 'google',
        scopes: [],
        mode: 'reauthorize',
        integrationId: orgId,
      });
      expect(answerOf(viaBegin)).toBe('403 ADMIN_REQUIRED');
    },
  );

  it('Organization 통합 — Editor 의 이름 변경 · 삭제는 403 ADMIN_REQUIRED, Admin 의 이름 변경은 200', async () => {
    const rename = await as(editor).patch(`/api/integrations/${orgId}`, {
      name: uniqueName('ed-rename'),
    });
    expect(answerOf(rename)).toBe('403 ADMIN_REQUIRED');
    const del = await as(editor).delete(`/api/integrations/${orgId}`);
    expect(answerOf(del)).toBe('403 ADMIN_REQUIRED');

    const byAdmin = await as(admin).patch(`/api/integrations/${orgId}`, {
      name: uniqueName('adm-rename'),
    });
    expect(byAdmin.status).toBe(200);
    // Organization 통합은 생성자가 아닌 멤버에게도 보인다.
    const read = await as(viewer).get(`/api/integrations/${orgId}`);
    expect(read.status).toBe(200);
  });

  it('생성자는 자기 personal 을 읽고 · 이름을 바꾸고 · 지운다', async () => {
    const read = await as(editor).get(`/api/integrations/${personalId}`);
    expect(read.status).toBe(200);
    const rename = await as(editor).patch(`/api/integrations/${personalId}`, {
      name: uniqueName('mine'),
    });
    expect(rename.status).toBe(200);
    const del = await as(editor).delete(`/api/integrations/${personalId}`);
    expect(del.status).toBe(204);
  });
});
