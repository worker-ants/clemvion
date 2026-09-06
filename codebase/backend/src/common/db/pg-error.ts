/**
 * PostgreSQL error helpers — TypeORM 의 QueryFailedError 는 wrap 깊이가
 * 호출 경로에 따라 달라서 (raw query vs Repository.insert vs Repository.save),
 * `err.code` 만 보거나 `err.driverError.code` 만 보는 검사 패턴이 곳곳에
 * 흩어져 있었다. 본 헬퍼들이 두 표면 모두 검사하는 단일 진실.
 */

interface PgLikeError {
  code?: string;
  constraint?: string;
  driverError?: { code?: string; constraint?: string };
}

/**
 * PostgreSQL error 의 SQLSTATE 코드 (5자 string) 를 추출. TypeORM
 * QueryFailedError 의 driver wrap 깊이를 모두 흡수.
 */
export function pgErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as PgLikeError;
  return e.code ?? e.driverError?.code;
}

/**
 * PostgreSQL `23505 unique_violation` 여부. partial UNIQUE 인덱스 dedup 흐름
 * (claimThreshold, integration upsert 등) 에서 conflict 감지에 사용.
 */
export function isPostgresUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23505';
}

/**
 * 위반한 제약/인덱스 이름. `pgErrorCode` 와 **같은 두 표면**을 흡수한다.
 *
 * **왜 이름까지 봐야 하나**: `23505` 만 보면 한 테이블의 **모든** UNIQUE 위반이 같은
 * 것으로 보인다. 도메인별 충돌 코드를 발행하려면 어느 인덱스가 부딪혔는지 알아야 하는데,
 * 전역 예외 필터는 그것을 모르므로 서비스 층에서만 좁힐 수 있다.
 *
 * 이름이 없으면 `undefined` — 호출부는 그때 **좁히지 말고** 전역 매핑에 맡겨야 한다.
 * (`review/code/2026/09/06/14_59_48` W1 — 이 추출을 서비스 파일에 손으로 다시 짰다가
 * `driverError` 표면만 보는 **4번째 사본**이 됐다.)
 */
export function pgErrorConstraint(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as PgLikeError;
  return e.constraint ?? e.driverError?.constraint;
}
