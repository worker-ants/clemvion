import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
  TEST_PASSWORD,
} from './helpers/auth';

/**
 * e2e: 복호화하지 못한 인증 설정의 응답에 원래 암호문을 싣지 않는다 (NERV Task `CLE-T-3G8XZ3`).
 *
 * 키를 바꿔 복호화하지 못한 `auth_config.config` 는 `{ __unreadable: true, __original_ciphertext }`
 * 로 읽힌다. 원래 암호문은 재저장 때 행을 그대로 다시 쓰려고 붙인 값이라 응답에는 표식만 남아야 한다.
 * 조회 라우트는 뷰어도 부를 수 있어서 뷰어로 확인한다.
 *
 * 복호화 실패는 테스트가 만든다. 버전 바이트만 맞고 IV · 인증 태그 · 본문이 난수인 봉투를 DB 에 직접
 * 넣으면 GCM 인증 태그 검증이 실패해 표식에 원래 값이 붙는다(e2e 환경에는 통합 암호화 키가 있다).
 *
 * 판별력: 고치기 전 코드는 네 응답 모두에 `__original_ciphertext` 를 싣는다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Auth config unreadable response (e2e)', () => {
  let db: Client;
  let ownerToken: string;
  let viewerToken: string;
  let workspaceId: string;
  let id: string;
  const ciphertext =
    'enc:v1:' +
    Buffer.concat([Buffer.from([0x01]), randomBytes(48)]).toString('base64');

  const asOwner = (req: request.Test) =>
    req
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
  const asViewer = (req: request.Test) =>
    req
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-Workspace-Id', workspaceId);

  async function storedConfig(): Promise<unknown> {
    const row = await db.query<{ config: unknown }>(
      'SELECT config FROM auth_config WHERE id = $1',
      [id],
    );
    return row.rows[0].config;
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('acunr'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('ACUNR'),
    );
    const viewer = await inviteAndAccept(
      BASE_URL,
      ownerToken,
      workspaceId,
      uniqueEmail('acunr-viewer'),
      'viewer',
      db,
    );
    viewerToken = viewer.accessToken;

    const create = await asOwner(
      request(BASE_URL).post('/api/auth-configs'),
    ).send({ name: uniqueName('acunr-target'), type: 'api_key', config: {} });
    expect(create.status).toBe(201);
    id = (create.body.data as { id: string }).id;

    await db.query('UPDATE auth_config SET config = $1::jsonb WHERE id = $2', [
      JSON.stringify(ciphertext),
      id,
    ]);
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('목록 · 상세 응답(뷰어)에는 표식만 있고 원래 암호문이 없다', async () => {
    const list = await asViewer(request(BASE_URL).get('/api/auth-configs'));
    expect(list.status).toBe(200);
    const item = (
      list.body.data as Array<{ id: string; config: unknown }>
    ).find((row) => row.id === id);
    expect(item?.config).toEqual({ __unreadable: true });
    expect(JSON.stringify(list.body)).not.toContain(ciphertext);

    const detail = await asViewer(
      request(BASE_URL).get(`/api/auth-configs/${id}`),
    );
    expect(detail.status).toBe(200);
    expect(detail.body.data.config).toEqual({ __unreadable: true });
    expect(JSON.stringify(detail.body)).not.toContain(ciphertext);
  });

  it('편집 응답에는 원래 암호문이 없고 저장된 값은 원래 암호문 그대로다', async () => {
    const patch = await asOwner(
      request(BASE_URL).patch(`/api/auth-configs/${id}`),
    ).send({ name: uniqueName('acunr-renamed') });
    expect(patch.status).toBe(200);
    expect(patch.body.data.config).toEqual({ __unreadable: true });
    expect(JSON.stringify(patch.body)).not.toContain(ciphertext);
    expect(await storedConfig()).toBe(ciphertext);
  });

  it('평문 보기 응답에도 원래 암호문이 없다', async () => {
    const reveal = await asOwner(
      request(BASE_URL).post(`/api/auth-configs/${id}/reveal`),
    ).send({ password: TEST_PASSWORD });
    expect(reveal.status).toBe(200);
    expect(reveal.body.data.config).toEqual({ __unreadable: true });
    expect(JSON.stringify(reveal.body)).not.toContain(ciphertext);
  });
});
