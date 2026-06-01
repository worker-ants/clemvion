import {
  DEFAULT_CONTINUATION_WORKER_CONCURRENCY,
  resolveContinuationWorkerConcurrency,
} from './continuation-execution.queue';

/**
 * resolveContinuationWorkerConcurrency 단위 테스트.
 *
 * SoT: spec/5-system/4-execution-engine.md §7.4 / §11
 * (`CONTINUATION_WORKER_CONCURRENCY`).
 *
 * 검증 범위:
 *   1. 유효한 양의 정수는 그대로 반환.
 *   2. 미설정 / 빈 문자열 / 공백 → 기본값(1).
 *   3. 비숫자 / 0 / 음수 / 소수 / 공학표기(`1e10`) → 기본값 fallback
 *      (continuation-dlq-monitor.config.ts 와 동일한 정규식 선검증 규약).
 *   4. 앞뒤 공백은 trim 후 파싱.
 */
describe('resolveContinuationWorkerConcurrency', () => {
  it('유효한 양의 정수를 그대로 반환한다', () => {
    expect(
      resolveContinuationWorkerConcurrency({
        CONTINUATION_WORKER_CONCURRENCY: '4',
      }),
    ).toBe(4);
  });

  it('미설정 시 기본값을 반환한다', () => {
    expect(resolveContinuationWorkerConcurrency({})).toBe(
      DEFAULT_CONTINUATION_WORKER_CONCURRENCY,
    );
    expect(DEFAULT_CONTINUATION_WORKER_CONCURRENCY).toBe(1);
  });

  it('빈 문자열 / 공백만 있는 값은 기본값으로 fallback 한다', () => {
    expect(
      resolveContinuationWorkerConcurrency({
        CONTINUATION_WORKER_CONCURRENCY: '',
      }),
    ).toBe(1);
    expect(
      resolveContinuationWorkerConcurrency({
        CONTINUATION_WORKER_CONCURRENCY: '   ',
      }),
    ).toBe(1);
  });

  it.each([
    ['abc', '비숫자'],
    ['0', '0'],
    ['-2', '음수'],
    ['2.5', '소수'],
    ['1e10', '공학표기'],
    ['0x10', '16진수 표기'],
  ])('잘못된 입력 %s (%s) 은 기본값으로 fallback 한다', (raw) => {
    expect(
      resolveContinuationWorkerConcurrency({
        CONTINUATION_WORKER_CONCURRENCY: raw,
      }),
    ).toBe(1);
  });

  it('앞뒤 공백은 trim 후 파싱한다', () => {
    expect(
      resolveContinuationWorkerConcurrency({
        CONTINUATION_WORKER_CONCURRENCY: '  8  ',
      }),
    ).toBe(8);
  });
});
