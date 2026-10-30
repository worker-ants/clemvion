import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import { waitForLockWaiters } from './helpers/concurrency';

/**
 * e2e: 개인 통합 쓰기와 멤버 나가기 · 제거가 겹쳐도 나간 멤버의 개인 통합이 남지 않고 교착(`40P01`)이 없다
 * (CLE-INT-MANAGE REQ-INTMGMT-066 · 067, NERV Task `CLE-T-PS7JQY`).
 *
 * 통합 행을 만들거나 개인으로 바꾸는 쓰기는 워크스페이스(`FOR KEY SHARE`) → 통합 소유자의 멤버십(`FOR SHARE`) 순으로
 * 잠근다(`integration-owner-write-lock.ts`). 나가기 · 제거는 워크스페이스를 잠그지 않고 멤버십 DELETE → 개인 통합 DELETE
 * 순이다. 그래서
 *   - 쓰기가 먼저 멤버십을 잠갔으면 멤버십 DELETE 가 그 커밋을 기다리고, 뒤따르는 통합 DELETE 가 새 행까지 지운다.
 *   - 나가기 · 제거가 먼저 멤버십을 지웠으면 쓰기가 그 커밋을 기다린 뒤 멤버십이 없어 거절된다.
 *   - 워크스페이스 삭제 · 소유자 이양(워크스페이스 → 멤버십 순)과는 워크스페이스 행에서 먼저 줄을 서므로 교착이 없다.
 *
 * 인터리빙은 우연에 맡기지 않는다. 별도 연결(`locker`)이 한 행을 쥐어 첫 요청을 원하는 지점에서 멈추고, 그 대기를
 * 관측한 뒤 둘째 요청을 보낸다. 둘째 요청이 첫 요청(또는 locker)을 기다리는 것까지 관측한 뒤 locker 를 ROLLBACK 해 함께
 * 푼다. 관측은 `waitForLockWaiters` 가 하고 보지 못하면 던진다. 첫 요청을 멈추는 지점은 셋이다.
 *
 *   - 통합 INSERT 직전: locker 가 같은 워크스페이스의 다른 통합 이름을 새 통합 이름으로 바꾼 채 커밋하지 않는다. 이름
 *     UNIQUE 확인이 그 트랜잭션을 기다린다. 이때 생성은 워크스페이스 · 멤버십 잠금을 이미 쥐고 있다. ROLLBACK 하면 이름이
 *     돌아가 INSERT 가 성공한다.
 *   - 나가기 · 제거의 멤버십 DELETE 뒤 통합 DELETE: locker 가 그 멤버의 개인 통합 하나를 `FOR UPDATE` 로 쥔다.
 *   - 워크스페이스 삭제 · 소유자 이양의 워크스페이스 잠금 뒤: locker 가 요청자(owner)의 멤버십 행을 `FOR SHARE` 로 쥔다.
 *     두 경로는 워크스페이스 `FOR UPDATE` 다음에 요청자 멤버십을 `FOR UPDATE` 로 잠근다.
 *
 * 판별력: 쓰기 경로가 멤버십을 잠그지 않으면 (생성, 제거) · (전환, 제거) · (begin 재사용, 제거) 의 선후 어느 한쪽에서
 * 나간 멤버의 개인 통합이 남는다. 멤버십을 워크스페이스보다 먼저 잠그면 (생성, 워크스페이스 삭제 · 소유자 이양) 이
 * 교착하거나 lock_timeout 으로 500 이 된다.
 *
 * 나가기 · 제거의 lock_timeout(`MEMBER_DEPARTURE_LOCK_TIMEOUT_MS`, 5초)과 워크스페이스 삭제의 lock_timeout(5초) 안에
 * locker 를 풀어야 한다. 관측은 50ms 간격이라 보통 1초 안에 끝난다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

type Actor = { userId: string; accessToken: string };
type Member = Actor & { memberId: string };
type Answer = { status: number; code?: string; integrationId?: string };

describe('Integration owner writes vs member departure (e2e)', () => {
  let db: Client;
  /** 잠금을 쥐는 쪽. 요청이 도는 동안 열려 있어야 하므로 검증용 `db` 와 다른 연결이다. */
  let locker: Client;
  let lockerPid: number;
  let owner: Actor;

  const send = (actor: Actor, ws: string, req: request.Test) =>
    req
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .set('X-Workspace-Id', ws)
      .then(
        (res): Answer => ({
          status: res.status,
          code: res.body?.error?.code,
          integrationId: res.body?.data?.integrationId ?? res.body?.data?.id,
        }),
        (): Answer => ({ status: -1 }),
      );

  const answer = (a: Answer): string => `${a.status} ${a.code ?? ''}`.trim();

  const createHttp = (
    actor: Actor,
    ws: string,
    scope: 'personal' | 'organization',
    name = uniqueName(`mdc-${scope}`),
  ) =>
    send(
      actor,
      ws,
      request(BASE_URL)
        .post('/api/integrations')
        .send({
          serviceType: 'http',
          name,
          authType: 'bearer_token',
          credentials: { token: `e2e-mdc-${scope}` },
          scope,
        }),
    );

  const created = async (pending: Promise<Answer>): Promise<string> => {
    const res = await pending;
    expect(answer(res)).toBe('201');
    return res.integrationId as string;
  };

  const removeMember = (ws: string, member: Member) =>
    send(
      owner,
      ws,
      request(BASE_URL).delete(
        `/api/workspaces/${ws}/members/${member.memberId}`,
      ),
    );

  const switchToPersonal = (ws: string, integrationId: string) =>
    send(
      owner,
      ws,
      request(BASE_URL)
        .patch(`/api/integrations/${integrationId}/scope`)
        .send({ scope: 'personal' }),
    );

  const beginCafe24Private = (actor: Actor, ws: string, mallId: string) =>
    send(
      actor,
      ws,
      request(BASE_URL).post('/api/integrations/oauth/begin').send({
        scopes: [],
        mode: 'new',
        service: 'cafe24',
        mallId,
        appType: 'private',
        clientId: 'e2e-cafe24-client',
        clientSecret: 'e2e-cafe24-secret',
      }),
    );

  const newWorkspace = (): Promise<string> =>
    createTeamWorkspace(BASE_URL, owner.accessToken, uniqueName('MDC'));

  const addMember = async (
    ws: string,
    role: 'admin' | 'editor',
  ): Promise<Member> => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('mdc'), db);
    const row = await db.query<{ id: string }>(
      `INSERT INTO workspace_member (workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, now()) RETURNING id`,
      [ws, user.userId, role],
    );
    return { ...user, memberId: row.rows[0].id };
  };

  const ownerMembershipId = async (ws: string): Promise<string> => {
    const row = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [ws, owner.userId],
    );
    return row.rows[0].id;
  };

  const personalCount = async (ws: string, userId: string): Promise<number> => {
    const res = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM integration
        WHERE workspace_id = $1 AND created_by = $2 AND scope = 'personal'`,
      [ws, userId],
    );
    return res.rows[0].n;
  };

  /** 첫 요청이 INSERT 의 이름 UNIQUE 확인에서 기다리게 하는 잠금. 같은 워크스페이스의 다른 통합 이름을 바꿔 둔다. */
  const holdName = (otherIntegrationId: string, name: string) => ({
    sql: 'UPDATE integration SET name = $2 WHERE id = $1',
    params: [otherIntegrationId, name],
  });
  const holdIntegrationRow = (integrationId: string) => ({
    sql: 'SELECT id FROM integration WHERE id = $1 FOR UPDATE',
    params: [integrationId],
  });
  const holdMembershipShare = (membershipId: string) => ({
    sql: 'SELECT id FROM workspace_member WHERE id = $1 FOR SHARE',
    params: [membershipId],
  });

  /**
   * locker 가 `lock` 을 쥔 채 `first` 를 보내 그 대기를 보고, `second` 를 보내 둘째 대기까지 본 뒤 ROLLBACK 으로 푼다.
   * 응답은 보낸 순서다.
   */
  const interleave = async (
    lock: { sql: string; params: unknown[] },
    first: () => Promise<Answer>,
    second: () => Promise<Answer>,
  ): Promise<[Answer, Answer]> => {
    let firstRes: Promise<Answer> | undefined;
    let secondRes: Promise<Answer> | undefined;
    await locker.query('BEGIN');
    try {
      await locker.query(lock.sql, lock.params);
      firstRes = first();
      await waitForLockWaiters(db, lockerPid, 1, 'first request');
      secondRes = second();
      await waitForLockWaiters(db, lockerPid, 2, 'second request');
      await locker.query('ROLLBACK');
      return [await firstRes, await secondRes];
    } finally {
      // 정상 경로에서는 이미 ROLLBACK 했으므로 no-op 이다. 관측이 먼저 실패한 경우에만 실제로 잠금을 푼다.
      await locker.query('ROLLBACK').catch(() => undefined);
      await firstRes?.catch(() => undefined);
      await secondRes?.catch(() => undefined);
    }
  };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();
    const pid = await locker.query<{ pid: number }>(
      'SELECT pg_backend_pid() AS pid',
    );
    lockerPid = pid.rows[0].pid;
    owner = await registerAndLogin(BASE_URL, uniqueEmail('mdc-own'), db);
  }, 60_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  describe('개인 통합 생성 × 멤버 제거', () => {
    it('생성이 먼저 멤버십을 잠그면 제거가 기다렸다가 새 통합까지 지운다', async () => {
      const ws = await newWorkspace();
      const member = await addMember(ws, 'editor');
      const blocker = await created(createHttp(owner, ws, 'organization'));
      const name = uniqueName('mdc-new');

      const [create, remove] = await interleave(
        holdName(blocker, name),
        () => createHttp(member, ws, 'personal', name),
        () => removeMember(ws, member),
      );

      expect([answer(create), answer(remove)]).toEqual(['201', '200']);
      expect(await personalCount(ws, member.userId)).toBe(0);
      const audit = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_log
          WHERE action = 'integration.deleted' AND resource_id = $1
            AND details->>'mode' = 'removed'`,
        [create.integrationId],
      );
      expect(audit.rows[0].n).toBe(1);
    }, 120_000);

    it('제거가 먼저 멤버십을 지우면 생성은 기다렸다가 403 NOT_A_MEMBER 이고 행을 만들지 않는다', async () => {
      const ws = await newWorkspace();
      const member = await addMember(ws, 'editor');
      const existing = await created(createHttp(member, ws, 'personal'));

      const [remove, create] = await interleave(
        holdIntegrationRow(existing),
        () => removeMember(ws, member),
        () => createHttp(member, ws, 'personal'),
      );

      expect([answer(remove), answer(create)]).toEqual([
        '200',
        '403 NOT_A_MEMBER',
      ]);
      expect(await personalCount(ws, member.userId)).toBe(0);
    }, 120_000);
  });

  describe('조직 → 개인 전환 × 만든 사람 제거', () => {
    it('전환이 먼저 멤버십을 잠그면 제거가 기다렸다가 개인이 된 통합을 지운다', async () => {
      const ws = await newWorkspace();
      const member = await addMember(ws, 'admin');
      const org = await created(createHttp(member, ws, 'organization'));

      const [switched, remove] = await interleave(
        holdIntegrationRow(org),
        () => switchToPersonal(ws, org),
        () => removeMember(ws, member),
      );

      // 전환은 커밋 뒤 행을 다시 읽어 응답한다. 그 사이 제거가 행을 지웠으면 404 다. 어느 쪽이든 전환은 커밋됐고
      // 제거가 그 행을 지웠다.
      expect(['200', '404 RESOURCE_NOT_FOUND']).toContain(answer(switched));
      expect(answer(remove)).toBe('200');
      const row = await db.query('SELECT id FROM integration WHERE id = $1', [
        org,
      ]);
      expect(row.rows).toHaveLength(0);
      expect(await personalCount(ws, member.userId)).toBe(0);
    }, 120_000);

    it('제거가 먼저 멤버십을 지우면 전환은 409 INTEGRATION_OWNER_NOT_MEMBER 이고 조직 통합으로 남는다', async () => {
      const ws = await newWorkspace();
      const member = await addMember(ws, 'admin');
      const org = await created(createHttp(member, ws, 'organization'));
      const personal = await created(createHttp(member, ws, 'personal'));

      const [remove, switched] = await interleave(
        holdIntegrationRow(personal),
        () => removeMember(ws, member),
        () => switchToPersonal(ws, org),
      );

      expect([answer(remove), answer(switched)]).toEqual([
        '200',
        '409 INTEGRATION_OWNER_NOT_MEMBER',
      ]);
      const row = await db.query<{ scope: string }>(
        'SELECT scope FROM integration WHERE id = $1',
        [org],
      );
      expect(row.rows[0].scope).toBe('organization');
      expect(await personalCount(ws, member.userId)).toBe(0);
      const audit = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_log
          WHERE action = 'integration.scope_changed' AND resource_id = $1`,
        [org],
      );
      expect(audit.rows[0].n).toBe(0);
    }, 120_000);
  });

  describe('개인 통합 생성 × 워크스페이스 삭제', () => {
    it('생성이 먼저면 삭제가 기다렸다가 함께 지운다', async () => {
      const ws = await newWorkspace();
      const member = await addMember(ws, 'editor');
      const blocker = await created(createHttp(owner, ws, 'organization'));
      const name = uniqueName('mdc-del');

      const [create, del] = await interleave(
        holdName(blocker, name),
        () => createHttp(member, ws, 'personal', name),
        () =>
          send(owner, ws, request(BASE_URL).delete(`/api/workspaces/${ws}`)),
      );

      expect([answer(create), answer(del)]).toEqual(['201', '200']);
      const rows = await db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM integration WHERE workspace_id = $1',
        [ws],
      );
      expect(rows.rows[0].n).toBe(0);
    }, 120_000);

    it('삭제가 먼저 워크스페이스를 잠그면 생성은 기다렸다가 403 NOT_A_MEMBER 다', async () => {
      const ws = await newWorkspace();
      const member = await addMember(ws, 'editor');
      const ownerMember = await ownerMembershipId(ws);

      const [del, create] = await interleave(
        holdMembershipShare(ownerMember),
        () =>
          send(owner, ws, request(BASE_URL).delete(`/api/workspaces/${ws}`)),
        () => createHttp(member, ws, 'personal'),
      );

      expect([answer(del), answer(create)]).toEqual([
        '200',
        '403 NOT_A_MEMBER',
      ]);
      const rows = await db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM integration WHERE workspace_id = $1',
        [ws],
      );
      expect(rows.rows[0].n).toBe(0);
    }, 120_000);
  });

  describe('개인 통합 생성 × 소유자 이양', () => {
    const transferTo = (ws: string, member: Member) =>
      send(
        owner,
        ws,
        request(BASE_URL)
          .post(`/api/workspaces/${ws}/transfer-ownership`)
          .send({ newOwnerMemberId: member.memberId }),
      );

    it('생성이 먼저면 이양이 기다렸다가 둘 다 성공한다', async () => {
      const ws = await newWorkspace();
      const member = await addMember(ws, 'admin');
      const blocker = await created(createHttp(owner, ws, 'organization'));
      const name = uniqueName('mdc-xfer');

      const [create, transfer] = await interleave(
        holdName(blocker, name),
        () => createHttp(member, ws, 'personal', name),
        () => transferTo(ws, member),
      );

      expect([answer(create), answer(transfer)]).toEqual(['201', '200']);
      expect(await personalCount(ws, member.userId)).toBe(1);
    }, 120_000);

    it('이양이 먼저 워크스페이스를 잠그면 생성이 기다렸다가 둘 다 성공한다', async () => {
      const ws = await newWorkspace();
      const member = await addMember(ws, 'admin');
      const ownerMember = await ownerMembershipId(ws);

      const [transfer, create] = await interleave(
        holdMembershipShare(ownerMember),
        () => transferTo(ws, member),
        () => createHttp(member, ws, 'personal'),
      );

      expect([answer(transfer), answer(create)]).toEqual(['200', '201']);
      const role = await db.query<{ role: string }>(
        'SELECT role FROM workspace_member WHERE id = $1',
        [member.memberId],
      );
      expect(role.rows[0].role).toBe('owner');
      expect(await personalCount(ws, member.userId)).toBe(1);
    }, 120_000);
  });

  describe('Cafe24 Private begin 의 설치 대기 행 재사용 × 멤버 제거', () => {
    const freshMall = () => `mall-${randomBytes(4).toString('hex')}`;

    it('begin 이 먼저 멤버십을 잠그면 제거가 기다렸다가 다시 쓴 행을 지운다', async () => {
      const ws = await newWorkspace();
      const member = await addMember(ws, 'editor');
      const mallId = freshMall();
      const first = await beginCafe24Private(member, ws, mallId);
      expect(answer(first)).toBe('200');
      const pending = first.integrationId as string;

      // begin 은 잠금 도우미 다음에 설치 대기 행을 FOR UPDATE 로 잠근다. locker 가 그 행을 쥐면 begin 은 멤버십을 쥔 채
      // 기다린다.
      const [again, remove] = await interleave(
        holdIntegrationRow(pending),
        () => beginCafe24Private(member, ws, mallId),
        () => removeMember(ws, member),
      );

      expect([answer(again), answer(remove)]).toEqual(['200', '200']);
      expect(again.integrationId).toBe(pending);
      expect(await personalCount(ws, member.userId)).toBe(0);
    }, 120_000);

    it('제거가 먼저 멤버십을 지우면 begin 은 403 NOT_A_MEMBER 이고 새 설치 대기 행을 만들지 않는다', async () => {
      const ws = await newWorkspace();
      const member = await addMember(ws, 'editor');
      const mallId = freshMall();
      const first = await beginCafe24Private(member, ws, mallId);
      expect(answer(first)).toBe('200');
      const pending = first.integrationId as string;

      const [remove, again] = await interleave(
        holdIntegrationRow(pending),
        () => removeMember(ws, member),
        () => beginCafe24Private(member, ws, mallId),
      );

      expect([answer(remove), answer(again)]).toEqual([
        '200',
        '403 NOT_A_MEMBER',
      ]);
      expect(await personalCount(ws, member.userId)).toBe(0);
      const rows = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM integration
          WHERE workspace_id = $1 AND service_type = 'cafe24'`,
        [ws],
      );
      expect(rows.rows[0].n).toBe(0);
    }, 120_000);
  });
});
