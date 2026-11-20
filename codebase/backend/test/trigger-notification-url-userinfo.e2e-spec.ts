// 알림 수신 URL 의 userinfo(`user:password@`)를 실제 서버 · Postgres 위에서 고정한다(NERV Task `CLE-T-RCQGCC`).
//
// Node fetch 는 userinfo 가 든 URL 로 요청을 만들지 않으므로 그런 URL 은 알림이 늘 실패하고 자격 증명이 설정 ·
// 진단 칼럼에 평문으로 남는다. 두 가지를 본다.
// - 등록: 생성 · 수정 본문의 `notification.url` 에 userinfo 가 있으면 400 `INVALID_NOTIFICATION_URL` 이고 행이
//   생기거나 바뀌지 않는다. 거부 메시지에 URL 원문 · 자격 증명이 실리지 않는다.
// - 조회: 이 변경 전에 저장된 행(DB 에 직접 넣는다)의 `config.notification.url` 은 응답에서 userinfo 를 `***` 로
//   가리고, `notificationLastError` 에 실린 userinfo 도 가린다. 저장값은 그대로다.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { NOTIFICATION_URL_CREDENTIALS_REASON } from '../src/modules/triggers/notification-url.util';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const SAFE_URL = 'https://hooks.example.com/userinfo-e2e';
const USERINFO_URL = 'https://alice:s3cr3t@hooks.example.com/userinfo-e2e?x=1';
const EVENTS = ['execution.completed'];

describe('알림 URL 의 userinfo (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  const createdTriggerIds: string[] = [];

  function api() {
    return {
      post: (path: string, body: object = {}) =>
        request(BASE_URL)
          .post(path)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Workspace-Id', workspaceId)
          .send(body),
      patch: (path: string, body: object) =>
        request(BASE_URL)
          .patch(path)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Workspace-Id', workspaceId)
          .send(body),
      get: (path: string) =>
        request(BASE_URL)
          .get(path)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Workspace-Id', workspaceId),
    };
  }

  async function createTrigger(url: string, endpointPath: string) {
    const res = await api().post('/api/triggers', {
      workflowId,
      type: 'webhook',
      name: uniqueName('userinfo'),
      endpointPath,
      notification: { url, events: EVENTS },
    });
    if (res.status === 201) createdTriggerIds.push(res.body.data.id as string);
    return res;
  }

  async function storedNotificationUrl(triggerId: string): Promise<unknown> {
    const res = await db.query<{ url: unknown }>(
      `SELECT config->'notification'->>'url' AS url FROM trigger WHERE id = $1`,
      [triggerId],
    );
    return res.rows[0]?.url;
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('notify-userinfo'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('NTFUSR'),
    );
    const wf = await api().post('/api/workflows', {
      name: uniqueName('notify-userinfo-wf'),
    });
    workflowId = wf.body.data.id as string;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
  });

  it.each([
    ['사용자명과 비밀번호', USERINFO_URL],
    ['사용자명만', 'https://tok@hooks.example.com/userinfo-e2e'],
    ['빈 사용자명과 비밀번호', 'https://:pw@hooks.example.com/userinfo-e2e'],
  ])(
    '생성: %s 가 든 URL 은 400 이고 행이 생기지 않는다',
    async (_label, url) => {
      const endpointPath = crypto.randomUUID();
      const res = await createTrigger(url, endpointPath);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_NOTIFICATION_URL');
      expect(res.body.error.message).toBe(NOTIFICATION_URL_CREDENTIALS_REASON);
      expect(JSON.stringify(res.body)).not.toContain('s3cr3t');
      const rows = await db.query(
        'SELECT 1 FROM trigger WHERE endpoint_path = $1',
        [endpointPath],
      );
      expect(rows.rowCount).toBe(0);
    },
  );

  it('수정: userinfo 가 든 URL 로 바꾸면 400 이고 저장된 URL 은 그대로다', async () => {
    const created = await createTrigger(SAFE_URL, crypto.randomUUID());
    expect(created.status).toBe(201);
    const triggerId = created.body.data.id as string;

    const res = await api().patch(`/api/triggers/${triggerId}`, {
      notification: { url: USERINFO_URL, events: EVENTS },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_NOTIFICATION_URL');
    expect(JSON.stringify(res.body)).not.toContain('s3cr3t');
    expect(await storedNotificationUrl(triggerId)).toBe(SAFE_URL);
  });

  it('조회: 이미 저장된 userinfo URL · 진단 오류는 응답에서 가리고 저장값은 그대로 둔다', async () => {
    const created = await createTrigger(SAFE_URL, crypto.randomUUID());
    expect(created.status).toBe(201);
    const triggerId = created.body.data.id as string;
    // 이 변경 전에 저장된 행을 흉내 낸다. 등록 검증을 거치지 않으므로 DB 에 직접 쓴다.
    await db.query(
      `UPDATE trigger
          SET config = jsonb_set(config, '{notification,url}', to_jsonb($2::text)),
              notification_last_error = $3
        WHERE id = $1`,
      [
        triggerId,
        USERINFO_URL,
        'fetch failed: https://tok-only@hooks.example.com/userinfo-e2e',
      ],
    );

    const res = await api().get(`/api/triggers/${triggerId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.config.notification.url).toBe(
      'https://***@hooks.example.com/userinfo-e2e?x=1',
    );
    expect(res.body.data.notificationLastError).toBe(
      'fetch failed: https://***@hooks.example.com/userinfo-e2e',
    );
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('s3cr3t');
    expect(body).not.toContain('tok-only');
    expect(await storedNotificationUrl(triggerId)).toBe(USERINFO_URL);
  });

  it('조회 응답의 가린 URL 을 그대로 되보내면 400 이고 저장값을 덮지 않는다', async () => {
    const created = await createTrigger(SAFE_URL, crypto.randomUUID());
    expect(created.status).toBe(201);
    const triggerId = created.body.data.id as string;
    await db.query(
      `UPDATE trigger
          SET config = jsonb_set(config, '{notification,url}', to_jsonb($2::text))
        WHERE id = $1`,
      [triggerId, USERINFO_URL],
    );
    const read = await api().get(`/api/triggers/${triggerId}`);
    const maskedUrl = read.body.data.config.notification.url as string;

    const res = await api().patch(`/api/triggers/${triggerId}`, {
      notification: { url: maskedUrl, events: EVENTS },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_NOTIFICATION_URL');
    expect(await storedNotificationUrl(triggerId)).toBe(USERINFO_URL);
  });
});
