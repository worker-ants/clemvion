import {
  resolveTerminalDurationMs,
  TERMINAL_DURATION_MS_SQL,
  TERMINAL_FINISHED_AT_PARAM,
  toFiniteNumber,
} from './terminal-duration';

describe('resolveTerminalDurationMs', () => {
  const started = new Date('2026-08-15T00:00:00.000Z');
  const finished = new Date('2026-08-15T00:00:04.242Z');

  it('이미 계산된 durationMs 를 그대로 쓴다 (재계산하지 않는다)', () => {
    // 재계산하면 DB 에 영속된 값과 wire 값이 갈릴 수 있다.
    expect(
      resolveTerminalDurationMs({ durationMs: 999, startedAt: started, finishedAt: finished }),
    ).toBe(999);
  });

  it('durationMs 가 없으면 startedAt/finishedAt 으로 계산한다', () => {
    expect(resolveTerminalDurationMs({ startedAt: started, finishedAt: finished })).toBe(4242);
  });

  // 이 PR 이 실제로 겪은 회귀 — 조건 블록 밖으로 옮긴 계산이 `startedAt.getTime()` 에서
  // throw 해 catch 가 삼켰고, **종결 emit 자체가 사라졌다**(성공이 실패로 뒤집혔다).
  it.each([
    ['startedAt 부재', { finishedAt: finished }],
    ['finishedAt 부재', { startedAt: started }],
    ['둘 다 부재', {}],
    ['startedAt 이 null', { startedAt: null, finishedAt: finished }],
  ])('%s 이면 throw 하지 않고 null 을 돌려준다', (_label, row) => {
    expect(() => resolveTerminalDurationMs(row)).not.toThrow();
    expect(resolveTerminalDurationMs(row)).toBeNull();
  });

  it('Date 가 아닌 값도 흡수한다 — 부분 select 행이 문자열을 줄 수 있다', () => {
    expect(
      resolveTerminalDurationMs({
        startedAt: '2026-08-15T00:00:00.000Z' as unknown as Date,
        finishedAt: finished,
      }),
    ).toBeNull();
  });

  it('Invalid Date 는 null (NaN 을 wire 로 내보내지 않는다)', () => {
    expect(
      resolveTerminalDurationMs({ startedAt: new Date('nope'), finishedAt: finished }),
    ).toBeNull();
  });

  it('시계 역행(음수)은 null — 수신자의 산술이 깨진다', () => {
    expect(
      resolveTerminalDurationMs({ startedAt: finished, finishedAt: started }),
    ).toBeNull();
  });

  it('durationMs 가 NaN/Infinity 면 계산으로 폴백한다', () => {
    expect(
      resolveTerminalDurationMs({
        durationMs: Number.NaN,
        startedAt: started,
        finishedAt: finished,
      }),
    ).toBe(4242);
  });

  it('durationMs 0 은 유효한 값이다 (falsy 라고 버리지 않는다)', () => {
    // `??` 대신 `||` 를 쓰면 0 이 사라진다 — 순간 완료된 실행이 그 자리다.
    expect(
      resolveTerminalDurationMs({ durationMs: 0, startedAt: started, finishedAt: finished }),
    ).toBe(0);
  });
});

describe('toFiniteNumber', () => {
  // pg 드라이버는 bigint/numeric 을 **문자열**로 준다. RETURNING 원본 행이 그 경로다.
  it.each([
    ['숫자', 4242, 4242],
    ['문자열', '4242', 4242],
    ['0 문자열', '0', 0],
  ])('%s 를 숫자로 좁힌다', (_label, input, expected) => {
    expect(toFiniteNumber(input)).toBe(expected);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['빈 문자열', ''],
    ['공백', '   '],
    ['숫자 아닌 문자열', 'abc'],
    ['NaN', Number.NaN],
    ['객체', {}],
  ])('%s 는 null', (_label, input) => {
    expect(toFiniteNumber(input)).toBeNull();
  });
});

describe('TERMINAL_DURATION_MS_SQL', () => {
  it('상수가 선언한 파라미터 이름을 실제로 쓴다', () => {
    // 둘이 어긋나면 런타임에 "파라미터 미바인딩" 으로만 드러난다 — 정적으로 묶는다.
    expect(TERMINAL_DURATION_MS_SQL).toContain(`:${TERMINAL_FINISHED_AT_PARAM}`);
  });

  it('음수 방어와 started_at 참조를 포함한다', () => {
    expect(TERMINAL_DURATION_MS_SQL).toContain('GREATEST(0');
    expect(TERMINAL_DURATION_MS_SQL).toContain('started_at');
  });
});
