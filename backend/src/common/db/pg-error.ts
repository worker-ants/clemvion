/**
 * PostgreSQL error helpers — TypeORM 의 QueryFailedError 는 wrap 깊이가
 * 호출 경로에 따라 달라서 (raw query vs Repository.insert vs Repository.save),
 * `err.code` 만 보거나 `err.driverError.code` 만 보는 검사 패턴이 곳곳에
 * 흩어져 있었다. 본 헬퍼들이 두 표면 모두 검사하는 단일 진실.
 */

interface PgLikeError {
  code?: string;
  driverError?: { code?: string };
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
