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
 * 훅은 본문 `userIds` 로 이 스펙이 만든 사용자만 대상으로 돌고, 응답 `digests` 에 보낸 요약을 싣는다
 * (메일은 console 전송기라 내용을 읽을 길이 없다). 그래서 공유 DB 의 다른 사용자 수와 무관하게
 * `recipients` · `sent` 를 정확한 값으로 단언한다.
 *
 * 검증:
 *   1) `dailyDigestEmail` 은 설정 API 로 켜고 끈다(기본 꺼짐).
 *   2) 받는 사람은 키를 켠 사용자다. 지난 24시간에 실패 알림 행이 있는 사람에게만 보낸다.
 *      채널 `email` 행과 닫힌 행도 모은다. 24시간보다 오래된 행과 요약 유형이 아닌 행은 모으지 않는다.
 *   3) 키를 끈 사용자는 받는 사람에서 빠진다.
 *   4) 한 워크스페이스에 11건 이상이면 최신 10건과 전체 건수를 싣는다.
 *   5) 24시간 창 경계 안쪽 행은 넣고 바깥쪽 행은 뺀다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

interface DigestRun {
  recipients: number;
  sent: number;
  failed: number;
  digests: {
    userId: string;
    digest: {
      total: number;
      workspaces: {
        id: string;
        total: number;
        items: { type: string; title: string }[];
      }[];
    };
  }[];
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
  let many: U;
  let edge: U;

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
    opts: {
      channel?: string;
      ageMinutes?: number;
      dismissed?: boolean;
      title?: string;
    } = {},
  ) {
    await db.query(
      `INSERT INTO notification
         (workspace_id, user_id, type, title, message, is_read, channel, created_at, dismissed_at)
       VALUES ($1, $2, $3, $7::text, $7::text, false, $4,
               NOW() - make_interval(mins => $5::int),
               CASE WHEN $6::boolean THEN NOW() ELSE NULL END)`,
      [
        u.workspaceId,
        u.userId,
        type,
        opts.channel ?? 'both',
        opts.ageMinutes ?? 60,
        opts.dismissed ?? false,
        opts.title ?? 'digest-e2e',
      ],
    );
  }

  async function runDigest(caller: U, targets: U[]): Promise<DigestRun> {
    const res = await request(BASE_URL)
      .post('/api/notifications/_test/send-daily-digest')
      .set('Authorization', `Bearer ${caller.accessToken}`)
      .set('X-Workspace-Id', caller.workspaceId)
      .send({ userIds: targets.map((t) => t.userId) });
    expect(res.status).toBe(200);
    return res.body.data as DigestRun;
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    withRow = await register('digest-row');
    staleOnly = await register('digest-stale');
    noRows = await register('digest-none');
    many = await register('digest-many');
    edge = await register('digest-edge');
  });

  afterAll(async () => {
    // 다른 스펙의 요약 실행 결과에 끼지 않도록 키를 지운다.
    await db.query(
      `UPDATE "user"
          SET notification_preferences = notification_preferences - 'dailyDigestEmail'
        WHERE id = ANY($1)`,
      [[withRow, staleOnly, noRows, many, edge].map((u) => u.userId)],
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
    // 채널 email · 닫힌 행도 모은다.
    await insertRow(withRow, 'execution_failed', {
      channel: 'email',
      dismissed: true,
    });
    await insertRow(withRow, 'background_failed');
    // 24시간보다 오래된 행, 요약 유형이 아닌 행은 모으지 않는다.
    await insertRow(staleOnly, 'schedule_failed', { ageMinutes: 25 * 60 });
    await insertRow(staleOnly, 'team_invite');
    for (const u of [withRow, staleOnly, noRows]) await setDigest(u, true);

    const run = await runDigest(withRow, [withRow, staleOnly, noRows]);
    expect(run.recipients).toBe(3);
    expect(run.sent).toBe(1);
    expect(run.failed).toBe(0);
    expect(run.digests.map((d) => d.userId)).toEqual([withRow.userId]);
    expect(run.digests[0].digest.total).toBe(2);
  });

  it('키를 끄면 받는 사람에서 빠진다', async () => {
    await setDigest(withRow, false);
    const run = await runDigest(withRow, [withRow, staleOnly, noRows]);
    expect(run.recipients).toBe(2);
    expect(run.sent).toBe(0);
    expect(run.digests).toEqual([]);
  });

  it('한 워크스페이스에 11건 이상이면 최신 10건과 전체 건수를 싣는다', async () => {
    for (let i = 1; i <= 12; i++) {
      await insertRow(many, 'execution_failed', {
        title: `many-${i}`,
        ageMinutes: i * 10,
      });
    }
    await setDigest(many, true);

    const run = await runDigest(many, [many]);
    expect(run.recipients).toBe(1);
    expect(run.sent).toBe(1);
    const ws = run.digests[0].digest.workspaces;
    expect(ws).toHaveLength(1);
    expect(ws[0].id).toBe(many.workspaceId);
    expect(ws[0].total).toBe(12);
    expect(run.digests[0].digest.total).toBe(12);
    // 최신(나이가 적은) 10건만, 최신 순으로 온다.
    expect(ws[0].items.map((x) => x.title)).toEqual(
      Array.from({ length: 10 }, (_, k) => `many-${k + 1}`),
    );
  });

  it('24시간 창 안쪽 행은 넣고 바깥쪽 행은 뺀다', async () => {
    await insertRow(edge, 'schedule_failed', {
      title: 'edge-in',
      ageMinutes: 24 * 60 - 5,
    });
    await insertRow(edge, 'schedule_failed', {
      title: 'edge-out',
      ageMinutes: 24 * 60 + 5,
    });
    await setDigest(edge, true);

    const run = await runDigest(edge, [edge]);
    expect(run.sent).toBe(1);
    const ws = run.digests[0].digest.workspaces[0];
    expect(ws.total).toBe(1);
    expect(ws.items.map((x) => x.title)).toEqual(['edge-in']);
  });
});
