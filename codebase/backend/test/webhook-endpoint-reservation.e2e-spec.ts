import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

import { createDbClient } from './helpers/db';

/**
 * e2e: V133(웹훅 경로 영구 예약)의 SQL 을 **파일 그대로** 실제 PostgreSQL 에서 돌린다.
 *
 * **왜 따로 무는가** — Flyway 는 CI · e2e 의 빈 `trigger` 에 V133 을 적용하므로 백필이 한 행도 옮기지 않는다. 그런데 이
 * 파일은 운영 DB 에 단 한 번 적용되고, 백필이 빠뜨린 경로는 그 뒤로 누구든 가져갈 수 있다. DB 트리거의 거부는 API
 * e2e(`webhook-trigger` B7 · B8)도 보지만, 그쪽은 서비스를 거친다 — 서비스가 아닌 쓰기(수동 SQL · 트리거를 다른
 * 워크스페이스로 옮기기)까지 막는다는 주장은 SQL 로만 확인된다.
 *
 * **어떻게** — V131 가드(`trigger-endpoint-path-dedupe`)와 같다. 한 트랜잭션 안에 임시 스키마를 만들고 `trigger` ·
 * `workspace` 의 사본(컬럼 · 기본값 · CHECK · PK — FK 는 복사하지 않는다)을 둔 뒤, `search_path` 로 V133 의 비한정 이름
 * (새 테이블 · FK 대상 · 함수 · 트리거 대상 · 백필 원본)을 사본에 향하게 해 실행하고 ROLLBACK 한다. 공유 e2e DB 의
 * `public` 은 건드리지 않는다.
 *
 * **이 파일은 V133 의 메커니즘(백필 · DB 트리거)만 본다** — `spec/1-data-model.md` frontmatter `code:` 의 전용 가드라, 서비스 ·
 * API 시나리오(409 응답 형태 · 수신 404)를 여기에 얹으면 그 문서가 무관한 기능 변경의 게이트가 된다. 그쪽은 `webhook-trigger`
 * B7 · B8 · B9 가 맡는다.
 *
 * SoT: `spec/1-data-model.md` §2.8.1 · `## Rationale` «지운 · 바꾼 웹훅 경로의 영구 예약». 근거 · 실측:
 * `plan/complete/spec-draft-webhook-endpoint-reservation.md`.
 */
const V133_SQL = readFileSync(
  join(__dirname, '..', 'migrations', 'V133__webhook_endpoint_reservation.sql'),
  'utf8',
);

const OWNER_LABEL = 'webhook_endpoint_reservation_owner';

const WS = {
  a: 'e0000000-0000-4000-8000-00000000000a',
  b: 'e0000000-0000-4000-8000-00000000000b',
};
const WF = 'f0000000-0000-4000-8000-000000000001';
const USER = 'd0000000-0000-4000-8000-000000000001';

// 경로 — 백필 대상 둘(A · B 가 하나씩), 마이그레이션 뒤에 A 가 새로 쓰는 둘
const P = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const R = '33333333-3333-4333-8333-333333333333';
const S = '44444444-4444-4444-8444-444444444444';

describe('V133 웹훅 경로 영구 예약 (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  let seq = 0;
  async function insertTrigger(
    workspaceId: string,
    path: string | null,
  ): Promise<string> {
    seq += 1;
    const id = `a0000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
    await db.query(
      `INSERT INTO trigger (id, workspace_id, workflow_id, type, name, endpoint_path)
       VALUES ($1, $2, $3, $4, 'probe', $5)`,
      [id, workspaceId, WF, path ? 'webhook' : 'manual', path],
    );
    return id;
  }

  /**
   * 한 문장을 SAVEPOINT 로 감싸 돌리고, 실패했으면 그 오류를 돌려준다 — 트랜잭션은 이어서 쓸 수 있다.
   * 성공하면 `null`.
   */
  async function attempt(
    sql: string,
    params: unknown[],
  ): Promise<{ code?: string; constraint?: string } | null> {
    await db.query('SAVEPOINT probe_attempt');
    try {
      await db.query(sql, params);
      await db.query('RELEASE SAVEPOINT probe_attempt');
      return null;
    } catch (err) {
      await db.query('ROLLBACK TO SAVEPOINT probe_attempt');
      return err as { code?: string; constraint?: string };
    }
  }

  /** 서비스를 거치지 않는 쓰기 — DB 트리거만이 막을 수 있다. */
  function insertAttempt(workspaceId: string, path: string) {
    return attempt(
      `INSERT INTO trigger (id, workspace_id, workflow_id, type, name, endpoint_path)
       VALUES (gen_random_uuid(), $1, $2, 'webhook', 'probe', $3)`,
      [workspaceId, WF, path],
    );
  }

  async function reservations(): Promise<
    Array<{ endpoint_path: string; workspace_id: string | null }>
  > {
    const res = await db.query<{
      endpoint_path: string;
      workspace_id: string | null;
    }>(
      'SELECT endpoint_path, workspace_id FROM webhook_endpoint_reservation ORDER BY endpoint_path',
    );
    return res.rows;
  }

  it('백필은 경로가 있는 트리거만 각자의 워크스페이스로 예약하고, 그 뒤 다른 워크스페이스의 쓰기는 경로마다 거부된다 · 같은 워크스페이스는 다시 쓴다', async () => {
    await db.query('BEGIN');
    try {
      await db.query('CREATE SCHEMA v133_probe');
      await db.query(
        'CREATE TABLE v133_probe.workspace (LIKE public.workspace INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)',
      );
      await db.query(
        'CREATE TABLE v133_probe.trigger (LIKE public.trigger INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
      );
      await db.query('SET LOCAL search_path TO v133_probe, public');
      // `team` — 사본에도 personal 워크스페이스의 소유자당 하나 부분 UNIQUE 가 복사된다
      for (const [key, id] of Object.entries(WS)) {
        await db.query(
          `INSERT INTO workspace (id, name, owner_id, slug, type) VALUES ($1, $2, $3, $4, 'team')`,
          [id, `probe-${key}`, USER, `v133-probe-${key}`],
        );
      }

      // 마이그레이션 전: A 는 P 와 경로 없는 트리거, B 는 Q
      const aP = await insertTrigger(WS.a, P);
      await insertTrigger(WS.a, null);
      await insertTrigger(WS.b, Q);

      await db.query(V133_SQL);

      // 백필 — 경로 없는 트리거는 예약하지 않는다
      expect(await reservations()).toEqual([
        { endpoint_path: P, workspace_id: WS.a },
        { endpoint_path: Q, workspace_id: WS.b },
      ]);

      const rejected = (err: { code?: string; constraint?: string } | null) => {
        // null 이면 쓰기가 통과했다는 뜻이다 — 그 사실을 먼저 말한다
        expect(err).not.toBeNull();
        expect(err).toMatchObject({ code: '23505', constraint: OWNER_LABEL });
      };

      // (1) 살아 있는 경로 — B 가 A 의 P 를
      rejected(await insertAttempt(WS.b, P));

      // (2) 지운 경로 — A 가 P 를 지운 뒤에도 B 는 못 쓴다 · A 는 다시 쓴다
      await db.query('DELETE FROM trigger WHERE id = $1', [aP]);
      rejected(await insertAttempt(WS.b, P));
      expect(await insertAttempt(WS.a, P)).toBeNull();

      // (3) 바꾼 경로 — A 가 R → S 로 바꾼 뒤 B 는 R 을 만들지도, 자기 트리거를 R 로 바꾸지도 못한다 · A 는 되돌린다
      const aR = await insertTrigger(WS.a, R);
      await db.query('UPDATE trigger SET endpoint_path = $1 WHERE id = $2', [
        S,
        aR,
      ]);
      rejected(await insertAttempt(WS.b, R));
      const bOwn = await insertTrigger(WS.b, null);
      rejected(
        await attempt(
          'UPDATE trigger SET type = $1, endpoint_path = $2 WHERE id = $3',
          ['webhook', R, bOwn],
        ),
      );
      expect(
        await attempt('UPDATE trigger SET endpoint_path = $1 WHERE id = $2', [
          R,
          aR,
        ]),
      ).toBeNull();

      // (4) 트리거를 다른 워크스페이스로 옮기기 — 정상 경로엔 없지만 수동 SQL 도 막는다
      rejected(
        await attempt('UPDATE trigger SET workspace_id = $1 WHERE id = $2', [
          WS.b,
          aR,
        ]),
      );

      // 예약 — 백필 둘 + 마이그레이션 뒤 A 가 쓴 둘. 거부된 쓰기는 아무것도 남기지 않았다
      expect(await reservations()).toEqual([
        { endpoint_path: P, workspace_id: WS.a },
        { endpoint_path: Q, workspace_id: WS.b },
        { endpoint_path: R, workspace_id: WS.a },
        { endpoint_path: S, workspace_id: WS.a },
      ]);

      // (5) 워크스페이스를 지우면 예약은 주인 없이 남고 누구도 못 쓴다
      await db.query('DELETE FROM trigger WHERE workspace_id = $1', [WS.a]);
      await db.query('DELETE FROM workspace WHERE id = $1', [WS.a]);
      expect(
        (await reservations()).filter((r) => r.workspace_id === null),
      ).toEqual([
        { endpoint_path: P, workspace_id: null },
        { endpoint_path: R, workspace_id: null },
        { endpoint_path: S, workspace_id: null },
      ]);
      rejected(await insertAttempt(WS.b, S));
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
