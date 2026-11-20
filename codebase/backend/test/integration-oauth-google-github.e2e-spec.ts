import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Google · GitHub 팝업 연결이 새 통합 저장까지 닿는다 (NERV Task CLE-T-81270P).
 *
 * 근거: [팝업 연결과 콜백](CLE-INT-OAUTH-CALLBACK), [통합 인증 방식](CLE-INT-AUTH) 의 Google · GitHub 필드 표,
 * [통합 상태와 만료 알림](CLE-INT-STATUS) REQ-INTSTAT-018 · 019.
 *
 * 보호 대상 invariants:
 *   - Google 인가 URL 은 계정 조회용 `openid email` 권한 범위와 `access_type=offline` · `prompt=consent` 를 싣는다
 *   - begin → 콜백 → 미리보기 토큰으로 만든 통합이 필수 식별자 검증(`account_email` · `login`)을 지나 201 로 저장된다
 *     (e2e 는 OAUTH_STUB_MODE 라 외부를 부르지 않는다. stub 도 실제 연결과 같은 필드를 채운다)
 *   - Google 통합은 자동 갱신 표시가 false 라 만료가 주의 필요에 드러난다
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Google · GitHub OAuth 연결 → 저장 (e2e)', () => {
  let db: Client;
  let accessToken: string;
  let ws: string;

  const api = () => ({
    post: (url: string, body: object) =>
      request(BASE_URL)
        .post(url)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-Id', ws)
        .send(body),
    get: (url: string) =>
      request(BASE_URL)
        .get(url)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-Id', ws),
  });

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('iogg'), db);
    accessToken = owner.accessToken;
    ws = await createTeamWorkspace(BASE_URL, accessToken, uniqueName('IOGG'));
  });

  afterAll(async () => {
    await db.end();
  });

  /** begin → 콜백을 거쳐 미리보기 토큰을 받는다. 콜백 HTML 의 postMessage 본문에 실린다. */
  async function connect(
    service: 'google' | 'github',
    scopes: string[],
  ): Promise<{ authUrl: URL; previewToken: string }> {
    const begin = await api().post('/api/integrations/oauth/begin', {
      service,
      mode: 'new',
      scopes,
      scope: 'personal',
    });
    expect(begin.status).toBe(200);
    const { authUrl, state } = begin.body.data as {
      authUrl: string;
      state: string;
    };

    const callback = await request(BASE_URL)
      .get(`/api/3rd-party/${service}/callback`)
      .query({ code: 'e2e-code', state });
    expect(callback.status).toBe(200);
    const previewToken = /tmp_[0-9a-f]{32}/.exec(callback.text)?.[0];
    expect(previewToken).toBeDefined();
    return { authUrl: new URL(authUrl), previewToken: previewToken as string };
  }

  it('Google: 인가 URL 이 openid · email 과 offline 접근 · 동의 화면을 요청하고, 연결한 통합이 저장된다', async () => {
    const { authUrl, previewToken } = await connect('google', [
      'https://www.googleapis.com/auth/drive',
    ]);
    expect(authUrl.searchParams.get('scope')?.split(' ')).toEqual([
      'openid',
      'email',
      'https://www.googleapis.com/auth/drive',
    ]);
    expect(authUrl.searchParams.get('access_type')).toBe('offline');
    expect(authUrl.searchParams.get('prompt')).toBe('consent');

    const created = await api().post('/api/integrations', {
      serviceType: 'google',
      authType: 'oauth2',
      name: uniqueName('iogg-google'),
      scope: 'personal',
      previewToken,
    });
    expect(created.status).toBe(201);
    const id = (created.body.data as { id: string }).id;

    const detail = await api().get(`/api/integrations/${id}`);
    expect(detail.status).toBe(200);
    const data = detail.body.data as {
      status: string;
      autoRefresh: boolean;
      credentials: Record<string, unknown>;
    };
    expect(data.status).toBe('connected');
    expect(data.autoRefresh).toBe(false);
    expect(data.credentials.account_email).toEqual(expect.any(String));
  });

  it('GitHub: 연결한 통합이 login 을 채워 저장된다', async () => {
    const { authUrl, previewToken } = await connect('github', ['repo']);
    expect(authUrl.searchParams.has('access_type')).toBe(false);

    const created = await api().post('/api/integrations', {
      serviceType: 'github',
      authType: 'oauth2',
      name: uniqueName('iogg-github'),
      scope: 'personal',
      previewToken,
    });
    expect(created.status).toBe(201);
    const id = (created.body.data as { id: string }).id;

    const detail = await api().get(`/api/integrations/${id}`);
    expect(detail.status).toBe(200);
    const data = detail.body.data as {
      autoRefresh: boolean;
      credentials: Record<string, unknown>;
    };
    expect(data.autoRefresh).toBe(false);
    expect(data.credentials.login).toEqual(expect.any(String));
  });
});
