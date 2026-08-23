import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import { getMetadataArgsStorage } from 'typeorm';

import { createDbClient } from './helpers/db';
import { Execution } from '../src/modules/executions/entities/execution.entity';
import {
  PG_INT4_MAX,
  TERMINAL_DURATION_MS_SQL,
  TERMINAL_FINISHED_AT_PARAM,
} from '../src/shared/utils/terminal-duration';

/**
 * 테이블·컬럼명을 테스트에 **하드코딩하지 않는다** — 엔티티 메타데이터에서 유도한다.
 *
 * 처음엔 `'executions'` 라고 적었다가 실제 테이블이 `'execution'` 이라 실패했다. 손으로
 * 적으면 SQL 이 가진 것과 **같은 종류의 하드코딩**을 테스트가 하나 더 만드는 셈이라,
 * 대조의 의미가 없어진다.
 */
function entityTable(): string {
  const t = getMetadataArgsStorage().tables.find((x) => x.target === Execution);
  if (!t?.name) throw new Error('Execution 엔티티의 테이블명을 못 읽었다');
  return t.name;
}

/** 엔티티 property 에 대응하는 DB 컬럼명. */
function entityColumn(propertyName: string): string {
  const c = getMetadataArgsStorage().columns.find(
    (x) => x.target === Execution && x.propertyName === propertyName,
  );
  const name = c?.options?.name;
  if (!name) throw new Error(`${propertyName} 의 컬럼명을 못 읽었다`);
  return name;
}

/**
 * e2e: `TERMINAL_DURATION_MS_SQL` 을 **실제 Postgres 에서 값으로** 검증한다.
 *
 * ## 왜 단위 테스트로는 원리적으로 못 잡나
 *
 * 이 SQL 은 문자열이다. 단위 스펙이 할 수 있는 건 그 문자열에 `LEAST` 가 들어 있는지 보는
 * 것뿐이고, *"`EXTRACT(EPOCH …)` 는 **초**를 주므로 `* 1000` 이 필요하다"* 같은 **의미**는
 * 검증하지 못한다 — 초/밀리초를 헷갈려도 `toContain` 은 초록이다. 실행해야만 갈린다.
 *
 * 이 SQL 을 태우는 기존 e2e(`webchat-idle-reaper`)도 `duration_ms` 를 SELECT/assert 하지
 * 않아, 부호·단위·클램프 오류를 잡을 안전망이 **한 겹도 없었다**. 클램프 부재가 실제로
 * 리뷰로만 잡혔던 것이 그 비용의 실증이다.
 *
 * ## 정본 문자열을 그대로 태운다
 *
 * 테스트가 SQL 을 재작성하면 검증 대상이 사라진다. 이름 있는 파라미터만 pg 자리표시자로
 * 바꾸고 나머지는 손대지 않는다.
 */

/** 정본 SQL 에서 named 파라미터만 pg 자리표시자로 치환한다. */
function toPgSql(): string {
  const needle = `:${TERMINAL_FINISHED_AT_PARAM}`;
  const occurrences = TERMINAL_DURATION_MS_SQL.split(needle).length - 1;
  // 치환이 0건이면 아래 쿼리는 파라미터를 안 쓰는 다른 것이 된다 — vacuous 방지.
  expect(occurrences).toBeGreaterThan(0);
  return TERMINAL_DURATION_MS_SQL.split(needle).join('$1');
}

describe('TERMINAL_DURATION_MS_SQL — 실제 Postgres 값 검증', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  /** 합성 행에 정본 SQL 을 적용해 `duration_ms` 를 돌려받는다. */
  async function durationMs(
    startedAt: string,
    finishedAt: string,
  ): Promise<number | null> {
    const res = await db.query<{ duration_ms: number | string | null }>(
      `SELECT ${toPgSql()} AS duration_ms
         FROM (SELECT $2::timestamptz AS started_at) AS t`,
      [finishedAt, startedAt],
    );
    const raw = res.rows[0].duration_ms;
    // pg 드라이버는 정수 컬럼을 number 로 주지만, 캐스팅 조합에 따라 문자열일 수 있다.
    return raw === null ? null : Number(raw);
  }

  it('[단위] 1,500ms 경과를 밀리초로 돌려준다 — 초로 계산하면 여기서 갈린다', async () => {
    await expect(
      durationMs('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.500Z'),
    ).resolves.toBe(1500);
  });

  it('[부호] `finishedAt < started_at` 이면 NULL — 0 이 아니다', async () => {
    // 종전 `GREATEST(0, …)` 는 같은 이상 상황에 **0ms 만에 끝남** 을 보고했다.
    // JS 쌍둥이(`resolveTerminalDurationMs`)가 null 을 내므로 sentinel 이 같아야 한다.
    await expect(
      durationMs('2026-01-01T00:00:10.000Z', '2026-01-01T00:00:00.000Z'),
    ).resolves.toBeNull();
  });

  it('[경계] 같은 시각이면 0 — NULL 과 구분된다', async () => {
    await expect(
      durationMs('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    ).resolves.toBe(0);
  });

  /**
   * `duration_ms` 는 int4(최대 ≈24.8일)다. 클램프가 없으면 `::int` 캐스팅이
   * `integer out of range` 로 **UPDATE 문 전체를 실패**시키고, 이 SQL 을 쓰는 5경로는
   * 하필 오래 대기한 실행을 마감하는 자리라 24.8일 초과가 정상 시나리오다.
   */
  it('[클램프] int4 를 넘는 경과는 saturate 되고 문장이 실패하지 않는다', async () => {
    await expect(
      durationMs('2026-01-01T00:00:00.000Z', '2026-04-11T00:00:00.000Z'),
    ).resolves.toBe(PG_INT4_MAX);
  });

  /**
   * SQL 이 컬럼명 `started_at` 을 **문자열로 하드코딩**한다. 스키마와 대조해 두지 않으면
   * 컬럼이 이름을 바꿀 때 런타임에서야 드러난다.
   *
   * 함께 `duration_ms` 의 실제 타입도 본다 — **`PG_INT4_MAX` 클램프의 전제**가 바로 그
   * 컬럼이 int4 라는 사실이다. 전제가 조용히 바뀌면(예: bigint 승격) 클램프는 근거 없는
   * 절단이 된다.
   */
  describe('스키마 전제', () => {
    async function column(name: string): Promise<{ data_type: string } | null> {
      const res = await db.query<{ data_type: string }>(
        `SELECT data_type FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2`,
        [entityTable(), name],
      );
      return res.rows[0] ?? null;
    }

    it('SQL 이 하드코딩한 컬럼명이 엔티티·스키마와 일치한다', async () => {
      const startedAt = entityColumn('startedAt');
      // SQL 문자열 ↔ 엔티티
      expect(TERMINAL_DURATION_MS_SQL).toContain(startedAt);
      // 엔티티 ↔ 실 스키마
      await expect(column(startedAt)).resolves.not.toBeNull();
    });

    it('`duration_ms` 가 integer(int4) — `PG_INT4_MAX` 클램프의 전제', async () => {
      const col = await column(entityColumn('durationMs'));
      expect(col).not.toBeNull();
      expect(col?.data_type).toBe('integer');
    });
  });
});
