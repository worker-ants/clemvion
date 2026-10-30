import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 멤버가 나가거나 제거되면 그 사람의 개인 통합을 지운다(CLE-INT-MANAGE REQ-INTMGMT-065 · 067, NERV Task
 * `CLE-T-PS7JQY`).
 *
 * 보호 대상:
 *   - 나가기 · 제거는 그 사람의 개인 통합을 상태(연결됨 · 설치 대기)와 사용처에 관계없이 지운다. 조직 통합과 다른 멤버의
 *     개인 통합은 그대로다.
 *   - 지운 통합마다 `integration.deleted` 감사가 하나씩 남는다. 행위자는 나가기면 본인, 제거면 제거한 사람이고
 *     `details.mode` 가 `left` · `removed` 로 갈린다.
 *   - 다시 초대해도 지운 통합은 돌아오지 않는다.
 *   - 나가기 · 제거가 거절되면(유일한 owner, owner 제거) 통합을 건드리지 않는다.
 *   - 만든 사람이 나간 조직 통합은 개인으로 바꿀 수 없다(409 `INTEGRATION_OWNER_NOT_MEMBER`). 바꾸지 않았으므로
 *     `integration.scope_changed` 감사도 없다.
 *
 * 멤버는 초대 대신 가입 뒤 멤버십 행을 직접 넣는다. 초대 엔드포인트의 분당 한도에 걸리지 않게 하려는 것이고, 이 파일이
 * 보는 것은 멤버십이 생긴 뒤의 흐름이다. 시나리오마다 워크스페이스를 새로 만들어 앞 시나리오의 나가기 · 제거가 뒤에
 * 섞이지 않게 한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

type Actor = { userId: string; accessToken: string };
type Member = Actor & { memberId: string };

describe('Member departure purges personal integrations (e2e)', () => {
  let db: Client;
  let owner: Actor;

  const call = (actor: Actor, ws: string) => ({
    get: (url: string) =>
      request(BASE_URL)
        .get(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws),
    post: (url: string, body: object = {}) =>
      request(BASE_URL)
        .post(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws)
        .send(body),
    patch: (url: string, body: object) =>
      request(BASE_URL)
        .patch(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws)
        .send(body),
    delete: (url: string) =>
      request(BASE_URL)
        .delete(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws),
  });

  const answerOf = (res: request.Response): string =>
    `${res.status} ${res.body?.error?.code ?? ''}`.trim();

  const newWorkspace = async (): Promise<string> =>
    createTeamWorkspace(BASE_URL, owner.accessToken, uniqueName('MLPI'));

  const addMember = async (
    ws: string,
    role: 'admin' | 'editor',
  ): Promise<Member> => {
    const user = await registerAndLogin(BASE_URL, uniqueEmail('mlpi'), db);
    const row = await db.query<{ id: string }>(
      `INSERT INTO workspace_member (workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, now()) RETURNING id`,
      [ws, user.userId, role],
    );
    return { ...user, memberId: row.rows[0].id };
  };

  const createHttp = async (
    actor: Actor,
    ws: string,
    scope: 'personal' | 'organization',
  ): Promise<string> => {
    const res = await call(actor, ws).post('/api/integrations', {
      serviceType: 'http',
      name: uniqueName(`mlpi-${scope}`),
      authType: 'bearer_token',
      credentials: { token: `e2e-mlpi-${scope}` },
      scope,
    });
    expect(answerOf(res)).toBe('201');
    return (res.body.data as { id: string }).id;
  };

  /** Cafe24 Private begin 으로 설치 대기 행을 만든다. 실제 begin 경로가 만든 행이 지워지는지 보려는 것이다. */
  const beginCafe24Pending = async (actor: Actor, ws: string) => {
    const res = await call(actor, ws).post('/api/integrations/oauth/begin', {
      scopes: [],
      mode: 'new',
      service: 'cafe24',
      mallId: `mall-${randomBytes(4).toString('hex')}`,
      appType: 'private',
      clientId: 'e2e-cafe24-client',
      clientSecret: 'e2e-cafe24-secret',
    });
    expect(answerOf(res)).toBe('200');
    return (res.body.data as { integrationId: string }).integrationId;
  };

  /** 워크플로 노드가 그 통합을 쓰게 한다. 일반 삭제라면 409 `INTEGRATION_IN_USE` 로 막힌다. */
  const useInWorkflow = async (
    ws: string,
    userId: string,
    integrationId: string,
  ) => {
    const wf = await db.query<{ id: string }>(
      `INSERT INTO workflow (workspace_id, name, is_active, created_by)
       VALUES ($1, $2, true, $3) RETURNING id`,
      [ws, uniqueName('WF-mlpi'), userId],
    );
    await db.query(
      `INSERT INTO node (workflow_id, type, category, label, config)
       VALUES ($1, 'http-request', 'integration', 'HTTP', $2::jsonb)`,
      [wf.rows[0].id, JSON.stringify({ integrationId })],
    );
  };

  const existingIds = async (ids: string[]): Promise<string[]> => {
    const res = await db.query<{ id: string }>(
      'SELECT id FROM integration WHERE id = ANY($1) ORDER BY id',
      [ids],
    );
    return res.rows.map((r) => r.id);
  };

  const deletionAudits = async (ids: string[]) => {
    const res = await db.query<{
      resource_id: string;
      user_id: string;
      details: Record<string, unknown>;
    }>(
      `SELECT resource_id, user_id, details FROM audit_log
        WHERE action = 'integration.deleted' AND resource_id = ANY($1)
        ORDER BY resource_id`,
      [ids],
    );
    return res.rows;
  };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    owner = await registerAndLogin(BASE_URL, uniqueEmail('mlpi-own'), db);
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('나가기는 그 사람의 개인 통합을 상태와 사용처에 관계없이 지우고, 다시 들어와도 돌아오지 않는다', async () => {
    const ws = await newWorkspace();
    const leaver = await addMember(ws, 'admin');
    const other = await addMember(ws, 'editor');

    const connected = await createHttp(leaver, ws, 'personal');
    const pending = await beginCafe24Pending(leaver, ws);
    const inUse = await createHttp(leaver, ws, 'personal');
    await useInWorkflow(ws, leaver.userId, inUse);
    const leaverOrg = await createHttp(leaver, ws, 'organization');
    const othersPersonal = await createHttp(other, ws, 'personal');
    const ownersOrg = await createHttp(owner, ws, 'organization');

    const pendingRow = await db.query<{ status: string }>(
      'SELECT status FROM integration WHERE id = $1',
      [pending],
    );
    expect(pendingRow.rows[0].status).toBe('pending_install');

    const res = await call(leaver, ws).post(`/api/workspaces/${ws}/leave`);
    expect(answerOf(res)).toBe('200');

    const purged = [connected, pending, inUse].sort();
    expect(await existingIds(purged)).toEqual([]);
    expect(
      await existingIds([leaverOrg, othersPersonal, ownersOrg].sort()),
    ).toEqual([leaverOrg, othersPersonal, ownersOrg].sort());

    const audits = await deletionAudits(purged);
    expect(audits.map((a) => a.resource_id)).toEqual(purged);
    for (const audit of audits) {
      expect(audit.user_id).toBe(leaver.userId);
      expect(audit.details).toMatchObject({
        mode: 'left',
        memberUserId: leaver.userId,
      });
    }

    // 다시 들어와도 지운 통합은 없다. 목록에도 남은 행에도 없다.
    await db.query(
      `INSERT INTO workspace_member (workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, 'admin', now())`,
      [ws, leaver.userId],
    );
    const list = await call(leaver, ws).get('/api/integrations?limit=100');
    expect(list.status).toBe(200);
    const listed = (list.body.data as Array<{ id: string }>).map((i) => i.id);
    for (const id of purged) expect(listed).not.toContain(id);
    expect(listed).toContain(leaverOrg);
    const remaining = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM integration
        WHERE workspace_id = $1 AND created_by = $2 AND scope = 'personal'`,
      [ws, leaver.userId],
    );
    expect(remaining.rows[0].n).toBe(0);
  }, 120_000);

  it('제거는 제거한 사람을 행위자로 그 멤버의 개인 통합을 지운다', async () => {
    const ws = await newWorkspace();
    const target = await addMember(ws, 'editor');
    const personal = await createHttp(target, ws, 'personal');
    const ownersPersonal = await createHttp(owner, ws, 'personal');

    const res = await call(owner, ws).delete(
      `/api/workspaces/${ws}/members/${target.memberId}`,
    );
    expect(answerOf(res)).toBe('200');

    expect(await existingIds([personal])).toEqual([]);
    expect(await existingIds([ownersPersonal])).toEqual([ownersPersonal]);
    const audits = await deletionAudits([personal]);
    expect(audits).toHaveLength(1);
    expect(audits[0].user_id).toBe(owner.userId);
    expect(audits[0].details).toMatchObject({
      mode: 'removed',
      memberUserId: target.userId,
    });
  }, 120_000);

  it('나가기 · 제거가 거절되면 개인 통합을 건드리지 않는다', async () => {
    const ws = await newWorkspace();
    const admin = await addMember(ws, 'admin');
    const ownersPersonal = await createHttp(owner, ws, 'personal');

    const leave = await call(owner, ws).post(`/api/workspaces/${ws}/leave`);
    expect(answerOf(leave)).toBe('403 SOLE_OWNER_CANNOT_LEAVE');

    const ownerMember = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [ws, owner.userId],
    );
    const remove = await call(admin, ws).delete(
      `/api/workspaces/${ws}/members/${ownerMember.rows[0].id}`,
    );
    expect(answerOf(remove)).toBe('403 CANNOT_REMOVE_OWNER');

    expect(await existingIds([ownersPersonal])).toEqual([ownersPersonal]);
    expect(await deletionAudits([ownersPersonal])).toEqual([]);
  }, 120_000);

  it('만든 사람이 나간 조직 통합은 개인으로 바꿀 수 없고 감사도 남기지 않는다', async () => {
    const ws = await newWorkspace();
    const creator = await addMember(ws, 'admin');
    const orphanCandidate = await createHttp(creator, ws, 'organization');
    // 대조군: 만든 사람이 남아 있는 조직 통합은 같은 요청으로 바뀐다.
    const control = await createHttp(owner, ws, 'organization');

    const left = await call(creator, ws).post(`/api/workspaces/${ws}/leave`);
    expect(answerOf(left)).toBe('200');
    // 조직 통합은 나가기가 지우지 않는다.
    expect(await existingIds([orphanCandidate])).toEqual([orphanCandidate]);

    const rejected = await call(owner, ws).patch(
      `/api/integrations/${orphanCandidate}/scope`,
      { scope: 'personal' },
    );
    expect(answerOf(rejected)).toBe('409 INTEGRATION_OWNER_NOT_MEMBER');
    // 응답에 만든 사람의 식별자를 싣지 않는다.
    expect(JSON.stringify(rejected.body)).not.toContain(creator.userId);

    const row = await db.query<{ scope: string }>(
      'SELECT scope FROM integration WHERE id = $1',
      [orphanCandidate],
    );
    expect(row.rows[0].scope).toBe('organization');
    const scopeAudits = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_log
        WHERE action = 'integration.scope_changed' AND resource_id = $1`,
      [orphanCandidate],
    );
    expect(scopeAudits.rows[0].n).toBe(0);

    const switched = await call(owner, ws).patch(
      `/api/integrations/${control}/scope`,
      { scope: 'personal' },
    );
    expect(answerOf(switched)).toBe('200');
  }, 120_000);
});
