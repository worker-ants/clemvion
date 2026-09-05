import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
  type DtoContract,
} from '../src/shared/testing/response-contract';
import { AuditLogDto } from '../src/modules/audit-logs/dto/responses/audit-log-response.dto';

/**
 * e2e: spec/5-system/1-auth.md §4.2/§5 — GET /api/audit-logs 권한 경계 (감사 보고 V-03).
 *
 * 검증 대상:
 *   - owner(Admin+) 는 조회 200
 *   - viewer/editor 멤버는 403 (Admin 미만)
 *   - 비멤버는 X-Workspace-Id 를 위조해도 403 (멤버십 검증)
 *   - userId 필터가 행위자 기준으로 결과를 좁힘
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Audit logs 권한 경계 (e2e)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;
  let ownerUserId: string;

  let auditLogContract: DtoContract;

  beforeAll(async () => {
    auditLogContract = await contractForDto(AuditLogDto);
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('audit'), db);
    ownerToken = owner.accessToken;
    ownerUserId = owner.userId;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('AUD'),
    );
    // audit_log 행을 만들기 위해 감사 기록 대상 액션 1건 수행 (auth-config 생성→reveal 류 대신
    // integration 액션이 간단하나, 가장 의존성 낮은 경로로 workspace 소유권 기록을 사용하지 않고
    // 직접 INSERT 로 시드한다 — 본 spec 의 관심사는 조회 권한 경계다.
    await db.query(
      `INSERT INTO audit_log (id, workspace_id, user_id, action, resource_type, resource_id, details, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'integration.created', 'integration', gen_random_uuid(), '{}', NOW())`,
      [workspaceId, ownerUserId],
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  function headers(token: string, wsId: string = workspaceId) {
    return {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': wsId,
    } as const;
  }

  it('owner(Admin+) → 200 + 시드 로그 조회', async () => {
    const res = await request(BASE_URL)
      .get('/api/audit-logs')
      .set(headers(ownerToken));
    expect(res.status).toBe(200);
    const rows = res.body.data as Array<{ action: string }>;
    expect(rows.length).toBeGreaterThanOrEqual(1);

    // 응답 1건 vs `AuditLogDto` 선언 전수 대조 (API 규약 §5.4).
    assertMatchesContract(rows[0], auditLogContract);

    // 중첩 `user` 는 `AuditLogUserDto`(id/name/email) 를 광고한다. 이 엔드포인트는
    // 엔티티를 그대로 반환하므로, 조회가 `User` 전 컬럼을 실으면 `passwordHash`·2FA 복구
    // 코드·`passwordResetToken` 이 응답에 그대로 나간다 (실제로 나갔다 — user 키 26개).
    //
    // 위 계약 대조도 이제 중첩으로 내려가 같은 것을 잡는다. 그래도 이 단언을 **따로**
    // 남기는 이유: 이 유출을 놓친 것이 바로 그 검증자였다. 검증자의 정확성에 기대지 않는
    // 독립 캐너리가 하나 있어야 같은 실수가 다시 조용히 지나가지 않는다.
    const user = (rows[0] as { user?: Record<string, unknown> | null }).user;
    expect(user).toBeTruthy();
    expect(Object.keys(user!).sort()).toEqual(['email', 'id', 'name']);
  });

  it('viewer 멤버 → 403', async () => {
    const viewer = await inviteAndAccept(
      BASE_URL,
      ownerToken,
      workspaceId,
      uniqueEmail('aud-v'),
      'viewer',
      db,
    );
    const res = await request(BASE_URL)
      .get('/api/audit-logs')
      .set(headers(viewer.accessToken));
    expect(res.status).toBe(403);
  });

  it('editor 멤버 → 403 (Admin 미만)', async () => {
    const editor = await inviteAndAccept(
      BASE_URL,
      ownerToken,
      workspaceId,
      uniqueEmail('aud-e'),
      'editor',
      db,
    );
    const res = await request(BASE_URL)
      .get('/api/audit-logs')
      .set(headers(editor.accessToken));
    expect(res.status).toBe(403);
  });

  it('비멤버가 X-Workspace-Id 위조 → 403 (V-03 핵심 회귀)', async () => {
    const outsider = await registerAndLogin(BASE_URL, uniqueEmail('aud-x'), db);
    const res = await request(BASE_URL)
      .get('/api/audit-logs')
      .set(headers(outsider.accessToken));
    expect(res.status).toBe(403);
  });

  it('userId 필터 → 행위자 기준 필터링 (타 사용자 ID 로는 0건)', async () => {
    const mine = await request(BASE_URL)
      .get('/api/audit-logs')
      .query({ userId: ownerUserId })
      .set(headers(ownerToken));
    expect(mine.status).toBe(200);
    expect(
      (mine.body.data as Array<{ action: string }>).length,
    ).toBeGreaterThanOrEqual(1);

    const nobody = await request(BASE_URL)
      .get('/api/audit-logs')
      .query({ userId: '00000000-0000-4000-8000-000000000000' })
      .set(headers(ownerToken));
    expect(nobody.status).toBe(200);
    expect((nobody.body.data as unknown[]).length).toBe(0);
  });
});
