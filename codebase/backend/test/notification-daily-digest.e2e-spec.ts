import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin } from './helpers/auth';

/**
 * e2e: 일일 요약 메일 (CLE-T-BAXAN4).
 *
 * 근거: CLE-OBS-NOTIFY-SETTINGS 「일일 요약」.
 *
 * 요약은 매일 09:00 반복 작업으로만 돌아서 test 전용 훅(`POST /api/notifications/_test/send-daily-digest`,
 * NODE_ENV=test 와 E2E_TEST_HOOKS=1 일 때만 동작)으로 지금 시각에 한 번 돌린다.
 *
 * 검증:
 *   1) `dailyDigestEmail` 은 설정 API 로 켜고 끈다(기본 꺼짐).
 *   2) 받는 사람은 키를 켠 사용자다. 지난 24시간에 실패 알림 행이 있는 사람에게만 보낸다.
 *      채널 `email` 행과 닫힌 행도 모은다. 24시간보다 오래된 행과 요약 유형이 아닌 행은 모으지 않는다.
 *   3) 키를 끈 사용자는 받는 사람에서 빠진다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

interface DigestRun {
  recipients: number;
  sent: number;
  failed: number;
}

describe('Notifications — 일일 요약 e2e', () => {
  let db: Client;
  type U = {
    userId: string;
    accessToken: string;
    workspaceId: string;
  };
  let withRow: U;
  let staleOnly: U;
  let noRows: U;

  async function register(prefix: string): Promise<U> {
    const u = await registerAndLogin(BASE_URL, uniqueEmail(prefix), db);
    const ws = await db.query<{ id: string }>(
      `SELECT w.id FROM workspace w
         JOIN workspace_member m ON m.workspace_id = w.id
        WHERE m.user_id = $1 AND w.type = 'personal'`,
      [u.userId],
    );
    return {
      userId: u.userId,
      accessToken: u.accessToken,
      workspaceId: ws.rows[0].id,
    };
  }

  async function setDigest(u: U, on: boolean) {
    const res = await request(BASE_URL)
      .patch('/api/notifications/settings')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .set('X-Workspace-Id', u.workspaceId)
      .send({ dailyDigestEmail: on });
    expect(res.status).toBe(200);
    expect(res.body.data.dailyDigestEmail).toBe(on);
  }

  async function insertRow(
    u: U,
    type: string,
    opts: { channel?: string; ageHours?: number; dismissed?: boolean } = {},
  ) {
    await db.query(
      `INSERT INTO notification
         (workspace_id, user_id, type, title, message, is_read, channel, created_at, dismissed_at)
       VALUES ($1, $2, $3, 'digest-e2e', 'digest-e2e', false, $4,
               NOW() - make_interval(hours => $5::int),
               CASE WHEN $6::boolean THEN NOW() ELSE NULL END)`,
      [
        u.workspaceId,
        u.userId,
        type,
        opts.channel ?? 'both',
        opts.ageHours ?? 1,
        opts.dismissed ?? false,
      ],
    );
  }

  async function runDigest(u: U): Promise<DigestRun> {
    const res = await request(BASE_URL)
      .post('/api/notifications/_test/send-daily-digest')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .set('X-Workspace-Id', u.workspaceId);
    expect(res.status).toBe(200);
    return res.body.data as DigestRun;
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    withRow = await register('digest-row');
    staleOnly = await register('digest-stale');
    noRows = await register('digest-none');
  });

  afterAll(async () => {
    // 다른 스펙의 요약 실행 결과에 끼지 않도록 키를 지운다.
    await db.query(
      `UPDATE "user"
          SET notification_preferences = notification_preferences - 'dailyDigestEmail'
        WHERE id = ANY($1)`,
      [[withRow.userId, staleOnly.userId, noRows.userId]],
    );
    await db.end();
  });

  it('설정 조회는 dailyDigestEmail 을 기본 꺼짐으로 돌려준다', async () => {
    const res = await request(BASE_URL)
      .get('/api/notifications/settings')
      .set('Authorization', `Bearer ${withRow.accessToken}`)
      .set('X-Workspace-Id', withRow.workspaceId);
    expect(res.status).toBe(200);
    expect(res.body.data.dailyDigestEmail).toBe(false);
  });

  it('키를 켠 사용자 중 지난 24시간 실패 알림이 있는 사람에게만 보낸다', async () => {
    const before = await runDigest(withRow);

    // 채널 email · 닫힌 행도 모은다.
    await insertRow(withRow, 'execution_failed', {
      channel: 'email',
      dismissed: true,
    });
    await insertRow(withRow, 'background_failed');
    // 24시간보다 오래된 행, 요약 유형이 아닌 행은 모으지 않는다.
    await insertRow(staleOnly, 'schedule_failed', { ageHours: 25 });
    await insertRow(staleOnly, 'team_invite');
    for (const u of [withRow, staleOnly, noRows]) await setDigest(u, true);

    const after = await runDigest(withRow);
    expect(after.recipients - before.recipients).toBe(3);
    expect(after.sent - before.sent).toBe(1);
    expect(after.failed - before.failed).toBe(0);
  });

  it('키를 끄면 받는 사람에서 빠진다', async () => {
    const before = await runDigest(withRow);
    await setDigest(withRow, false);
    const after = await runDigest(withRow);
    expect(before.recipients - after.recipients).toBe(1);
    expect(before.sent - after.sent).toBe(1);
  });
});
