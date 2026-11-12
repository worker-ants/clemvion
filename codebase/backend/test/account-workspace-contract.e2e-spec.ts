import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as crypto from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  createInvitation,
  createTeamWorkspace,
  registerAndLogin,
} from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
  pickMatchingContract,
} from '../src/shared/testing/response-contract';
import { AlertRuleDto } from '../src/modules/alerts/dto/responses/alert-rule-response.dto';
import { AuditLogDto } from '../src/modules/audit-logs/dto/responses/audit-log-response.dto';
import {
  AuthConfigDto,
  AuthConfigUsageDto,
} from '../src/modules/auth-configs/dto/responses/auth-config-response.dto';
import { NotificationDto } from '../src/modules/notifications/dto/responses/notification-response.dto';
import {
  CurrentUserProfileDto,
  UserProfileDto,
} from '../src/modules/users/dto/responses/user-response.dto';
import { WorkspaceInvitationDto } from '../src/modules/workspaces/dto/responses/workspace-response.dto';

/**
 * e2e: 계정 · 워크스페이스 응답의 nullable 필드가 응답 DTO 선언과 맞는가(API 규약 §5.5 「부재 표현」).
 *
 * 대상은 알림 규칙 · 감사 로그 · 인증 설정 · 알림 · 내 프로필 · 초대 응답이다. 값이 없을 때 `null` 을 싣는 필드는
 * 선언이 `required` + `nullable` 이어야 한다. 그래서 필드마다 **null 인 응답과 값이 있는 응답**을 둘 다 대조한다.
 * 한쪽만 보면 선언이 그 경우를 덮는지 알 수 없다. 각 경우가 실제로 일어났는지는 값 단언(`toHaveProperty(key, null)`
 * 등)으로 따로 확인한다. 계약 대조만으로는 시드가 빗나가 두 응답이 같은 모양이 돼도 통과한다.
 *
 * 값이 생기는 경로가 API 에 없는 필드(마지막 사용 시각 · 메일 발송 시각 · 이메일 변경 대기 등)는 SQL 로 값을 심는다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('계정 · 워크스페이스 응답의 nullable 계약 (e2e)', () => {
  let db: Client;
  let token: string;
  let userId: string;
  let workspaceId: string;
  let workflowId: string;

  function headers() {
    return {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspaceId,
    } as const;
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('awc'), db);
    token = owner.accessToken;
    userId = owner.userId;
    workspaceId = await createTeamWorkspace(BASE_URL, token, uniqueName('AWC'));
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set(headers())
      .send({ name: uniqueName('awc-wf') });
    expect(wf.status).toBe(201);
    workflowId = (wf.body.data as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  describe('AlertRuleDto', () => {
    it('워크플로우를 고르지 않은 규칙은 workflowId 가 null, 고른 규칙은 UUID 다', async () => {
      const contract = await contractForDto(AlertRuleDto);

      const wide = await request(BASE_URL)
        .post('/api/alerts')
        .set(headers())
        .send({ type: 'failure_rate', threshold: 10, channel: 'in_app' });
      expect(wide.status).toBe(201);
      assertMatchesContract(wide.body.data, contract);
      expect(wide.body.data).toHaveProperty('workflowId', null);
      expect(wide.body.data).toHaveProperty('window', 'PT1H');

      const scoped = await request(BASE_URL)
        .post('/api/alerts')
        .set(headers())
        .send({
          type: 'duration',
          threshold: 5000,
          channel: 'in_app',
          workflowId,
        });
      expect(scoped.status).toBe(201);
      assertMatchesContract(scoped.body.data, contract);
      expect(scoped.body.data).toHaveProperty('workflowId', workflowId);

      // 목록은 DB 를 다시 읽는다. 생성 응답은 저장 직후의 엔티티라 경로가 다르다.
      const listed = await request(BASE_URL).get('/api/alerts').set(headers());
      expect(listed.status).toBe(200);
      const rows = listed.body.data as Array<Record<string, unknown>>;
      const wideId = (wide.body.data as { id: string }).id;
      const scopedId = (scoped.body.data as { id: string }).id;
      expect(
        pickMatchingContract(rows, (r) => r.id === wideId, contract),
      ).toHaveProperty('workflowId', null);
      expect(
        pickMatchingContract(rows, (r) => r.id === scopedId, contract),
      ).toHaveProperty('workflowId', workflowId);

      const patched = await request(BASE_URL)
        .patch(`/api/alerts/${wideId}`)
        .set(headers())
        .send({ enabled: false });
      expect(patched.status).toBe(200);
      assertMatchesContract(patched.body.data, contract);
      expect(patched.body.data).toHaveProperty('workflowId', null);
    });
  });

  describe('AuditLogDto', () => {
    it('ipAddress 는 기록이 없으면 null, 있으면 문자열이고 user 는 늘 객체다', async () => {
      const withIp = crypto.randomUUID();
      const withoutIp = crypto.randomUUID();
      await db.query(
        `INSERT INTO audit_log (workspace_id, user_id, action, resource_type, resource_id, details, ip_address)
         VALUES ($1, $2, 'integration.created', 'integration', $3, '{}', '203.0.113.9'),
                ($1, $2, 'integration.updated', 'integration', $4, '{}', NULL)`,
        [workspaceId, userId, withIp, withoutIp],
      );

      const res = await request(BASE_URL)
        .get('/api/audit-logs')
        .query({ limit: 100 })
        .set(headers());
      expect(res.status).toBe(200);
      const rows = res.body.data as Array<Record<string, unknown>>;
      const contract = await contractForDto(AuditLogDto);
      const seeded = pickMatchingContract(
        rows,
        (r) => r.resourceId === withIp,
        contract,
      );
      const bare = pickMatchingContract(
        rows,
        (r) => r.resourceId === withoutIp,
        contract,
      );
      expect(seeded).toHaveProperty('ipAddress', '203.0.113.9');
      expect(bare).toHaveProperty('ipAddress', null);
      expect(seeded.user).toMatchObject({ id: userId });
      expect(bare.user).toMatchObject({ id: userId });
    });
  });

  describe('AuthConfigDto · AuthConfigUsageDto', () => {
    it('ipWhitelist · lastUsedAt 는 값이 없으면 null, 있으면 값이 실린다', async () => {
      const contract = await contractForDto(AuthConfigDto);
      const usageContract = await contractForDto(AuthConfigUsageDto);

      const open = await request(BASE_URL)
        .post('/api/auth-configs')
        .set(headers())
        .send({ name: uniqueName('awc-ac-open'), type: 'api_key' });
      expect(open.status).toBe(201);
      assertMatchesContract(open.body.data, contract);
      expect(open.body.data).toHaveProperty('ipWhitelist', null);
      expect(open.body.data).toHaveProperty('lastUsedAt', null);
      const openId = (open.body.data as { id: string }).id;

      const fenced = await request(BASE_URL)
        .post('/api/auth-configs')
        .set(headers())
        .send({
          name: uniqueName('awc-ac-fenced'),
          type: 'api_key',
          ipWhitelist: ['10.0.0.0/8'],
        });
      expect(fenced.status).toBe(201);
      assertMatchesContract(fenced.body.data, contract);
      expect(fenced.body.data).toHaveProperty('ipWhitelist', ['10.0.0.0/8']);
      const fencedId = (fenced.body.data as { id: string }).id;

      // 마지막 사용 시각은 webhook 인증이 통과할 때만 바뀐다. 여기서는 SQL 로 심는다.
      const usedAt = new Date('2026-06-01T00:00:00.000Z');
      await db.query(`UPDATE auth_config SET last_used_at = $1 WHERE id = $2`, [
        usedAt,
        fencedId,
      ]);

      const listed = await request(BASE_URL)
        .get('/api/auth-configs')
        .set(headers());
      expect(listed.status).toBe(200);
      const rows = listed.body.data as Array<Record<string, unknown>>;
      expect(
        pickMatchingContract(rows, (r) => r.id === openId, contract),
      ).toHaveProperty('lastUsedAt', null);
      expect(
        pickMatchingContract(rows, (r) => r.id === fencedId, contract),
      ).toHaveProperty('lastUsedAt', usedAt.toISOString());

      const openUsage = await request(BASE_URL)
        .get(`/api/auth-configs/${openId}/usage`)
        .set(headers());
      expect(openUsage.status).toBe(200);
      assertMatchesContract(openUsage.body.data, usageContract);
      expect(openUsage.body.data).toHaveProperty('lastUsedAt', null);

      const fencedUsage = await request(BASE_URL)
        .get(`/api/auth-configs/${fencedId}/usage`)
        .set(headers());
      expect(fencedUsage.status).toBe(200);
      assertMatchesContract(fencedUsage.body.data, usageContract);
      expect(fencedUsage.body.data).toHaveProperty(
        'lastUsedAt',
        usedAt.toISOString(),
      );
    });
  });

  describe('NotificationDto', () => {
    async function seedNotification(
      resource: { type: string; id: string } | null,
    ): Promise<string> {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO notification (workspace_id, user_id, type, title, message, is_read, channel, resource_type, resource_id)
         VALUES ($1, $2, 'execution_failed', $3, 'awc', false, 'in_app', $4, $5)
         RETURNING id`,
        [
          workspaceId,
          userId,
          uniqueName('awc-noti'),
          resource?.type ?? null,
          resource?.id ?? null,
        ],
      );
      return rows[0].id;
    }

    it('리소스 · 메일 발송 · 숨김이 없으면 null, 있으면 값이 실린다', async () => {
      const contract = await contractForDto(NotificationDto);
      const bareId = await seedNotification(null);
      const linkedId = await seedNotification({
        type: 'workflow',
        id: workflowId,
      });
      const sentAt = new Date('2026-06-02T00:00:00.000Z');
      await db.query(
        `UPDATE notification SET email_sent_at = $1 WHERE id = $2`,
        [sentAt, linkedId],
      );

      const listed = await request(BASE_URL)
        .get('/api/notifications')
        .query({ limit: 100 })
        .set(headers());
      expect(listed.status).toBe(200);
      const rows = listed.body.data as Array<Record<string, unknown>>;
      const bare = pickMatchingContract(rows, (r) => r.id === bareId, contract);
      const linked = pickMatchingContract(
        rows,
        (r) => r.id === linkedId,
        contract,
      );
      expect(bare).toMatchObject({
        resourceType: null,
        resourceId: null,
        emailSentAt: null,
        dismissedAt: null,
      });
      expect(linked).toMatchObject({
        resourceType: 'workflow',
        resourceId: workflowId,
        emailSentAt: sentAt.toISOString(),
      });

      // 읽음 처리 응답은 저장한 엔티티를 그대로 돌려준다. 목록과 코드 경로가 다르다.
      // 그래서 DTO 가 내부 컬럼이라고 적은 `backgroundRunId` 가 응답에 함께 실린다. 이 테스트는 nullable 필드만 대조하고,
      // 그 키를 응답에서 빼는 일은 알림 서비스를 맡은 쪽에 넘겼다. 빼고 나면 이 허용을 지운다.
      const readOptions = { allowUndeclared: ['backgroundRunId'] } as const;
      const read = await request(BASE_URL)
        .patch(`/api/notifications/${bareId}/read`)
        .set(headers());
      expect(read.status).toBe(200);
      assertMatchesContract(read.body.data, contract, readOptions);
      expect(read.body.data).toMatchObject({ isRead: true, dismissedAt: null });

      // 숨긴 알림은 목록에서 빠진다. 숨긴 시각이 실린 응답은 읽음 처리로 본다.
      const dismissed = await request(BASE_URL)
        .post(`/api/notifications/${linkedId}/dismiss`)
        .set(headers());
      expect([200, 201]).toContain(dismissed.status);
      const readDismissed = await request(BASE_URL)
        .patch(`/api/notifications/${linkedId}/read`)
        .set(headers());
      expect(readDismissed.status).toBe(200);
      assertMatchesContract(readDismissed.body.data, contract, readOptions);
      expect(readDismissed.body.data).toHaveProperty(
        'dismissedAt',
        expect.any(String),
      );
    });
  });

  describe('UserProfileDto · CurrentUserProfileDto', () => {
    it('avatarUrl · pendingEmail 은 값이 없으면 null 이고 pendingEmail 은 조회 응답에만 있다', async () => {
      const user = await registerAndLogin(BASE_URL, uniqueEmail('awc-me'), db);
      const auth = { Authorization: `Bearer ${user.accessToken}` } as const;
      const currentContract = await contractForDto(CurrentUserProfileDto);
      const profileContract = await contractForDto(UserProfileDto);

      const fresh = await request(BASE_URL).get('/api/users/me').set(auth);
      expect(fresh.status).toBe(200);
      assertMatchesContract(fresh.body.data, currentContract);
      expect(fresh.body.data).toMatchObject({
        avatarUrl: null,
        pendingEmail: null,
      });

      // 수정 응답은 `pendingEmail` 키를 뺀다(CLE-ACCT-PROFILE API 표). 선언에 없는 키가 실리면 대조가 잡는다.
      const patched = await request(BASE_URL)
        .patch('/api/users/me')
        .set(auth)
        .send({ name: 'AWC renamed' });
      expect(patched.status).toBe(200);
      assertMatchesContract(patched.body.data, profileContract);
      expect(patched.body.data).toHaveProperty('avatarUrl', null);
      expect(patched.body.data).not.toHaveProperty('pendingEmail');

      const pending = uniqueEmail('awc-pending');
      await db.query(
        `UPDATE "user" SET avatar_url = $1, pending_email = $2 WHERE id = $3`,
        ['https://example.com/a.png', pending, user.userId],
      );
      const filled = await request(BASE_URL).get('/api/users/me').set(auth);
      expect(filled.status).toBe(200);
      assertMatchesContract(filled.body.data, currentContract);
      expect(filled.body.data).toMatchObject({
        avatarUrl: 'https://example.com/a.png',
        pendingEmail: pending,
      });
    });
  });

  describe('WorkspaceInvitationDto', () => {
    it('초대한 사람이 있으면 invitedBy 가 UUID, 계정이 지워져 비면 null 이다', async () => {
      const keptId = await createInvitation(
        BASE_URL,
        token,
        workspaceId,
        uniqueEmail('awc-inv-kept'),
        'viewer',
      );
      const orphanId = await createInvitation(
        BASE_URL,
        token,
        workspaceId,
        uniqueEmail('awc-inv-orphan'),
        'viewer',
      );
      // 초대자 계정 삭제(`ON DELETE SET NULL`)를 SQL 로 흉내 낸다. 소유자를 지우면 워크스페이스가 함께 사라진다.
      await db.query(
        `UPDATE workspace_invitation SET invited_by = NULL WHERE id = $1`,
        [orphanId],
      );

      const res = await request(BASE_URL)
        .get(`/api/workspaces/${workspaceId}/invitations`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const rows = res.body.data as Array<Record<string, unknown>>;
      const contract = await contractForDto(WorkspaceInvitationDto);
      expect(
        pickMatchingContract(rows, (r) => r.id === keptId, contract),
      ).toHaveProperty('invitedBy', userId);
      expect(
        pickMatchingContract(rows, (r) => r.id === orphanId, contract),
      ).toHaveProperty('invitedBy', null);
    });
  });
});
