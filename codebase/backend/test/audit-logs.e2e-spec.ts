import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { Queue } from 'bullmq';

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
import { expectNoUserSecrets } from '../src/shared/testing/user-secret-absence';
import {
  AUDIT_LOG_PRUNE_JOB,
  AUDIT_LOG_PRUNER_QUEUE,
} from '../src/modules/audit-logs/jobs/audit-log-pruner.service';

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

    // 응답 1건 vs `AuditLogDto` 선언 전수 대조 (API 규약 §5.5).
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

    // 세 번째 축 — **이름으로** 훑는 그물. 위 두 단언은 `rows[0]` 한 건만 보는데, 이것은
    // 봉투 전체를 깊이 훑어 다른 행·다른 가지로 새는 형태까지 문다.
    expectNoUserSecrets(res.body);
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

/**
 * e2e: [감사 로그 「감사 로그 보존 배치」](CLE-OBS-AUDIT#감사-로그-보존-배치) REQ-AUDIT-019.
 * 매일 03:30 스케줄을 기다리지 않고 정리 잡을 큐에 직접 넣는다. e2e backend 는
 * `AUDIT_LOG_RETENTION_DAYS` 를 두지 않으므로 기본 365일로 돈다.
 */
describe('Audit logs 보존 배치 (e2e)', () => {
  const PRUNE_WAIT_MS = 20_000;
  const PRUNE_POLL_MS = 250;
  let db: Client;
  let workspaceId: string;
  let userId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('aud-prune'),
      db,
    );
    userId = owner.userId;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('AUDP'),
    );
  }, 60_000);

  afterAll(async () => {
    await db?.end();
  });

  async function seed(ageDays: number): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO audit_log (id, workspace_id, user_id, action, resource_type, resource_id, details, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'integration.created', 'integration', gen_random_uuid(), '{}',
               NOW() - make_interval(days => $3))
       RETURNING id`,
      [workspaceId, userId, ageDays],
    );
    return r.rows[0].id;
  }

  it('365일이 지난 행만 지우고 그 안의 행은 남긴다', async () => {
    const expired = await seed(400);
    const keptOld = await seed(364);
    const keptNew = await seed(0);

    const queue = new Queue(AUDIT_LOG_PRUNER_QUEUE, {
      connection: {
        host: process.env.REDIS_HOST ?? 'redis',
        port: Number(process.env.REDIS_PORT ?? '6379'),
        ...(process.env.REDIS_PASSWORD
          ? { password: process.env.REDIS_PASSWORD }
          : {}),
      },
    });
    try {
      // 끝난 잡을 Redis 에 남기지 않는다(같은 큐를 쓰는 다른 테스트와 섞이지 않게).
      await queue.add(
        AUDIT_LOG_PRUNE_JOB,
        {},
        { removeOnComplete: true, removeOnFail: true },
      );
      // 판정 기준은 만료 행이 지워졌다는 사실이다(잡이 돌았다는 확실한 흔적).
      const deadline = Date.now() + PRUNE_WAIT_MS;
      let expiredLeft = 1;
      while (Date.now() < deadline) {
        const r = await db.query('SELECT 1 FROM audit_log WHERE id = $1', [
          expired,
        ]);
        expiredLeft = r.rows.length;
        if (expiredLeft === 0) break;
        await new Promise((resolve) => setTimeout(resolve, PRUNE_POLL_MS));
      }
      expect(expiredLeft).toBe(0);
    } finally {
      await queue.close();
    }

    const kept = await db.query<{ id: string }>(
      'SELECT id FROM audit_log WHERE id = ANY($1::uuid[])',
      [[keptOld, keptNew]],
    );
    expect(kept.rows.map((r) => r.id).sort()).toEqual(
      [keptOld, keptNew].sort(),
    );
  }, 60_000);
});
