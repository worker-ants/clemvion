import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin } from './helpers/auth';

/**
 * e2e: 유형별 인앱 토글과 채널 `email` 행의 벨 제외 (CLE-T-EJFQ1Y).
 *
 * 근거: CLE-OBS-NOTIFY-SETTINGS 「설정 키」 · 「인앱 끄기」.
 *
 * 검증:
 *   1) 설정 조회는 인앱 키 셋을 기본 켬으로 채워 돌려준다.
 *   2) 수정은 보낸 키만 합치고 null 은 400 이다.
 *   3) 채널 `email` 행은 벨 목록 · 미읽음 수 · 모두 읽음 · 모두 닫기에서 빠진다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Notifications — 인앱 토글 · email 행 벨 제외 e2e', () => {
  let db: Client;
  let user: { userId: string; email: string; accessToken: string };
  let auth: { Authorization: string };
  let workspaceId: string;
  let emailRowId: string;
  let bellRowId: string;

  async function insertRow(channel: string, title: string): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO notification (workspace_id, user_id, type, title, message, is_read, channel)
       VALUES ($1, $2, 'execution_failed', $3, $3, false, $4)
       RETURNING id`,
      [workspaceId, user.userId, title, channel],
    );
    return r.rows[0].id;
  }

  async function rowState(
    id: string,
  ): Promise<{ is_read: boolean; dismissed: boolean }> {
    const r = await db.query<{ is_read: boolean; dismissed: boolean }>(
      `SELECT is_read, dismissed_at IS NOT NULL AS dismissed
         FROM notification WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    user = await registerAndLogin(BASE_URL, uniqueEmail('nset'), db);
    auth = { Authorization: `Bearer ${user.accessToken}` };
    const ws = await db.query<{ id: string }>(
      `SELECT w.id FROM workspace w
         JOIN workspace_member m ON m.workspace_id = w.id
        WHERE m.user_id = $1 AND w.type = 'personal'`,
      [user.userId],
    );
    workspaceId = ws.rows[0].id;
    emailRowId = await insertRow('email', 'email-only');
    bellRowId = await insertRow('both', 'bell');
  });

  afterAll(async () => {
    await db.end();
  });

  it('설정 조회는 인앱 키를 기본 켬으로 채운다', async () => {
    const res = await request(BASE_URL)
      .get('/api/notifications/settings')
      .set(auth)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      integrationExpiryEmail: false,
      executionFailedEmail: true,
      scheduleFailedEmail: true,
      executionFailedInApp: true,
      scheduleFailedInApp: true,
      integrationExpiryInApp: true,
      dailyDigestEmail: false,
    });
  });

  it('수정은 보낸 인앱 키만 저장하고 null 은 400 이다', async () => {
    const res = await request(BASE_URL)
      .patch('/api/notifications/settings')
      .set(auth)
      .set('X-Workspace-Id', workspaceId)
      .send({ executionFailedInApp: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      executionFailedInApp: false,
      scheduleFailedInApp: true,
      executionFailedEmail: true,
    });

    const stored = await db.query<{ p: Record<string, unknown> }>(
      `SELECT notification_preferences AS p FROM "user" WHERE id = $1`,
      [user.userId],
    );
    expect(stored.rows[0].p).toEqual({ executionFailedInApp: false });

    const bad = await request(BASE_URL)
      .patch('/api/notifications/settings')
      .set(auth)
      .set('X-Workspace-Id', workspaceId)
      .send({ scheduleFailedInApp: null });
    expect(bad.status).toBe(400);
  });

  it('채널 email 행은 벨 목록과 미읽음 수에 없다', async () => {
    const list = await request(BASE_URL)
      .get('/api/notifications?limit=50')
      .set(auth)
      .set('X-Workspace-Id', workspaceId);
    expect(list.status).toBe(200);
    const rows = (list.body.data?.data ?? list.body.data ?? []) as Array<{
      id: string;
    }>;
    const ids = rows.map((n) => n.id);
    expect(ids).toContain(bellRowId);
    expect(ids).not.toContain(emailRowId);

    const count = await request(BASE_URL)
      .get('/api/notifications/unread-count')
      .set(auth)
      .set('X-Workspace-Id', workspaceId);
    expect(count.body.data.count).toBe(1);
  });

  it('모두 읽음 · 모두 닫기는 email 행을 건드리지 않는다', async () => {
    const read = await request(BASE_URL)
      .post('/api/notifications/mark-all-read')
      .set(auth)
      .set('X-Workspace-Id', workspaceId);
    expect(read.body.data.affected).toBe(1);
    const dismiss = await request(BASE_URL)
      .post('/api/notifications/dismiss-all')
      .set(auth)
      .set('X-Workspace-Id', workspaceId);
    expect(dismiss.body.data.affected).toBe(1);

    expect(await rowState(emailRowId)).toEqual({
      is_read: false,
      dismissed: false,
    });
    expect(await rowState(bellRowId)).toEqual({
      is_read: true,
      dismissed: true,
    });
  });
});
