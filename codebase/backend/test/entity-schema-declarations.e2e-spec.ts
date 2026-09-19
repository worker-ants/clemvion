import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import type { EntityMetadata } from 'typeorm';

import { ROOT_ENTITIES } from '../src/database/root-entities';
import { createDbClient } from './helpers/db';

/**
 * e2e: 엔티티가 선언한 인덱스 · 유니크 · CHECK · FK 가 실제 DB 에 **그대로** 있다.
 *
 * `synchronize: false` 라 스키마의 SoT 는 Flyway 마이그레이션이고, 엔티티 데코레이터는 DB 를 바꾸지 않는다.
 * 그래서 선언이 틀려도 아무것도 깨지지 않는다 — 읽는 사람만 속는다(없는 인덱스를 믿고 쿼리를 짜고, 없는 CHECK 를
 * 믿고 앱 검사를 뺀다). 사람이 세 번 손으로 고쳤는데도 여덟 곳이 남아 있었다.
 * 근거·실측: `plan/complete/entity-schema-declaration-drift.md`.
 *
 * **방향은 한쪽이다** — 선언이 있으면 DB 에도 그대로 있어야 한다. DB 에만 있는 인덱스(선언 생략)는 결함이 아니다.
 * 인덱스 방향(`DESC`)은 TypeORM `@Index` 가 표현하지 못해 보지 않는다. 컬럼 정의(타입 · 기본값 · enum 이름)는 이
 * 가드 밖이다.
 *
 * 부분 조건과 CHECK 식은 **문자열로 비교하지 않는다**. 선언의 식으로 임시 테이블(`LIKE` 원본)에 같은 인덱스 · 제약을
 * 실제로 만들고, Postgres 가 정규화한 정의끼리 비교한다 — 표기가 달라도(`!=` / `<>`, `IN (…)` / `= ANY (…)`) 같은
 * 식이면 같다. 만들 수 없는 식(식 전체를 큰따옴표로 감싸 컬럼 이름이 된 것)은 그 자체로 실패다.
 * 전부 한 트랜잭션 안에서 하고 ROLLBACK 한다 — 임시 테이블도 인덱스도 남지 않는다.
 */

/** `pg_constraint.confdeltype` · `confupdtype` 코드 → TypeORM 이 메타데이터에 채우는 이름. */
const FK_ACTION: Readonly<Record<string, string>> = {
  a: 'NO ACTION',
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};

interface DbIndex {
  name: string;
  uniq: boolean;
  pred: string | null;
  cols: Array<string | null>;
}

interface DbForeignKey {
  name: string;
  reftbl: string;
  del: string;
  upd: string;
  cols: string[];
  refcols: string[];
}

type IndexDecl = EntityMetadata['indices'][number];
type ForeignKeyDecl = EntityMetadata['foreignKeys'][number];

function nameOrNone(name: string | undefined): string {
  return name ?? '이름 없음';
}

function describeDbIndex(r: DbIndex): string {
  const unique = r.uniq ? ' UNIQUE' : '';
  const where = r.pred ? ` WHERE ${r.pred}` : '';
  return `${r.name}(${r.cols.join(', ')})${unique}${where}`;
}

function describeIndexDecl(
  meta: EntityMetadata,
  idx: IndexDecl,
  cols: string[],
): string {
  const unique = idx.isUnique ? ' UNIQUE' : '';
  const where = idx.where ? ` WHERE ${idx.where}` : '';
  const decl = `@Index(${nameOrNone(idx.givenName)})`;
  return `${meta.name} ${decl} ${meta.tableName} (${cols.join(', ')})${unique}${where}`;
}

function fkActions(onDelete: string, onUpdate: string): string {
  return `ON DELETE ${onDelete} ON UPDATE ${onUpdate}`;
}

function describeForeignKeyDecl(
  meta: EntityMetadata,
  fk: ForeignKeyDecl,
): string {
  const from = `${meta.tableName} (${fk.columnNames.join(', ')})`;
  const to = `${fk.referencedTablePath} (${fk.referencedColumnNames.join(', ')})`;
  const actions = fkActions(
    fk.onDelete ?? 'NO ACTION',
    fk.onUpdate ?? 'NO ACTION',
  );
  return `${meta.name} FK ${from} → ${to} ${actions}`;
}

function describeDbForeignKey(r: DbForeignKey): string {
  return `${r.name} ${fkActions(FK_ACTION[r.del], FK_ACTION[r.upd])}`;
}

/**
 * 같은 정의가 하나도 없으면 `missing` 을, 있는데 선언한 이름이 그중에 없으면 «이름이 다르다» 를 남긴다.
 * 이름은 선언이 적었을 때만 본다 — 이름 없는 선언은 이름을 주장하지 않는다.
 */
function reportMatch(
  problems: string[],
  label: string,
  matches: ReadonlyArray<{ name: string }>,
  givenName: string | undefined,
  missing: string,
): void {
  if (matches.length === 0) {
    problems.push(`${label} — ${missing}`);
  } else if (givenName && !matches.some((m) => m.name === givenName)) {
    const actual = matches.map((m) => m.name).join(' · ');
    problems.push(`${label} — 이름이 다르다. 실제: ${actual}`);
  }
}

describe('엔티티 스키마 선언 ↔ 실제 DB (선언이 있으면 DB 에도 그대로 있다)', () => {
  let db: Client;
  let ds: DataSource;
  let probeSeq = 0;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    ds = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'postgres',
      port: Number(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USERNAME ?? 'clemvion',
      password: process.env.DB_PASSWORD ?? 'clemvion-e2e',
      database: process.env.DB_DATABASE ?? 'clemvion_e2e',
      // `ROOT_ENTITIES` 는 `readonly` 튜플이라 펼쳐 넘긴다 — `app.module.ts` 와 같은 형태.
      entities: [...ROOT_ENTITIES],
      synchronize: false,
    });
    await ds.initialize();
  });

  afterAll(async () => {
    await ds?.destroy();
    await db?.end();
  });

  /** 트랜잭션 안에서 `fn` 을 돌리고 무조건 ROLLBACK 한다. */
  async function inRolledBackTx<T>(fn: () => Promise<T>): Promise<T> {
    await db.query('BEGIN');
    try {
      return await fn();
    } finally {
      await db.query('ROLLBACK');
    }
  }

  /** SAVEPOINT 로 감싸 실패해도 트랜잭션을 살린다. 실패하면 Postgres 오류 메시지를 돌려준다. */
  async function attempt<T>(
    fn: () => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
    await db.query('SAVEPOINT probe');
    try {
      const value = await fn();
      await db.query('RELEASE SAVEPOINT probe');
      return { ok: true, value };
    } catch (err_: unknown) {
      await db.query('ROLLBACK TO SAVEPOINT probe');
      return {
        ok: false,
        error: err_ instanceof Error ? err_.message : String(err_),
      };
    }
  }

  function qualified(table: string): string {
    return `public.${db.escapeIdentifier(table)}`;
  }

  /** 원본과 같은 컬럼(타입 포함)을 가진 빈 임시 테이블. `LIKE` 기본이라 CHECK · 인덱스는 따라오지 않는다(NOT NULL 만). */
  async function probeTable(table: string): Promise<string> {
    probeSeq += 1;
    const name = `schema_decl_probe_${probeSeq}`;
    await db.query(`CREATE TEMP TABLE ${name} (LIKE ${qualified(table)})`);
    return name;
  }

  async function realIndexes(table: string): Promise<DbIndex[]> {
    const { rows } = await db.query<DbIndex>(
      `SELECT i.relname AS name,
              ix.indisunique AS uniq,
              pg_get_expr(ix.indpred, ix.indrelid) AS pred,
              ARRAY(SELECT a.attname::text
                      FROM unnest(ix.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
                      LEFT JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum
                     ORDER BY k.ord) AS cols
         FROM pg_index ix
         JOIN pg_class i ON i.oid = ix.indexrelid
        WHERE ix.indrelid = $1::regclass
          AND ix.indisvalid`,
      [qualified(table)],
    );
    return rows;
  }

  // 아래 두 함수는 식을 이스케이프 없이 SQL 에 이어 붙인다. 식은 엔티티 데코레이터의 문자열 리터럴(메타데이터)
  // 에서만 온다 — 외부 입력을 넘기는 용도로 쓰지 말 것.

  /** 선언의 부분 조건을 임시 테이블에 실제로 걸어 Postgres 가 정규화한 형태로 돌려준다. */
  async function normalizedPredicate(
    table: string,
    columns: string[],
    where: string,
  ): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
    return attempt(async () => {
      const probe = await probeTable(table);
      const cols = columns.map((c) => db.escapeIdentifier(c)).join(', ');
      await db.query(
        `CREATE INDEX ${probe}_idx ON ${probe} (${cols}) WHERE ${where}`,
      );
      const { rows } = await db.query<{ pred: string }>(
        `SELECT pg_get_expr(ix.indpred, ix.indrelid) AS pred
           FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid
          WHERE i.relname = $1`,
        [`${probe}_idx`],
      );
      return rows[0].pred;
    });
  }

  /** 선언의 CHECK 식을 임시 테이블에 실제로 걸어 Postgres 가 정규화한 정의를 돌려준다. */
  async function normalizedCheck(
    table: string,
    expression: string,
  ): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
    return attempt(async () => {
      const probe = await probeTable(table);
      await db.query(
        `ALTER TABLE ${probe} ADD CONSTRAINT ${probe}_chk CHECK (${expression})`,
      );
      const { rows } = await db.query<{ def: string }>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conrelid = $1::regclass AND conname = $2`,
        [probe, `${probe}_chk`],
      );
      return rows[0].def;
    });
  }

  function sameColumns(
    a: ReadonlyArray<string | null>,
    b: ReadonlyArray<string>,
  ): boolean {
    // `pg` 는 `name[]` 을 배열로 풀지 않고 문자열로 돌려준다 — 쿼리가 `attname::text` 캐스트를 잃으면 모든 선언이
    // «없다» 로 떨어진다. 그 실패가 엔티티 결함처럼 보이지 않도록 여기서 크게 멈춘다.
    if (!Array.isArray(a)) {
      throw new Error(
        `카탈로그 컬럼 목록이 배열이 아니다(${typeof a}) — 쿼리의 attname::text 캐스트를 확인`,
      );
    }
    return a.length === b.length && a.every((c, i) => c === b[i]);
  }

  it('정규화 비교가 표기 차이는 같다고, 컬럼 이름이 된 식은 만들 수 없다고 판정한다 (판별력 대조군)', async () => {
    await inRolledBackTx(async () => {
      const real = await db.query<{ def: string }>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conrelid = 'public.edge'::regclass AND conname = 'chk_no_self_loop'`,
      );
      expect(real.rows).toHaveLength(1);

      // 저장된 정의는 Postgres 가 `<>` 로 정규화한 문자열이다(V001 원문은 `!=`). 선언 문자열 그대로는
      // 그것과 다르지만, 임시 테이블에서 같은 정규화를 거치면 같아진다 — 문자열 비교였다면 여기서 갈렸다.
      const spelledDifferently = await normalizedCheck(
        'edge',
        'source_node_id != target_node_id',
      );
      expect(spelledDifferently).toEqual({ ok: true, value: real.rows[0].def });

      // 식 전체를 큰따옴표로 감싸면 SQL 로는 그런 이름의 컬럼이다 — 만들 수 없다.
      const quoted = await normalizedCheck(
        'edge',
        '"source_node_id != target_node_id"',
      );
      expect(quoted.ok).toBe(false);
      expect(quoted).toMatchObject({
        error: expect.stringMatching(/does not exist/),
      });

      // `IN (…)` 은 V095 의 부분 조건과 같은 정규형이 된다.
      const inList = await normalizedPredicate(
        'node_execution',
        ['execution_id', 'status'],
        "status IN ('waiting_for_input', 'running')",
      );
      const v095 = (await realIndexes('node_execution')).find(
        (i) => i.name === 'idx_node_execution_exec_status_active',
      );
      expect(v095).toBeDefined();
      expect(inList).toEqual({ ok: true, value: v095?.pred });
    });
  });

  it('@Index · @Unique · unique: true — 같은 테이블에 같은 컬럼 순서 · 유일성 · 부분 조건 · (적었으면) 이름의 인덱스가 있다', async () => {
    const problems: string[] = [];
    let checked = 0;
    await inRolledBackTx(async () => {
      for (const meta of ds.entityMetadatas) {
        const table = meta.tableName;
        const real = await realIndexes(table);
        for (const idx of meta.indices) {
          checked += 1;
          const cols = idx.columns.map((c) => c.databaseName);
          const label = describeIndexDecl(meta, idx, cols);
          let pred: string | null = null;
          if (idx.where) {
            const normalized = await normalizedPredicate(
              table,
              cols,
              idx.where,
            );
            if (!normalized.ok) {
              problems.push(
                `${label} — 부분 조건을 만들 수 없다: ${normalized.error}`,
              );
              continue;
            }
            pred = normalized.value;
          }
          const matches = real.filter(
            (r) =>
              sameColumns(r.cols, cols) &&
              r.uniq === idx.isUnique &&
              r.pred === pred,
          );
          const others = real.map(describeDbIndex).join(' · ');
          reportMatch(
            problems,
            label,
            matches,
            idx.givenName,
            `같은 인덱스가 없다. 같은 테이블: ${others}`,
          );
        }
        for (const uq of meta.uniques) {
          checked += 1;
          const cols = uq.columns.map((c) => c.databaseName);
          const label = `${meta.name} @Unique(${nameOrNone(uq.givenName)}) ${table} (${cols.join(', ')})`;
          const matches = real.filter(
            (r) => sameColumns(r.cols, cols) && r.uniq && r.pred === null,
          );
          reportMatch(
            problems,
            label,
            matches,
            uq.givenName,
            '같은 컬럼의 전체 UNIQUE 가 없다',
          );
        }
      }
    });
    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it('@Check — 같은 테이블에 Postgres 가 정규화한 정의가 같은 CHECK 가 있다', async () => {
    const problems: string[] = [];
    let checked = 0;
    await inRolledBackTx(async () => {
      for (const meta of ds.entityMetadatas) {
        for (const chk of meta.checks) {
          checked += 1;
          const table = meta.tableName;
          const label = `${meta.name} @Check(${nameOrNone(chk.givenName)}) ${table} ${chk.expression}`;
          const normalized = await normalizedCheck(table, chk.expression);
          if (!normalized.ok) {
            problems.push(`${label} — 식을 만들 수 없다: ${normalized.error}`);
            continue;
          }
          const { rows } = await db.query<{ name: string; def: string }>(
            `SELECT conname AS name, pg_get_constraintdef(oid) AS def FROM pg_constraint
              WHERE conrelid = $1::regclass AND contype = 'c'`,
            [qualified(table)],
          );
          const matches = rows.filter((r) => r.def === normalized.value);
          const others = rows.map((r) => `${r.name} ${r.def}`).join(' · ');
          reportMatch(
            problems,
            label,
            matches,
            chk.givenName,
            `같은 CHECK 가 없다. 같은 테이블: ${others}`,
          );
        }
      }
    });
    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it('관계 FK — 같은 컬럼 · 참조 테이블 · 참조 컬럼의 FK 가 있고 ON DELETE · ON UPDATE 가 같다', async () => {
    const problems: string[] = [];
    let checked = 0;
    // 카탈로그를 읽기만 하므로 트랜잭션으로 감싸지 않는다 — 위 셋은 임시 테이블을 만들어 ROLLBACK 이 필요했다.
    for (const meta of ds.entityMetadatas) {
      const { rows } = await db.query<DbForeignKey>(
        `SELECT c.conname AS name,
                (SELECT relname FROM pg_class WHERE oid = c.confrelid) AS reftbl,
                c.confdeltype AS del,
                c.confupdtype AS upd,
                ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
                        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum ORDER BY k.ord) AS cols,
                ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
                        JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum ORDER BY k.ord) AS refcols
           FROM pg_constraint c
          WHERE c.conrelid = $1::regclass AND c.contype = 'f'`,
        [qualified(meta.tableName)],
      );
      for (const fk of meta.foreignKeys) {
        checked += 1;
        const label = describeForeignKeyDecl(meta, fk);
        const same = rows.filter(
          (r) =>
            sameColumns(r.cols, fk.columnNames) &&
            r.reftbl === fk.referencedTablePath &&
            sameColumns(r.refcols, fk.referencedColumnNames),
        );
        if (same.length === 0) {
          problems.push(`${label} — 같은 FK 가 없다`);
          continue;
        }
        const exact = same.filter(
          (r) =>
            FK_ACTION[r.del] === (fk.onDelete ?? 'NO ACTION') &&
            FK_ACTION[r.upd] === (fk.onUpdate ?? 'NO ACTION'),
        );
        if (exact.length === 0) {
          const actual = same.map(describeDbForeignKey).join(' · ');
          problems.push(`${label} — 동작이 다르다. 실제: ${actual}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
