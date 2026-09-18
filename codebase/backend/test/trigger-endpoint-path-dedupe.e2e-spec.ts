import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

import { createDbClient } from './helpers/db';

/**
 * e2e: V131(`trigger.endpoint_path` 워크스페이스 간 중복 정리)의 SQL 을 실제 PostgreSQL 에서 돌린다.
 *
 * **왜 따로 무는가** — Flyway 는 CI · e2e 의 빈 테이블에 V131 을 적용하므로 정리 분기(`rn > 1`)가 한 번도 실행되지
 * 않는다. 그런데 이 파일은 운영 DB 에 단 한 번 적용되고 되돌릴 수 없다(옛 경로를 로그에 남기지 않는다).
 *
 * **어떻게** — 공유 e2e DB 의 `public.trigger` 는 V132 전역 UNIQUE 가 있어 중복을 심을 수 없고, 그 인덱스를 지우려고
 * 테이블을 잠그면 다른 스위트를 막는다. 그래서 한 트랜잭션 안에 임시 스키마를 만들고 `trigger` 의 사본(컬럼 · 기본값 ·
 * CHECK — 인덱스 · FK 는 복사하지 않는다)에 중복을 심은 뒤, `search_path` 로 V131 본문의 비한정 `trigger` 를 사본에
 * 향하게 해 **파일 그대로** 실행하고 ROLLBACK 한다.
 *
 * SoT: `spec/1-data-model.md` `## Rationale` «Webhook `endpoint_path` 전역 유일». 근거 · 실측:
 * `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md`.
 */
const V131_SQL = readFileSync(
  join(__dirname, '..', 'migrations', 'V131__trigger_endpoint_path_dedupe.sql'),
  'utf8',
);

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// 경로 둘 — P 는 셋이 공유(원본 · 복사 · 채팅 채널 복사), Q 는 created_at 이 같은 둘이 공유(id 로 순서를 정한다).
const P = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const R = '33333333-3333-4333-8333-333333333333'; // 중복 없음 — 건드리지 않는다

const ID = {
  pOriginal: 'a0000000-0000-4000-8000-000000000001',
  pCopy: 'a0000000-0000-4000-8000-000000000002',
  pChatCopy: 'a0000000-0000-4000-8000-000000000003',
  qLowId: 'b0000000-0000-4000-8000-000000000001',
  qHighId: 'b0000000-0000-4000-8000-000000000002',
  rAlone: 'c0000000-0000-4000-8000-000000000001',
  noPath: 'd0000000-0000-4000-8000-000000000001',
};

describe('V131 endpoint_path 중복 정리 (e2e)', () => {
  let db: Client;
  const notices: string[] = [];

  beforeAll(async () => {
    db = createDbClient();
    db.on('notice', (n) => notices.push(n.message ?? ''));
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  it('묶음마다 가장 먼저 만든 행만 경로를 유지하고 나머지는 새 v4 경로를 받는다 · created_at 이 같으면 id 순 · 다시 돌리면 0건', async () => {
    await db.query('BEGIN');
    try {
      await db.query('CREATE SCHEMA v131_probe');
      await db.query(
        'CREATE TABLE v131_probe.trigger (LIKE public.trigger INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
      );
      await db.query('SET LOCAL search_path TO v131_probe, public');

      const ws = (n: number) => `e0000000-0000-4000-8000-00000000000${n}`;
      const wf = 'f0000000-0000-4000-8000-000000000001';
      const old = '2026-01-01T00:00:00Z';
      const rows: Array<[string, string, string | null, string, string]> = [
        // [id, workspace, endpoint_path, created_at, config]
        [ID.pOriginal, ws(1), P, '2026-01-01T00:00:00Z', '{}'],
        [ID.pCopy, ws(2), P, '2026-01-01T00:01:00Z', '{}'],
        [
          ID.pChatCopy,
          ws(3),
          P,
          '2026-01-01T00:02:00Z',
          '{"chatChannel":{"provider":"telegram"}}',
        ],
        [ID.qHighId, ws(4), Q, '2026-01-02T00:00:00Z', '{}'],
        [ID.qLowId, ws(5), Q, '2026-01-02T00:00:00Z', '{}'],
        [ID.rAlone, ws(6), R, '2026-01-03T00:00:00Z', '{}'],
        [ID.noPath, ws(7), null, '2026-01-04T00:00:00Z', '{}'],
      ];
      for (const [id, workspaceId, path, createdAt, config] of rows) {
        await db.query(
          `INSERT INTO trigger (id, workspace_id, workflow_id, type, name, endpoint_path, config, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'probe', $5, $6::jsonb, $7, $8)`,
          [
            id,
            workspaceId,
            wf,
            path ? 'webhook' : 'manual',
            path,
            config,
            createdAt,
            old,
          ],
        );
      }

      notices.length = 0;
      await db.query(V131_SQL);

      const after = await db.query<{
        id: string;
        endpoint_path: string | null;
        updated_at: Date;
      }>('SELECT id, endpoint_path, updated_at FROM trigger');
      const byId = new Map(after.rows.map((r) => [r.id, r]));
      const pathOf = (id: string) => byId.get(id)?.endpoint_path;

      // 유지: 묶음마다 가장 먼저 만든 행(P) · created_at 이 같으면 id 가 작은 행(Q) · 중복 없는 행 · 경로 없는 행
      expect(pathOf(ID.pOriginal)).toBe(P);
      expect(pathOf(ID.qLowId)).toBe(Q);
      expect(pathOf(ID.rAlone)).toBe(R);
      expect(pathOf(ID.noPath)).toBeNull();

      // 새 경로: 나머지 셋 — v4 형식(CHECK 통과) · 서로 다르고 원래 경로와도 다르다 · updated_at 이 갱신된다
      const regenerated = [ID.pCopy, ID.pChatCopy, ID.qHighId];
      const fresh = regenerated.map((id) => pathOf(id));
      for (const [i, path] of fresh.entries()) {
        expect(path).toMatch(V4);
        expect([P, Q, R]).not.toContain(path);
        expect(byId.get(regenerated[i])?.updated_at.getTime()).toBeGreaterThan(
          new Date(old).getTime(),
        );
      }
      expect(new Set(fresh).size).toBe(3);

      const dup = await db.query<{ n: string }>(
        `SELECT count(*) AS n FROM (SELECT endpoint_path FROM trigger WHERE endpoint_path IS NOT NULL
           GROUP BY 1 HAVING count(*) > 1) d`,
      );
      expect(dup.rows[0].n).toBe('0');

      // NOTICE: 바뀐 행마다 한 줄 + 합계. 채팅 채널 여부를 싣고, 경로(비밀 키)는 싣지 않는다.
      const perRow = notices.filter((m) =>
        m.includes('endpoint_path regenerated'),
      );
      expect(perRow).toHaveLength(3);
      expect(perRow.filter((m) => m.includes('chat_channel=t'))).toEqual([
        expect.stringContaining(ID.pChatCopy),
      ]);
      expect(notices.at(-1)).toContain(
        '3 trigger(s) regenerated, 1 chat channel',
      );
      for (const secret of [P, Q, ...fresh]) {
        expect(notices.join('\n')).not.toContain(secret);
      }

      // 멱등: 다시 돌리면 0건
      notices.length = 0;
      await db.query(V131_SQL);
      expect(notices.at(-1)).toContain(
        '0 trigger(s) regenerated, 0 chat channel',
      );
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
