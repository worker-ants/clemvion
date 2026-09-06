import { QueryFailedError } from 'typeorm';

/**
 * PostgreSQL 에러 fixture — **두 wrap 표면을 만드는 단일 진실.**
 *
 * `common/db/pg-error.ts` 의 헬퍼들이 존재하는 이유가 *"wrap 깊이가 호출 경로마다 다르다"*
 * 인데, 그것을 시험하는 fixture 를 각 spec 이 손으로 다시 만들면 **이 PR 이 프로덕션
 * 코드에서 막으려던 SoT 중복이 테스트에 재발한다** — 실제로 `pg-error.spec.ts` 와
 * `triggers.service.spec.ts` 가 각자 썼다 (`review/code/2026/09/06/15_52_58` W3).
 *
 * 표면이 하나 더 생기면(다른 드라이버·TypeORM 버전) **여기만 고치고 양쪽이 함께 넓어진다.**
 *
 * ## 왜 `common/db/__test-utils__/` 가 아니라 여기인가
 *
 * `tsconfig.build.json` 의 exclude 는 `*spec.ts` · `src/repo-guards/**` ·
 * **`src/shared/testing/**`** 세 가지다. 처음엔 `common/db/__test-utils__/` 에 뒀는데
 * 그 경로는 어디에도 안 걸려 **dist 로 나갔다** — exclude 목록 주석이 이미 두 번 기록한
 * 그 결함이다. 새 exclude 항목을 만드는 대신 **테스트 전용 코드가 이미 사는 자리**를 쓴다.
 */

/** 에러가 올라오는 자리. `save` 는 `driverError`, raw query 는 최상위. */
export type PgErrorSurface = 'driverError' | 'top';

/**
 * `23505 unique_violation` 을 주어진 표면으로 만든다.
 *
 * @param constraint 위반한 제약/인덱스 이름 (`V002__indexes.sql` 등).
 * @param surface    기본값은 `driverError` — `Repository.save` 경로의 형태다.
 */
export function makePgUniqueViolation(
  constraint: string,
  surface: PgErrorSurface = 'driverError',
): unknown {
  return makePgError({ code: '23505', constraint }, surface);
}

/** 임의 SQLSTATE·제약 이름을 주어진 표면으로 만든다. */
export function makePgError(
  props: Record<string, unknown>,
  surface: PgErrorSurface = 'driverError',
): unknown {
  if (surface === 'top') {
    // `Object.assign(new Error(), props)` 는 반환 타입이 교차로 좁혀져 `Error` 필수
    // 프로퍼티를 잃는다(TS2739). 명시적으로 얹는다.
    const err: Record<string, unknown> = new Error(
      'duplicate key',
    ) as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(props)) err[k] = v;
    return err;
  }
  const err = new QueryFailedError('INSERT', [], new Error('duplicate key'));
  (err as QueryFailedError & { driverError: unknown }).driverError = props;
  return err;
}
