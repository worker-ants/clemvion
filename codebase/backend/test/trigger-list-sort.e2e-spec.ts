import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: `GET /api/triggers` 의 `sort` · `order` (REQ-TRIG-025, CLE-T-FKYM4N).
 *
 * 허용 컬럼은 `created_at · updated_at · name · type · is_active · last_triggered_at` 이고 허용 밖 값은
 * `created_at` 으로 폴백한다. `last_triggered_at` 은 방향과 무관하게 null 을 뒤로 보낸다. 같은 값끼리는 `id` 로
 * 순서를 고정한다. 매핑 규칙의 단위 테스트는 `src/modules/triggers/triggers-list-sort.spec.ts` 에 있다.
 *
 * ## 고정 데이터
 *
 * 새 워크스페이스에 트리거 셋을 만든 뒤 시각 · 활성 상태를 DB 에서 직접 정한다. 컬럼마다 순서가 서로 다르게
 * 나오도록 골랐다. 그래서 한 컬럼을 다른 컬럼으로 바꿔 정렬하는 구현은 어느 한 단언에서 걸린다.
 *
 * | 행 | name | type | is_active | created_at | updated_at | last_triggered_at |
 * |---|---|---|---|---|---|---|
 * | A | `…-a` | webhook | true | 01-03 | 02-01 | null |
 * | B | `…-b` | manual | false | 01-01 | 02-03 | 03-02 |
 * | C | `…-c` | webhook | true | 01-02 | 02-02 | 03-01 |
 *
 * `last_triggered_at desc` 는 PostgreSQL 기본(DESC 는 NULLS FIRST)이면 A 가 맨 앞에 온다.
 * 이 단언이 NULLS LAST 를 판별한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

type Row = { id: string };

describe('GET /api/triggers sort · order (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let a: string;
  let b: string;
  let c: string;
  const createdTriggerIds: string[] = [];

  function authed(req: request.Test): request.Test {
    return req
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
  }

  /** 이 파일이 만든 트리거만 남겨 응답 순서대로 돌려준다. */
  async function listIds(query: string): Promise<string[]> {
    const res = await authed(request(BASE_URL).get(`/api/triggers?${query}`));
    expect(res.status).toBe(200);
    return (res.body.data as Row[])
      .map((r) => r.id)
      .filter((id) => createdTriggerIds.includes(id));
  }

  /** PostgreSQL 의 uuid 비교는 소문자 16진 문자열의 사전순과 같다. 같은 값끼리의 id 순서를 계산할 때 쓴다. */
  function byIdAsc(...ids: string[]): string[] {
    return [...ids].sort();
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('trsort'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('TRSORT'),
    );

    const wf = await authed(request(BASE_URL).post('/api/workflows')).send({
      name: uniqueName('trsort-wf'),
    });
    expect(wf.status).toBe(201);
    const workflowId = wf.body.data.id as string;

    const suffix = uniqueName('trsort');
    async function create(body: Record<string, unknown>): Promise<string> {
      const res = await authed(request(BASE_URL).post('/api/triggers')).send({
        workflowId,
        ...body,
      });
      expect(res.status).toBe(201);
      const id = res.body.data.id as string;
      createdTriggerIds.push(id);
      return id;
    }
    a = await create({
      type: 'webhook',
      name: `${suffix}-a`,
      endpointPath: crypto.randomUUID(),
    });
    b = await create({ type: 'manual', name: `${suffix}-b` });
    c = await create({
      type: 'webhook',
      name: `${suffix}-c`,
      endpointPath: crypto.randomUUID(),
    });

    const fixtures: Array<[string, boolean, string, string, string | null]> = [
      [a, true, '2026-01-03T00:00:00Z', '2026-02-01T00:00:00Z', null],
      [
        b,
        false,
        '2026-01-01T00:00:00Z',
        '2026-02-03T00:00:00Z',
        '2026-03-02T00:00:00Z',
      ],
      [
        c,
        true,
        '2026-01-02T00:00:00Z',
        '2026-02-02T00:00:00Z',
        '2026-03-01T00:00:00Z',
      ],
    ];
    // `trigger` 의 BEFORE UPDATE 트리거(`trg_trigger_updated_at`)가 `updated_at` 을 now() 로 덮는다.
    // 복제 모드는 `SET LOCAL` 이라 이 트랜잭션에서만 켜지고 트리거가 돌지 않는다.
    await db.query('BEGIN');
    try {
      await db.query('SET LOCAL session_replication_role = replica');
      for (const [
        id,
        isActive,
        createdAt,
        updatedAt,
        lastTriggeredAt,
      ] of fixtures) {
        await db.query(
          `UPDATE trigger
              SET is_active = $2, created_at = $3, updated_at = $4, last_triggered_at = $5
            WHERE id = $1`,
          [id, isActive, createdAt, updatedAt, lastTriggeredAt],
        );
      }
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  });

  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
  });

  it('sort · order 가 없으면 created_at DESC 다', async () => {
    expect(await listIds('limit=50')).toEqual([a, c, b]);
  });

  it.each([
    ['created_at', () => [b, c, a]],
    ['updated_at', () => [a, c, b]],
    ['name', () => [a, b, c]],
  ])('sort=%s 는 asc · desc 로 정렬한다', async (sort, ascOrder) => {
    expect(await listIds(`sort=${sort}&order=asc&limit=50`)).toEqual(
      ascOrder(),
    );
    expect(await listIds(`sort=${sort}&order=desc&limit=50`)).toEqual(
      [...ascOrder()].reverse(),
    );
  });

  /** 같은 값(webhook 둘 · true 둘)은 정렬 방향과 같은 방향의 id 순서로 고정된다. */
  it.each([
    ['type', 'manual(B) 이 webhook(A · C) 보다 앞'],
    ['is_active', 'false(B) 가 true(A · C) 보다 앞'],
  ])('sort=%s 는 asc 에서 %s 이고 같은 값끼리는 id 순서다', async (sort) => {
    expect(await listIds(`sort=${sort}&order=asc&limit=50`)).toEqual([
      b,
      ...byIdAsc(a, c),
    ]);
    expect(await listIds(`sort=${sort}&order=desc&limit=50`)).toEqual([
      ...byIdAsc(a, c).reverse(),
      b,
    ]);
  });

  it('sort=last_triggered_at 은 asc · desc 모두 null(A) 을 맨 뒤에 둔다', async () => {
    expect(await listIds('sort=last_triggered_at&order=asc&limit=50')).toEqual([
      c,
      b,
      a,
    ]);
    expect(await listIds('sort=last_triggered_at&order=desc&limit=50')).toEqual(
      [b, c, a],
    );
  });

  /**
   * DTO 정규식(`^[a-zA-Z][a-zA-Z0-9_]*$`)을 통과하지만 허용 목록에 없는 값이다. `constructor` 는 평범한 객체 조회가
   * Object 내장 함수를 돌려주는 값이라 따로 넣었다. 폴백은 created_at 이고 방향은 지킨다.
   */
  it.each(['constructor', 'workspace_id', 'config', 'createdAt'])(
    '허용 밖 sort=%s 는 created_at 으로 폴백한다',
    async (sort) => {
      expect(await listIds(`sort=${sort}&order=asc&limit=50`)).toEqual([
        b,
        c,
        a,
      ]);
      expect(await listIds(`sort=${sort}&limit=50`)).toEqual([a, c, b]);
    },
  );

  it.each([
    ['sort 형식 위반', 'sort=name%3Bdrop'],
    ['sort 선두 밑줄', 'sort=__proto__'],
    ['order 허용 밖', 'order=up'],
    ['order 대문자', 'order=ASC'],
  ])('%s(%s) 은 400 이다', async (_label, query) => {
    const res = await authed(request(BASE_URL).get(`/api/triggers?${query}`));
    expect(res.status).toBe(400);
  });

  /** 정렬이 offset 보다 먼저 적용되는지 본다. 정렬 없이 자르면 두 번째 페이지에 B 가 오지 않는다. */
  it('정렬은 페이지를 자르기 전에 적용된다', async () => {
    const res = await authed(
      request(BASE_URL).get('/api/triggers?sort=name&order=asc&limit=1&page=2'),
    );
    expect(res.status).toBe(200);
    expect((res.body.data as Row[]).map((r) => r.id)).toEqual([b]);
  });
});
