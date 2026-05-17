import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Notification dismiss (soft delete) — spec/data-flow/8-notifications.md §4.
 *
 * 검증 영역:
 *   1) V055 (dismissed_at 컬럼) + V056 (partial index) 마이그레이션이 적용되어
 *      `notification` 테이블에 dismissed_at 컬럼이 있다.
 *   2) `POST /notifications/:id/dismiss` 가 visible → dismissed 전이. 멱등 (2회 호출
 *      모두 200, dismissed_at 동일).
 *   3) 본인 아닌 알림 id 는 404.
 *   4) `POST /notifications/dismiss-all` 가 affected count 반환, 이미 dismissed 인
 *      row 는 affected 에서 제외.
 *   5) dismissed 알림이 `GET /notifications` 와 `GET /unread-count` 양쪽에서 제외.
 *   6) `is_read` 와 `dismissed_at` 이 별개 차원으로 동작 (읽음 처리해도 visible 유지,
 *      dismiss 해도 is_read 상태 보존).
 *
 * Pattern: codebase/backend/test/background-monitoring.e2e-spec.ts 와 동일.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  dismissedAt: string | null;
  createdAt: string;
}

async function listNotifications(
  authHeader: { Authorization: string },
  workspaceId: string,
): Promise<NotificationRow[]> {
  const res = await request(BASE_URL)
    .get('/api/notifications?limit=50')
    .set(authHeader)
    .set('X-Workspace-Id', workspaceId);
  if (res.status !== 200) {
    throw new Error(
      `GET /notifications failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return (res.body.data?.data ?? res.body.data ?? []) as NotificationRow[];
}

async function getUnreadCount(
  authHeader: { Authorization: string },
  workspaceId: string,
): Promise<number> {
  const res = await request(BASE_URL)
    .get('/api/notifications/unread-count')
    .set(authHeader)
    .set('X-Workspace-Id', workspaceId);
  if (res.status !== 200) {
    throw new Error(`unread-count failed: ${res.status}`);
  }
  return res.body.data.count as number;
}

async function seedNotification(
  db: Client,
  workspaceId: string,
  userId: string,
  title: string,
): Promise<string> {
  // title (varchar) 와 message (text) 가 서로 다른 type 이므로 별도 param 으로 분리.
  // 같은 param 을 양쪽에 쓰면 PG prepared statement 가 inconsistent type deduction 으로 거절.
  const ins = await db.query<{ id: string }>(
    `INSERT INTO notification (workspace_id, user_id, type, title, message, is_read, channel)
     VALUES ($1, $2, 'execution_failed', $3, $4, false, 'in_app')
     RETURNING id`,
    [workspaceId, userId, title, title],
  );
  return ins.rows[0].id;
}

describe('Notifications dismiss e2e', () => {
  let db: Client;
  let owner: { userId: string; email: string; accessToken: string };
  let other: { userId: string; email: string; accessToken: string };
  let workspaceId: string;
  let ownerAuth: { Authorization: string };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    owner = await registerAndLogin(BASE_URL, uniqueEmail('notif-owner'), db);
    other = await registerAndLogin(BASE_URL, uniqueEmail('notif-other'), db);
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('notif-ws'),
    );
    ownerAuth = { Authorization: `Bearer ${owner.accessToken}` };
  });

  afterAll(async () => {
    await db.end();
  });

  it('schema: notification 테이블에 dismissed_at 컬럼 존재 (V055)', async () => {
    const res = await db.query<{ data_type: string; is_nullable: string }>(
      `SELECT data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name='notification' AND column_name='dismissed_at'`,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].data_type).toBe('timestamp with time zone');
    expect(res.rows[0].is_nullable).toBe('YES');
  });

  it('schema: partial 인덱스 idx_notification_user_read_created_active 가 활성 (V056)', async () => {
    const res = await db.query<{ indexdef: string; indisvalid: boolean }>(
      `SELECT i.indisvalid, pg_get_indexdef(i.indexrelid) AS indexdef
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       WHERE c.relname = 'idx_notification_user_read_created_active'`,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].indisvalid).toBe(true);
    expect(res.rows[0].indexdef).toMatch(/WHERE \(?dismissed_at IS NULL\)?/);
  });

  it('단건 dismiss: visible → dismissed, 멱등 (2회 호출 모두 200, dismissed_at 보존)', async () => {
    const notifId = await seedNotification(
      db,
      workspaceId,
      owner.userId,
      uniqueName('alert-1'),
    );

    const first = await request(BASE_URL)
      .post(`/api/notifications/${notifId}/dismiss`)
      .set(ownerAuth)
      .set('X-Workspace-Id', workspaceId);
    expect(first.status).toBe(200);
    expect(first.body.data.id).toBe(notifId);
    expect(first.body.data.dismissedAt).toBeTruthy();
    const firstAt = first.body.data.dismissedAt as string;

    const second = await request(BASE_URL)
      .post(`/api/notifications/${notifId}/dismiss`)
      .set(ownerAuth)
      .set('X-Workspace-Id', workspaceId);
    expect(second.status).toBe(200);
    // 멱등 — 기존 시각 그대로 반환
    expect(second.body.data.dismissedAt).toBe(firstAt);
  });

  it('단건 dismiss: 본인 아닌 알림 id 는 404', async () => {
    const otherNotifId = await seedNotification(
      db,
      workspaceId,
      other.userId,
      uniqueName('other-alert'),
    );

    const res = await request(BASE_URL)
      .post(`/api/notifications/${otherNotifId}/dismiss`)
      .set(ownerAuth)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('dismissed 알림은 GET /notifications 와 unread-count 양쪽에서 제외', async () => {
    const visibleId = await seedNotification(
      db,
      workspaceId,
      owner.userId,
      uniqueName('visible-1'),
    );
    const toDismissId = await seedNotification(
      db,
      workspaceId,
      owner.userId,
      uniqueName('to-dismiss'),
    );

    // baseline
    const beforeCount = await getUnreadCount(ownerAuth, workspaceId);
    const beforeList = await listNotifications(ownerAuth, workspaceId);
    const beforeIds = beforeList.map((n) => n.id);
    expect(beforeIds).toEqual(expect.arrayContaining([visibleId, toDismissId]));

    // dismiss one
    await request(BASE_URL)
      .post(`/api/notifications/${toDismissId}/dismiss`)
      .set(ownerAuth)
      .set('X-Workspace-Id', workspaceId)
      .expect(200);

    const afterCount = await getUnreadCount(ownerAuth, workspaceId);
    const afterList = await listNotifications(ownerAuth, workspaceId);
    const afterIds = afterList.map((n) => n.id);

    expect(afterIds).toContain(visibleId);
    expect(afterIds).not.toContain(toDismissId);
    expect(afterCount).toBe(beforeCount - 1);
  });

  it('일괄 dismiss-all: visible 알림만 affected, 이미 dismissed 인 row 는 제외', async () => {
    // 새 시나리오 — 별도 user 로 격리
    const userC = await registerAndLogin(
      BASE_URL,
      uniqueEmail('notif-bulk'),
      db,
    );
    const wsC = await createTeamWorkspace(
      BASE_URL,
      userC.accessToken,
      uniqueName('bulk-ws'),
    );
    const authC = { Authorization: `Bearer ${userC.accessToken}` };

    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      ids.push(
        await seedNotification(db, wsC, userC.userId, uniqueName(`bulk-${i}`)),
      );
    }
    // 미리 1개 dismiss
    await request(BASE_URL)
      .post(`/api/notifications/${ids[0]}/dismiss`)
      .set(authC)
      .set('X-Workspace-Id', wsC)
      .expect(200);

    const res = await request(BASE_URL)
      .post('/api/notifications/dismiss-all')
      .set(authC)
      .set('X-Workspace-Id', wsC);
    expect(res.status).toBe(200);
    // 3개 중 1개 이미 dismissed 였으므로 affected=2
    expect(res.body.data.affected).toBe(2);

    const afterList = await listNotifications(authC, wsC);
    expect(afterList).toHaveLength(0);
  });

  it('is_read 와 dismissed_at 는 별개 차원 — 읽음 처리해도 visible 유지', async () => {
    const userD = await registerAndLogin(
      BASE_URL,
      uniqueEmail('notif-dim'),
      db,
    );
    const wsD = await createTeamWorkspace(
      BASE_URL,
      userD.accessToken,
      uniqueName('dim-ws'),
    );
    const authD = { Authorization: `Bearer ${userD.accessToken}` };

    const id = await seedNotification(
      db,
      wsD,
      userD.userId,
      uniqueName('read-not-dismiss'),
    );

    // 읽음 처리
    await request(BASE_URL)
      .patch(`/api/notifications/${id}/read`)
      .set(authD)
      .set('X-Workspace-Id', wsD)
      .expect(200);

    // visible 유지 — 목록에 여전히 있음
    const list = await listNotifications(authD, wsD);
    const row = list.find((n) => n.id === id);
    expect(row).toBeDefined();
    expect(row!.isRead).toBe(true);
    expect(row!.dismissedAt).toBeNull();

    // 미읽음 카운트는 차감
    const unread = await getUnreadCount(authD, wsD);
    expect(unread).toBe(0);
  });
});
