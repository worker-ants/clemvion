import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Basic Auth 인증 설정의 빈 사용자 이름 · 비밀번호를 생성 · 편집 PATCH 에서 400 으로 거부한다
 * (spec CLE-TRIG-AUTHCFG REQ-AUTHCFG-027 · 028).
 *
 * 종전엔 빈 값을 그대로 저장했고 그 설정에 묶인 웹훅은 어떤 요청도 401 로 거부했다(REQ-WEBHOOK-053). 저장은 성공하고
 * 호출 때 가서야 실패해 잘못된 자격 증명과 구분되지 않았다.
 *
 * 응답 모양은 `CustomValidationPipe` 의 `VALIDATION_ERROR` 와 같다 — `details: [{ field, message, code: 'INVALID_FIELD' }]`
 * 배열이고, 둘 다 틀리면 두 필드가 다 실린다. 이 파일이 그 wire 모양의 증거다(서비스 단위 테스트는 예외 객체만 본다).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Basic Auth 빈 값 거부 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  const asOwner = (req: request.Test) =>
    req
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

  /** 400 `VALIDATION_ERROR` 인지 보고 `details[].field` 를 돌려준다. */
  function rejectedFields(res: request.Response): string[] {
    const details: unknown = res.body?.error?.details;
    expect({
      status: res.status,
      code: res.body?.error?.code,
      isArray: Array.isArray(details),
    }).toStrictEqual({ status: 400, code: 'VALIDATION_ERROR', isArray: true });
    const items = details as Array<{ field: string; code: string }>;
    for (const d of items) expect(d.code).toBe('INVALID_FIELD');
    return items.map((d) => d.field);
  }

  async function countByName(name: string): Promise<number> {
    const row = await db.query<{ n: string }>(
      'SELECT count(*) AS n FROM auth_config WHERE workspace_id = $1 AND name = $2',
      [workspaceId, name],
    );
    return Number(row.rows[0].n);
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('acbae'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('ACBAE'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it.each<[string, Record<string, unknown> | undefined, string[]]>([
    [
      '둘 다 빈 문자열',
      { username: '', password: '' },
      ['config.username', 'config.password'],
    ],
    ['config 없음', undefined, ['config.username', 'config.password']],
    [
      'password 만 빈 문자열',
      { username: 'u', password: '' },
      ['config.password'],
    ],
  ])('생성: %s → 400 이고 저장하지 않는다', async (_label, config, fields) => {
    const name = uniqueName('acbae-create');
    const res = await asOwner(request(BASE_URL).post('/api/auth-configs')).send(
      { name, type: 'basic_auth', ...(config ? { config } : {}) },
    );
    expect(rejectedFields(res)).toEqual(fields);
    expect(await countByName(name)).toBe(0);
  });

  describe('편집 PATCH', () => {
    let id: string;

    beforeAll(async () => {
      const res = await asOwner(
        request(BASE_URL).post('/api/auth-configs'),
      ).send({
        name: uniqueName('acbae-edit'),
        type: 'basic_auth',
        config: { username: 'u', password: 'p' },
      });
      expect(res.status).toBe(201);
      id = (res.body.data as { id: string }).id;
    });

    async function storedUsername(): Promise<unknown> {
      const res = await asOwner(
        request(BASE_URL).get(`/api/auth-configs/${id}`),
      );
      expect(res.status).toBe(200);
      return (res.body.data as { config: Record<string, unknown> }).config
        .username;
    }

    it('config.username 이 빈 문자열이면 400 이고 이름도 바꾸지 않는다', async () => {
      const res = await asOwner(
        request(BASE_URL).patch(`/api/auth-configs/${id}`),
      ).send({ name: 'renamed', config: { username: '' } });
      expect(rejectedFields(res)).toEqual(['config.username']);
      expect(await storedUsername()).toBe('u');
      const get = await asOwner(
        request(BASE_URL).get(`/api/auth-configs/${id}`),
      );
      expect((get.body.data as { name: string }).name).not.toBe('renamed');
    });

    it('빈 password 는 무시하고 200 이다 (편집은 비밀 값을 바꾸지 않는다)', async () => {
      const res = await asOwner(
        request(BASE_URL).patch(`/api/auth-configs/${id}`),
      ).send({ config: { password: '' } });
      expect(res.status).toBe(200);
    });

    it('올바른 config.username 은 바꾼다', async () => {
      const res = await asOwner(
        request(BASE_URL).patch(`/api/auth-configs/${id}`),
      ).send({ config: { username: 'next' } });
      expect(res.status).toBe(200);
      expect(await storedUsername()).toBe('next');
    });
  });
});
