import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'workflow',
  password: process.env.DB_PASSWORD || 'workflow_dev',
  database: process.env.DB_DATABASE || 'workflow',
  // node-postgres `pg.Pool` 튜닝 (TypeOrm `extra` 로 전달). M-5: 기본값을
  // pg/TypeOrm 의 현 동작과 동일하게 두어 배포 무변경 — 운영이 pg_stat_activity
  // 피크 측정 후 코드 변경 없이 env 만으로 상향할 수 있는 경로를 확보한다.
  // max 상향 시 `인스턴스 수 × poolMax` 합산이 PostgreSQL `max_connections` 를
  // 초과하지 않도록 역산 필수 (초과 시 연결 거부). 음수/NaN 은 기본값으로 폴백.
  poolMax: nonNegativeIntEnv(process.env.DB_POOL_MAX, 10),
  poolIdleTimeoutMs: nonNegativeIntEnv(
    process.env.DB_POOL_IDLE_TIMEOUT_MS,
    10_000,
  ),
  poolConnectionTimeoutMs: nonNegativeIntEnv(
    process.env.DB_POOL_CONNECTION_TIMEOUT_MS,
    0,
  ),
}));

/** Parse a non-negative integer env var, falling back to `fallback` on
 *  missing / non-numeric / negative input. `connectionTimeoutMs=0` (wait
 *  indefinitely) is the pg default, so 0 is a valid explicit value. */
function nonNegativeIntEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
