import {
  DEFAULT_SEQ_KEY_TTL_SECONDS,
  EXECUTION_MEMORY_MAX_ENTRIES,
  formatEvictionWarning,
  resolveExecutionSeqTtlSeconds,
  sanitizeExecutionIdForLog,
} from './execution-memory.policy';

describe('execution-memory.policy', () => {
  const ENV = 'EXECUTION_SEQ_TTL_SECONDS';
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env[ENV];
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[ENV];
    else process.env[ENV] = prev;
  });

  it('resolveExecutionSeqTtlSeconds 는 양수만 받고 소수는 버린다', () => {
    process.env[ENV] = '90.7';
    expect(resolveExecutionSeqTtlSeconds()).toBe(90);
  });

  it('resolveExecutionSeqTtlSeconds 는 미설정 · 잘못된 값에 기본값을 쓴다', () => {
    delete process.env[ENV];
    expect(resolveExecutionSeqTtlSeconds()).toBe(DEFAULT_SEQ_KEY_TTL_SECONDS);
    for (const bad of ['abc', '-1', '0', 'Infinity']) {
      process.env[ENV] = bad;
      expect(resolveExecutionSeqTtlSeconds()).toBe(DEFAULT_SEQ_KEY_TTL_SECONDS);
    }
  });

  it('sanitizeExecutionIdForLog 는 CR · LF · 탭을 공백으로 바꾸고 128자로 자른다', () => {
    expect(sanitizeExecutionIdForLog('a\rb\nc\td')).toBe('a b c d');
    expect(sanitizeExecutionIdForLog('x'.repeat(200))).toHaveLength(128);
  });

  it('formatEvictionWarning 은 상한 · 건수 · sanitize 한 id 를 적는다', () => {
    expect(formatEvictionWarning('seq 미러', ['e-1', 'e\n2'])).toBe(
      `seq 미러 상한(${EXECUTION_MEMORY_MAX_ENTRIES}) 초과로 2건 회수: e-1, e 2`,
    );
  });
});
