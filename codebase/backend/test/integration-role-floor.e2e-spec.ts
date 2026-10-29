import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';

/**
 * e2e: 통합 쓰기 라우트의 역할 하한 (NERV Task CLE-T-JQVHFJ).
 *
 * 근거: [통합 관리 「권한」](CLE-INT-MANAGE#권한) REQ-INTMGMT-031 · 035 · 051 · 060 · 061,
 * [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH) REQ-INTOAUTH-026 · 063 · 064.
 *
 * 보호 대상 invariants:
 *   - 뷰어는 개인 통합을 만들거나 바꾸지 못한다. 생성 · 별칭 수정 · 교체 · 재인증 · 추가 권한 요청 · 저장 전 연결 테스트 ·
 *     `oauth/begin` 의 `new` 모드가 대상과 상관없이 `403 EDITOR_REQUIRED` 다
 *   - 공개 범위 전환은 관리자 이상이다. 뷰어와 편집자 모두 `403 ADMIN_REQUIRED` 다
 *   - 편집자가 `oauth/begin` 의 `new` 모드로 조직 공개 범위를 고르면 `403 ADMIN_REQUIRED` 이고 설치 대기 행이 생기지 않는다
 *   - 뷰어가 조직 통합을 지우면 `403 ADMIN_REQUIRED` 이고 행은 남는다. 자기 개인 통합은 지운다
 *   - 재인증을 시작한 뒤 뷰어로 강등된 요청자의 콜백은 커밋 직전 재판정에서 롤백된다
 *
 * 액터: Owner · Editor · Viewer · Demoted(편집자로 개인 통합을 만들고 재인증을 시작한 뒤 뷰어로 강등).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

type Actor = { userId: string; accessToken: string };

describe('Integration route role floors (e2e)', () => {
  let db: Client;
  let owner: Actor;
  let editor: Actor;
  let viewer: Actor;
  let demoted: Actor;
  let ws: string;
  let orgId: string; // owner 가 만든 organization
  let editorPersonalId: string;
  let demotedPersonalId: string; // demoted 가 편집자일 때 만든 personal
  let demotedOauthId: string; // demoted 의 Cafe24 Public personal
  let demotedReauthState: string; // demoted 가 편집자일 때 시작한 재인증
  let editorOauthId: string; // editor 의 Cafe24 Public personal — 콜백이 커밋되는 대조군
  let editorReauthState: string;

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
      name: uniqueName(`irf-${scope}`),
      authType: 'bearer_token',
      credentials: { token: `e2e-irf-${scope}` },
      scope,
    });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  };

  /**
   * Cafe24 Public personal 행을 직접 넣는다. 자격 증명은 우리 앱의 CAFE24_CLIENT_ID 를 쓰므로 행에는 토큰과 권한 범위만 있다.
   * credentials 는 `integration-cafe24-install.e2e-spec.ts` 의 같은 헬퍼처럼 평문 JSONB 다.
   */
  const insertCafe24Public = async (createdBy: Actor): Promise<string> => {
    const mallId = 'mall-' + randomBytes(4).toString('hex');
    const credentials = {
      mall_id: mallId,
      app_type: 'public',
      access_token: 'e2e-access-token',
      refresh_token: 'e2e-refresh-token',
      scopes: ['mall.read_product'],
    };
    const r = await db.query<{ id: string }>(
      `INSERT INTO integration
        (workspace_id, service_type, auth_type, name, scope, status,
         mall_id, credentials, created_by)
       VALUES ($1, 'cafe24', 'oauth2', $2, 'personal', 'connected',
         $3, $4::jsonb, $5)
       RETURNING id`,
      [
        ws,
        uniqueName('irf-cafe24'),
        mallId,
        JSON.stringify(credentials),
        createdBy.userId,
      ],
    );
    return r.rows[0].id;
  };

  const startReauthorize = async (actor: Actor, id: string) => {
    const res = await as(actor).post(`/api/integrations/${id}/reauthorize`);
    expect(res.status).toBe(200);
    return (res.body.data as { state: string }).state;
  };

  const setRole = async (actor: Actor, role: 'viewer' | 'editor') => {
    const member = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [ws, actor.userId],
    );
    const res = await request(BASE_URL)
      .patch(`/api/workspaces/${ws}/members/${member.rows[0].id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role });
    expect(res.status).toBe(200);
  };

  const countPending = async (): Promise<number> => {
    const r = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM integration WHERE workspace_id = $1 AND status = 'pending_install'`,
      [ws],
    );
    return Number(r.rows[0].n);
  };

  const callback = (state: string) =>
    request(BASE_URL)
      .get('/api/3rd-party/cafe24/callback')
      .query({ code: 'e2e-code', state });

  /** 콜백이 남긴 결과. `last_error` 는 암호화 컬럼이라 통합 소유자의 상세 응답으로 읽는다. */
  const outcomeOf = async (actor: Actor, id: string) => {
    const r = await db.query<{ token_expires_at: Date | null }>(
      'SELECT token_expires_at FROM integration WHERE id = $1',
      [id],
    );
    const detail = await as(actor).get(`/api/integrations/${id}`);
    expect(detail.status).toBe(200);
    return {
      tokenExpiresAt: r.rows[0].token_expires_at,
      lastErrorCode:
        (detail.body.data as { lastError?: { code?: string } | null }).lastError
          ?.code ?? null,
    };
  };

  /** `oauth/begin` 의 `new` 모드 본문. Cafe24 Private · MakeShop 은 설치 대기 행을 만든다. */
  const beginNew = {
    'cafe24-private': (scope: string) => ({
      service: 'cafe24',
      mode: 'new',
      appType: 'private',
      mallId: 'mall-' + randomBytes(4).toString('hex'),
      clientId: 'e2e-irf-client-' + randomBytes(4).toString('hex'),
      clientSecret: 'e2e-irf-secret',
      scopes: ['mall.read_product'],
      integrationName: uniqueName('irf-c24p'),
      scope,
    }),
    makeshop: (scope: string) => ({
      service: 'makeshop',
      mode: 'new',
      clientId: 'e2e-irf-makeshop-' + randomBytes(4).toString('hex'),
      clientSecret: 'e2e-irf-secret',
      scopes: ['mall.read_product'],
      integrationName: uniqueName('irf-mks'),
      scope,
    }),
    google: (scope: string) => ({
      service: 'google',
      mode: 'new',
      scopes: [],
      scope,
    }),
  } as const;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    owner = await registerAndLogin(BASE_URL, uniqueEmail('irf-own'), db);
    ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('IRF'),
    );
    editor = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('irf-edit'),
      'editor',
      db,
    );
    viewer = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('irf-view'),
      'viewer',
      db,
    );
    demoted = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('irf-dem'),
      'editor',
      db,
    );

    orgId = await createHttp(owner, 'organization');
    editorPersonalId = await createHttp(editor, 'personal');
    demotedPersonalId = await createHttp(demoted, 'personal');

    // 재인증은 편집자일 때 시작한다. 콜백은 강등 뒤에 보낸다.
    demotedOauthId = await insertCafe24Public(demoted);
    demotedReauthState = await startReauthorize(demoted, demotedOauthId);
    editorOauthId = await insertCafe24Public(editor);
    editorReauthState = await startReauthorize(editor, editorOauthId);

    await setRole(demoted, 'viewer');
  }, 120_000);

  afterAll(async () => {
    await db.end();
  });

  /** 뷰어의 쓰기 — 대상이 자기 개인 통합이어도 라우트 가드가 먼저 거절한다. */
  it.each([
    [
      'POST / (개인 통합 생성)',
      () =>
        as(viewer).post('/api/integrations', {
          serviceType: 'http',
          name: uniqueName('irf-viewer'),
          authType: 'bearer_token',
          credentials: { token: 'e2e-irf-viewer' },
          scope: 'personal',
        }),
    ],
    [
      'PATCH /:id (자기 개인 통합 별칭 수정)',
      () =>
        as(demoted).patch(`/api/integrations/${demotedPersonalId}`, {
          name: uniqueName('irf-rename'),
        }),
    ],
    [
      'POST /:id/rotate (자기 개인 통합 교체)',
      () =>
        as(demoted).post(`/api/integrations/${demotedPersonalId}/rotate`, {
          credentials: { token: 'e2e-irf-rotated' },
        }),
    ],
    [
      'POST /:id/reauthorize (자기 개인 통합 재인증)',
      () => as(demoted).post(`/api/integrations/${demotedOauthId}/reauthorize`),
    ],
    [
      'POST /:id/request-scopes (자기 개인 통합 추가 권한 요청)',
      () =>
        as(demoted).post(`/api/integrations/${demotedOauthId}/request-scopes`, {
          scopes: ['mall.read_order'],
        }),
    ],
    [
      'POST /preview-test (저장 전 연결 테스트)',
      () =>
        as(viewer).post('/api/integrations/preview-test', {
          serviceType: 'http',
          authType: 'bearer_token',
          credentials: { token: 'e2e-irf-preview' },
        }),
    ],
    [
      'POST /oauth/begin new — Cafe24 Private',
      () =>
        as(viewer).post(
          '/api/integrations/oauth/begin',
          beginNew['cafe24-private']('personal'),
        ),
    ],
    [
      'POST /oauth/begin new — MakeShop',
      () =>
        as(viewer).post(
          '/api/integrations/oauth/begin',
          beginNew.makeshop('personal'),
        ),
    ],
    [
      'POST /oauth/begin new — Google',
      () =>
        as(viewer).post(
          '/api/integrations/oauth/begin',
          beginNew.google('personal'),
        ),
    ],
  ])('뷰어의 %s — 403 EDITOR_REQUIRED', async (_label, send) => {
    const before = await countPending();
    const res = await send();
    expect(answerOf(res)).toBe('403 EDITOR_REQUIRED');
    expect(await countPending()).toBe(before);
  });

  it.each([
    ['뷰어(자기 개인 통합)', () => demoted, () => demotedPersonalId],
    ['편집자(자기 개인 통합)', () => editor, () => editorPersonalId],
    ['편집자(조직 통합)', () => editor, () => orgId],
  ])(
    '공개 범위 전환 — %s 는 403 ADMIN_REQUIRED',
    async (_label, actorOf, idOf) => {
      const res = await as(actorOf()).patch(
        `/api/integrations/${idOf()}/scope`,
        { scope: 'organization' },
      );
      expect(answerOf(res)).toBe('403 ADMIN_REQUIRED');
    },
  );

  it.each(['cafe24-private', 'makeshop', 'google'] as const)(
    'oauth/begin new — 편집자가 %s 를 조직 공개 범위로 시작하면 403 ADMIN_REQUIRED 이고 설치 대기 행이 생기지 않는다',
    async (service) => {
      const before = await countPending();
      const res = await as(editor).post(
        '/api/integrations/oauth/begin',
        beginNew[service]('organization'),
      );
      expect(answerOf(res)).toBe('403 ADMIN_REQUIRED');
      expect(await countPending()).toBe(before);
    },
  );

  it.each(['cafe24-private', 'makeshop'] as const)(
    'oauth/begin new — 편집자가 %s 를 개인 공개 범위로 시작하면 설치 대기 행이 생긴다 (위 거절의 대조군)',
    async (service) => {
      const before = await countPending();
      const res = await as(editor).post(
        '/api/integrations/oauth/begin',
        beginNew[service]('personal'),
      );
      expect(res.status).toBe(200);
      expect(await countPending()).toBe(before + 1);
    },
  );

  it('콜백 재판정 — 재인증을 시작한 뒤 뷰어로 강등된 요청자의 콜백은 롤백되고 실패가 행에 남는다', async () => {
    const res = await callback(demotedReauthState);
    expect(res.status).toBe(200);
    const outcome = await outcomeOf(demoted, demotedOauthId);
    // 커밋됐다면 교환 결과의 만료 시각이 들어간다(아래 대조군).
    expect(outcome.tokenExpiresAt).toBeNull();
    expect(outcome.lastErrorCode).toBe('EDITOR_REQUIRED');
  });

  it('콜백 재판정 — 편집자의 콜백은 커밋된다 (위 롤백의 대조군)', async () => {
    const res = await callback(editorReauthState);
    expect(res.status).toBe(200);
    const outcome = await outcomeOf(editor, editorOauthId);
    expect(outcome.tokenExpiresAt).not.toBeNull();
    expect(outcome.lastErrorCode).toBeNull();
  });

  it('삭제 — 뷰어가 조직 통합을 지우면 403 ADMIN_REQUIRED 이고 행은 남는다', async () => {
    const del = await as(viewer).delete(`/api/integrations/${orgId}`);
    expect(answerOf(del)).toBe('403 ADMIN_REQUIRED');
    const read = await as(owner).get(`/api/integrations/${orgId}`);
    expect(read.status).toBe(200);
  });

  it('삭제 — 뷰어는 자기 개인 통합을 지운다', async () => {
    const del = await as(demoted).delete(
      `/api/integrations/${demotedPersonalId}`,
    );
    expect(del.status).toBe(204);
    const read = await as(demoted).get(
      `/api/integrations/${demotedPersonalId}`,
    );
    expect(answerOf(read)).toBe('404 RESOURCE_NOT_FOUND');
  });
});
