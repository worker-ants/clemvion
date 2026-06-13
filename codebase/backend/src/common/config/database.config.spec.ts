import { databaseConfig } from './database.config';

/**
 * M-5 — DB 커넥션 풀 env 노출. 핵심 계약: env 미설정 시 기본값이 현 동작
 * (pg 기본 max=10)과 동일해 배포 무변경이고, 잘못된 값은 기본값으로 폴백한다.
 */
describe('databaseConfig pool tuning', () => {
  const POOL_KEYS = [
    'DB_POOL_MAX',
    'DB_POOL_IDLE_TIMEOUT_MS',
    'DB_POOL_CONNECTION_TIMEOUT_MS',
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of POOL_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of POOL_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('defaults preserve current behavior (max=10, idle=10000, connTimeout=0)', () => {
    const cfg = databaseConfig();
    expect(cfg.poolMax).toBe(10);
    expect(cfg.poolIdleTimeoutMs).toBe(10_000);
    expect(cfg.poolConnectionTimeoutMs).toBe(0);
  });

  it('reads valid integer overrides from env', () => {
    process.env.DB_POOL_MAX = '25';
    process.env.DB_POOL_IDLE_TIMEOUT_MS = '5000';
    process.env.DB_POOL_CONNECTION_TIMEOUT_MS = '2000';
    const cfg = databaseConfig();
    expect(cfg.poolMax).toBe(25);
    expect(cfg.poolIdleTimeoutMs).toBe(5000);
    expect(cfg.poolConnectionTimeoutMs).toBe(2000);
  });

  it('falls back to defaults on non-numeric / negative / empty input', () => {
    process.env.DB_POOL_MAX = 'abc';
    process.env.DB_POOL_IDLE_TIMEOUT_MS = '-1';
    process.env.DB_POOL_CONNECTION_TIMEOUT_MS = '';
    const cfg = databaseConfig();
    expect(cfg.poolMax).toBe(10);
    expect(cfg.poolIdleTimeoutMs).toBe(10_000);
    expect(cfg.poolConnectionTimeoutMs).toBe(0);
  });

  it('accepts explicit 0 for connection timeout (wait indefinitely)', () => {
    process.env.DB_POOL_CONNECTION_TIMEOUT_MS = '0';
    expect(databaseConfig().poolConnectionTimeoutMs).toBe(0);
  });
});
