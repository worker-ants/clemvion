import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

import { createDbClient } from './helpers/db';

/**
 * e2e: 나간 멤버의 개인 통합을 정리하는 데이터 수정 마이그레이션 두 개(NERV Task `CLE-T-PS7JQY`).
 *
 * - V153: 통합 소유자(`created_by`)가 그 워크스페이스의 멤버가 아닌 개인 통합을 지운다(REQ-INTMGMT-065).
 *   자격 증명을 지우고 되돌릴 수 없어서 술어가 맞는지 먼저 확인한다.
 * - V154: 설치 기한이 지나 만료된 행(`expired` + `install_timeout`)의 `mall_id` 만 비운다(REQ-INTSTAT-040).
 *
 * Flyway 는 빈 테이블에 적용하므로 대상 행이 없다. 그래서 한 트랜잭션 안에 임시 스키마의 테이블 사본을 만들고 파일을
 * 그대로 실행한 뒤 ROLLBACK 한다(선례: `webauthn-2fa.e2e-spec.ts` 의 V152, `merge-default-config.e2e-spec.ts` 의 V148).
 * 실제 테이블에는 실행하지 않는다. 다른 e2e 의 행을 잠그거나 지우기 때문이다.
 *
 * 두 파일은 `DO` 블록이라 `rowCount` 가 없다. 바꾼 건수는 파일이 남기는 NOTICE 로 읽는다.
 */

const migrationSql = (file: string): string =>
  readFileSync(join(__dirname, '..', 'migrations', file), 'utf8');

const V153_SQL = migrationSql(
  'V153__purge_departed_member_personal_integrations.sql',
);
const V154_SQL = migrationSql(
  'V154__integration_install_timeout_release_mall_id.sql',
);

describe('나간 멤버 개인 통합 정리 마이그레이션 (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  }, 30_000);

  afterAll(async () => {
    await db.end();
  });

  /** 마이그레이션이 남기는 NOTICE 문장을 모은다. */
  function captureNotices(): { messages: string[]; stop: () => void } {
    const messages: string[] = [];
    const onNotice = (notice: { message?: string }) => {
      if (notice.message) messages.push(notice.message);
    };
    db.on('notice', onNotice);
    return { messages, stop: () => db.off('notice', onNotice) };
  }

  /** 파일을 한 번 실행하고 NOTICE 에 적힌 건수를 읽는다. 건수 문장이 없으면 실패시킨다. */
  async function runCounting(sql: string, label: 'V153' | 'V154') {
    const notices = captureNotices();
    try {
      await db.query(sql);
    } finally {
      notices.stop();
    }
    const line = notices.messages.find((m) => m.startsWith(`${label}: `));
    if (!line) {
      throw new Error(
        `${label} 가 건수 NOTICE 를 남기지 않았다: ${JSON.stringify(notices.messages)}`,
      );
    }
    return Number(/^\w+: (\d+) /.exec(line)?.[1]);
  }

  /**
   * 임시 스키마에 `integration` 사본을 만들고 검색 경로를 그쪽으로 돌린다. 파일의 이름 없는 `integration` 이 사본을 가리킨다.
   * 사본에는 기본값 · 제약 · 인덱스(PK 와 UNIQUE)가 있고 외래 키는 없다.
   */
  async function createIntegrationProbe(schema: string): Promise<void> {
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(
      `CREATE TABLE ${schema}.integration (LIKE public.integration INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`,
    );
  }

  /**
   * 이름 없는 테이블이 임시 스키마의 사본으로 풀리는지 확인한다. 아니면 실제 테이블에 닿을 수 있어 멈춘다.
   * `regclass::text` 는 검색 경로에 보이는 테이블의 스키마를 떼므로 스키마 이름은 카탈로그에서 읽는다.
   */
  async function expectResolvesToProbe(
    schema: string,
    tables: string[],
  ): Promise<void> {
    for (const table of tables) {
      const res = await db.query<{ schema: string | null }>(
        `SELECT n.nspname AS schema
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.oid = to_regclass($1)`,
        [table],
      );
      expect(res.rows[0]?.schema).toBe(schema);
    }
  }

  // ---------------------------------------------------------------------
  // V153
  // ---------------------------------------------------------------------

  /** 지울 통합 행을 가리키는 외래 키는 모두 ON DELETE CASCADE 다. 파일 헤더의 주장을 실제 스키마로 확인한다. */
  it('V153 전제: integration 을 가리키는 외래 키는 셋이고 모두 CASCADE 다', async () => {
    const res = await db.query<{ child: string; on_delete: string }>(
      `SELECT conrelid::regclass::text AS child, confdeltype AS on_delete
         FROM pg_constraint
        WHERE contype = 'f' AND confrelid = 'public.integration'::regclass
        ORDER BY 1`,
    );
    expect(res.rows).toEqual([
      { child: 'integration_expiry_dispatch', on_delete: 'c' },
      { child: 'integration_oauth_state', on_delete: 'c' },
      { child: 'integration_usage_log', on_delete: 'c' },
    ]);
  });

  it('V153 이 멤버가 아닌 사람의 개인 통합과 CASCADE 자식 행만 지우고 다시 돌리면 0건이다', async () => {
    const id = (n: number) => `a1530000-0000-4000-8000-00000000000${n}`;
    const ws1 = 'b1530000-0000-4000-8000-000000000001';
    const ws2 = 'b1530000-0000-4000-8000-000000000002';
    const left = 'c1530000-0000-4000-8000-000000000001';
    const stays = 'c1530000-0000-4000-8000-000000000002';

    // [id, workspace, scope, status, created_by, 기대: 지운다]
    const integrations: Array<
      [string, string, 'personal' | 'organization', string, string, boolean]
    > = [
      // 나간 사람의 개인 통합은 상태와 관계없이 지운다.
      [id(1), ws1, 'personal', 'connected', left, true],
      [id(2), ws1, 'personal', 'expired', left, true],
      [id(3), ws1, 'personal', 'error', left, true],
      // 조직 통합은 만든 사람이 나가도 남긴다.
      [id(4), ws1, 'organization', 'connected', left, false],
      // 멤버로 남은 사람의 개인 통합은 남긴다.
      [id(5), ws1, 'personal', 'connected', stays, false],
      // 같은 사용자라도 다른 워크스페이스의 멤버면 그 워크스페이스의 개인 통합은 남긴다.
      [id(6), ws2, 'personal', 'connected', left, false],
    ];

    await db.query('BEGIN');
    try {
      await createIntegrationProbe('v153_probe');
      await db.query(
        'CREATE TABLE v153_probe.workspace_member (LIKE public.workspace_member INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)',
      );
      // CASCADE 자식 사본. 외래 키는 사본이 가리키는 임시 통합 테이블로 새로 건다(실제 스키마의 CASCADE 는 위 케이스가 본다).
      for (const child of [
        'integration_usage_log',
        'integration_oauth_state',
        'integration_expiry_dispatch',
      ]) {
        await db.query(
          `CREATE TABLE v153_probe.${child} (LIKE public.${child} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`,
        );
      }
      await db.query('SET LOCAL search_path TO v153_probe, public');
      await expectResolvesToProbe('v153_probe', [
        'integration',
        'workspace_member',
        'integration_usage_log',
        'integration_oauth_state',
        'integration_expiry_dispatch',
      ]);
      for (const child of [
        'integration_usage_log',
        'integration_oauth_state',
        'integration_expiry_dispatch',
      ]) {
        await db.query(
          `ALTER TABLE v153_probe.${child}
             ADD FOREIGN KEY (integration_id) REFERENCES v153_probe.integration(id) ON DELETE CASCADE`,
        );
      }

      // ws1 의 멤버는 stays 뿐이다. left 는 ws2 에만 남아 있다.
      await db.query(
        `INSERT INTO workspace_member (workspace_id, user_id, role) VALUES ($1, $2, 'editor'), ($3, $4, 'editor')`,
        [ws1, stays, ws2, left],
      );
      for (const [rowId, ws, scope, status, createdBy] of integrations) {
        await db.query(
          `INSERT INTO integration (id, workspace_id, service_type, name, auth_type, scope, status, created_by)
             VALUES ($1, $2, 'google', $3, 'oauth2', $4, $5, $6)`,
          [rowId, ws, `probe-${rowId}`, scope, status, createdBy],
        );
        // 모든 통합에 CASCADE 자식 행을 하나씩 단다. 지워진 통합의 자식만 사라져야 한다.
        await db.query(
          `INSERT INTO integration_usage_log (integration_id, node_execution_id, workflow_id, status)
             VALUES ($1, gen_random_uuid(), gen_random_uuid(), 'success')`,
          [rowId],
        );
        await db.query(
          `INSERT INTO integration_oauth_state (state, workspace_id, user_id, provider, service_type, mode, integration_id, expires_at)
             VALUES ($1, $2, $3, 'google', 'google', 'reauthorize', $4, now() + interval '1 hour')`,
          [`probe-state-${rowId}`, ws, createdBy, rowId],
        );
        await db.query(
          `INSERT INTO integration_expiry_dispatch (integration_id, threshold, token_expires_at)
             VALUES ($1, '7d', now() + interval '7 days')`,
          [rowId],
        );
      }

      const first = await runCounting(V153_SQL, 'V153');
      expect(first).toBe(integrations.filter((row) => row[5]).length);

      const left_ = await db.query<{ id: string }>(
        'SELECT id FROM integration ORDER BY id',
      );
      expect(left_.rows.map((r) => r.id)).toEqual(
        integrations.filter((row) => !row[5]).map((row) => row[0]),
      );
      // 남은 통합의 자식 행은 그대로이고 지운 통합의 자식 행은 CASCADE 로 함께 사라졌다.
      for (const child of [
        'integration_usage_log',
        'integration_oauth_state',
        'integration_expiry_dispatch',
      ]) {
        const children = await db.query<{ integration_id: string }>(
          `SELECT integration_id FROM ${child} ORDER BY integration_id`,
        );
        expect(children.rows.map((r) => r.integration_id)).toEqual(
          integrations.filter((row) => !row[5]).map((row) => row[0]),
        );
      }
      // 멤버십은 건드리지 않는다.
      const members = await db.query('SELECT 1 FROM workspace_member');
      expect(members.rowCount).toBe(2);

      expect(await runCounting(V153_SQL, 'V153')).toBe(0);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  // ---------------------------------------------------------------------
  // V154
  // ---------------------------------------------------------------------

  it('V154 가 expired + install_timeout 행의 mall_id 만 비우고 나머지는 그대로이며 다시 돌리면 0건이다', async () => {
    const id = (n: number) => `a1540000-0000-4000-8000-00000000000${n}`;
    const ws = 'b1540000-0000-4000-8000-000000000001';
    const user = 'c1540000-0000-4000-8000-000000000001';
    const OLD = '2020-01-01T00:00:00Z';

    interface Seed {
      id: string;
      service: 'cafe24' | 'makeshop';
      status: string;
      reason: string | null;
      mallId: string | null;
      /** 기대: mall_id 를 비운다. */
      released: boolean;
    }
    const seeds: Seed[] = [
      // 비우는 행: 만료 + 설치 기한 초과. Cafe24 와 MakeShop 둘 다다.
      {
        id: id(1),
        service: 'cafe24',
        status: 'expired',
        reason: 'install_timeout',
        mallId: 'shop-1',
        released: true,
      },
      {
        id: id(2),
        service: 'makeshop',
        status: 'expired',
        reason: 'install_timeout',
        mallId: 'shop-2',
        released: true,
      },
      // 그대로 두는 행: 다른 만료 사유, 사유 없는 만료, 만료가 아닌 상태, 이미 빈 행.
      {
        id: id(3),
        service: 'cafe24',
        status: 'expired',
        reason: 'token_expired',
        mallId: 'shop-3',
        released: false,
      },
      {
        id: id(4),
        service: 'cafe24',
        status: 'expired',
        reason: null,
        mallId: 'shop-4',
        released: false,
      },
      {
        id: id(5),
        service: 'cafe24',
        status: 'pending_install',
        reason: null,
        mallId: 'shop-5',
        released: false,
      },
      {
        id: id(6),
        service: 'cafe24',
        status: 'connected',
        reason: 'install_timeout',
        mallId: 'shop-6',
        released: false,
      },
      {
        id: id(7),
        service: 'cafe24',
        status: 'expired',
        reason: 'install_timeout',
        mallId: null,
        released: false,
      },
    ];
    const credentialsOf = (seed: Seed) =>
      JSON.stringify({
        mall_id: `cred-${seed.id}`,
        shop_uid: `uid-${seed.id}`,
      });

    await db.query('BEGIN');
    try {
      await createIntegrationProbe('v154_probe');
      await db.query('SET LOCAL search_path TO v154_probe, public');
      await expectResolvesToProbe('v154_probe', ['integration']);
      for (const seed of seeds) {
        await db.query(
          `INSERT INTO integration
             (id, workspace_id, service_type, name, auth_type, scope, status, status_reason, mall_id,
              install_token, credentials, created_by, updated_at)
           VALUES ($1, $2, $3, $4, 'oauth2', 'personal', $5, $6, $7, $8, $9::jsonb, $10, $11)`,
          [
            seed.id,
            ws,
            seed.service,
            `probe-${seed.id}`,
            seed.status,
            seed.reason,
            seed.mallId,
            `tok-${seed.id}`,
            credentialsOf(seed),
            user,
            OLD,
          ],
        );
      }

      const first = await runCounting(V154_SQL, 'V154');
      expect(first).toBe(seeds.filter((s) => s.released).length);

      const after = await db.query<{
        id: string;
        status: string;
        status_reason: string | null;
        mall_id: string | null;
        install_token: string | null;
        credentials: Record<string, string>;
        touched: boolean;
      }>(
        `SELECT id, status, status_reason, mall_id, install_token, credentials,
                updated_at > '2021-01-01'::timestamptz AS touched
           FROM integration ORDER BY id`,
      );
      expect(after.rows).toHaveLength(seeds.length);
      for (const [index, row] of after.rows.entries()) {
        const seed = seeds[index];
        expect(row.id).toBe(seed.id);
        // 비우는 행만 mall_id 가 NULL 이 되고 updated_at 이 갱신된다.
        expect(row.mall_id).toBe(seed.released ? null : seed.mallId);
        expect(row.touched).toBe(seed.released);
        // 상태 · 사유 · 설치 토큰 · 자격 증명은 어느 행에서도 건드리지 않는다.
        expect(row.status).toBe(seed.status);
        expect(row.status_reason).toBe(seed.reason);
        expect(row.install_token).toBe(`tok-${seed.id}`);
        expect(row.credentials).toEqual(JSON.parse(credentialsOf(seed)));
      }

      expect(await runCounting(V154_SQL, 'V154')).toBe(0);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
