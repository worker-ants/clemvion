import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  TEST_PASSWORD,
} from './helpers/auth';

/**
 * e2e: 인증 설정 재생성의 유형별 동작과 `__` 로 시작하는 config 키 거부
 * (spec CLE-TRIG-AUTHCFG REQ-AUTHCFG-029 · 032).
 *
 * - Basic Auth 재생성은 400 `AUTH_CONFIG_REGENERATE_UNSUPPORTED` 다. 전에는 설정을 그대로 다시 저장하고 감사를 남긴 뒤
 *   저장된 비밀번호를 평문으로 돌려줬다(평문 보기의 비밀번호 재확인을 건너뛰는 길). 저장하지 않았다는 증거로 컬럼 값을
 *   비교한다. 다시 저장하면 암호화 IV 가 새로 뽑혀 값이 바뀐다.
 * - 읽을 수 있는 API Key 재생성은 키만 바꾸고 헤더 이름은 그대로 둔다. 응답의 새 키가 실제로 저장됐는지는 평문 보기로
 *   확인한다.
 * - 생성 · 편집의 config 에 `__` 로 시작하는 키가 있으면 400 `VALIDATION_ERROR` 다. 이 이름은 복호화하지 못한 설정의
 *   표식이 쓴다. 전에는 생성에 `{ __unreadable: true, __original_ciphertext: '…' }` 를 보내면 `encryptJson` 이 표식으로
 *   보고 그 문자열을 암호화하지 않은 채 컬럼에 썼다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Auth config regenerate · reserved config keys (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  const asOwner = (req: request.Test) =>
    req
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

  async function storedColumn(id: string): Promise<unknown> {
    const row = await db.query<{ config: unknown }>(
      'SELECT config FROM auth_config WHERE id = $1',
      [id],
    );
    return row.rows[0].config;
  }

  async function auditCount(action: string, id: string): Promise<number> {
    const row = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_log
        WHERE action = $1 AND resource_id = $2`,
      [action, id],
    );
    return row.rows[0].n;
  }

  async function countByName(name: string): Promise<number> {
    const row = await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM auth_config WHERE workspace_id = $1 AND name = $2',
      [workspaceId, name],
    );
    return row.rows[0].n;
  }

  async function create(
    type: string,
    config: Record<string, unknown> = {},
  ): Promise<{ id: string; config: Record<string, unknown> }> {
    const res = await asOwner(request(BASE_URL).post('/api/auth-configs')).send(
      { name: uniqueName('acregen'), type, config },
    );
    expect(res.status).toBe(201);
    return res.body.data as { id: string; config: Record<string, unknown> };
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('acregen'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('ACREGEN'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('basic_auth 재생성 → 400 AUTH_CONFIG_REGENERATE_UNSUPPORTED · 저장 · 감사 없음 · 비밀번호를 싣지 않는다', async () => {
    const password = `pw-${uniqueName('secret')}`;
    const ac = await create('basic_auth', { username: 'u', password });
    const before = await storedColumn(ac.id);

    const res = await asOwner(
      request(BASE_URL).post(`/api/auth-configs/${ac.id}/regenerate`),
    ).send();

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AUTH_CONFIG_REGENERATE_UNSUPPORTED');
    expect(res.body.error.details).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(password);
    expect(await storedColumn(ac.id)).toEqual(before);
    expect(await auditCount('auth_config.regenerate', ac.id)).toBe(0);
  });

  it('api_key 재생성 → 키만 바뀌고 헤더 이름은 그대로 · 새 키가 저장된다', async () => {
    const ac = await create('api_key', { headerName: 'X-Acregen-Key' });
    const oldKey = ac.config.key as string;

    const res = await asOwner(
      request(BASE_URL).post(`/api/auth-configs/${ac.id}/regenerate`),
    ).send();
    expect(res.status).toBe(200);
    const next = res.body.data.config as Record<string, unknown>;
    expect(next.key).toMatch(/^wfk_[0-9a-f]{48}$/);
    expect(next.key).not.toBe(oldKey);
    expect(next.headerName).toBe('X-Acregen-Key');
    expect(await auditCount('auth_config.regenerate', ac.id)).toBe(1);

    const reveal = await asOwner(
      request(BASE_URL).post(`/api/auth-configs/${ac.id}/reveal`),
    ).send({ password: TEST_PASSWORD });
    expect(reveal.status).toBe(200);
    expect(reveal.body.data.config).toEqual(next);
  });

  describe('`__` 로 시작하는 config 키', () => {
    function rejectedFields(res: request.Response): string[] {
      const details: unknown = res.body?.error?.details;
      expect({
        status: res.status,
        code: res.body?.error?.code,
        isArray: Array.isArray(details),
      }).toStrictEqual({
        status: 400,
        code: 'VALIDATION_ERROR',
        isArray: true,
      });
      const items = details as Array<{ field: string; code: string }>;
      for (const d of items) expect(d.code).toBe('INVALID_FIELD');
      return items.map((d) => d.field);
    }

    it('생성: 표식 키를 보내면 400 이고 저장하지 않는다', async () => {
      const name = uniqueName('acregen-reserved');
      const res = await asOwner(
        request(BASE_URL).post('/api/auth-configs'),
      ).send({
        name,
        type: 'api_key',
        config: {
          __unreadable: true,
          __original_ciphertext: 'not-encrypted',
        },
      });
      expect(rejectedFields(res)).toEqual([
        'config.__unreadable',
        'config.__original_ciphertext',
      ]);
      expect(await countByName(name)).toBe(0);
    });

    it('편집: `__` 키를 보내면 400 이고 이름 · 저장값을 바꾸지 않는다', async () => {
      const ac = await create('bearer_token');
      const before = await storedColumn(ac.id);
      const res = await asOwner(
        request(BASE_URL).patch(`/api/auth-configs/${ac.id}`),
      ).send({ name: 'renamed', config: { __unreadable: true } });
      expect(rejectedFields(res)).toEqual(['config.__unreadable']);
      expect(await storedColumn(ac.id)).toEqual(before);
      const get = await asOwner(
        request(BASE_URL).get(`/api/auth-configs/${ac.id}`),
      );
      expect((get.body.data as { name: string }).name).not.toBe('renamed');
    });
  });
});
