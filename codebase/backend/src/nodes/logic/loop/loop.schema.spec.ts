import {
  loopNodeConfigSchema,
  loopNodeMetadata,
  validateLoopConfig,
} from './loop.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('loopNodeConfigSchema (zod parse)', () => {
  // "최소 반복 1회" 정책의 핵심 불변량 — default('1') 가 빈 값을 채운다는 사실이
  // warningRule 제거의 전제. 이 테스트가 깨지면 정책 자체가 무너짐.
  // spec/4-nodes/1-logic/3-loop.md §8 Rationale 참고.
  it('parses empty object as { count: "1", maxIterations: 1000 } — "최소 반복 1회"', () => {
    expect(loopNodeConfigSchema.parse({})).toMatchObject({
      count: '1',
      maxIterations: 1000,
    });
  });

  it('preserves explicit count value over default', () => {
    expect(loopNodeConfigSchema.parse({ count: '10' })).toMatchObject({
      count: '10',
    });
  });

  it('preserves explicit empty string count (zod default applies only to undefined)', () => {
    // 빈 string 은 default 가 적용되지 않음 — runtime safety net
    // (engine 의 INVALID_CONTAINER_PARAM) 이 잡는 영역.
    expect(loopNodeConfigSchema.parse({ count: '' })).toMatchObject({
      count: '',
    });
  });
});

describe('loopNodeMetadata.warningRules', () => {
  // count zod schema 가 default('1') 이라 빈 값 발생 경로가 닫혀 있음.
  // "count missing" warningRule 은 의도적으로 두지 않는다 — dead rule 회피.
  // 정책 배경: spec/4-nodes/1-logic/3-loop.md §8 Rationale.
  it('is intentionally empty — see spec §8 Rationale', () => {
    expect(loopNodeMetadata.warningRules).toEqual([]);
  });
});

describe('validateLoopConfig (imperative)', () => {
  it('returns [] when count is a valid numeric string', () => {
    expect(validateLoopConfig({ count: '10' })).toEqual([]);
  });

  it('returns [] when count is an unresolved expression', () => {
    expect(validateLoopConfig({ count: '{{ $var.n }}' })).toEqual([]);
  });

  it('rejects negative or zero count', () => {
    expect(validateLoopConfig({ count: '0' })).toContain(
      'count must be greater than 0',
    );
  });

  it('rejects non-numeric count literals', () => {
    expect(validateLoopConfig({ count: 'abc' })).toContain(
      'count must be a number or expression',
    );
  });

  it('rejects count > maxIterations cross-field (both numeric)', () => {
    const errors = validateLoopConfig({ count: 200, maxIterations: 100 });
    expect(errors).toContain(
      'count must be less than or equal to maxIterations (100)',
    );
  });

  it('skips cross-field check when count is a numeric string (spec §8 — string count 는 raw 보존)', () => {
    // 의도적: validateLoopConfig 의 `typeof count === 'number'` 가드는 사용자
    // 입력 raw string 을 schema 단에서 강제 변환·재해석하지 않기 위함.
    // 문자열 → 숫자 강제는 engine 의 coerceContainerNumber 단계에서 일어남.
    expect(
      validateLoopConfig({ count: '200', maxIterations: 100 }),
    ).toEqual([]);
  });

  it('skips cross-field check when count is an expression', () => {
    expect(
      validateLoopConfig({ count: '{{ $var.n }}', maxIterations: 5 }),
    ).toEqual([]);
  });

  // "최소 반복 1회" 정책 — handler 는 빈 값을 차단하지 않는다 (zod default 가
  // storage 단계에서 채우므로). 다음 3 케이스는 빈 값 통과의 명시적 회귀 테스트.
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
  ])('returns [] when count is %s (spec §8 — 빈 값 통과)', (_label, value) => {
    expect(validateLoopConfig({ count: value })).toEqual([]);
  });

  it('returns [] when config itself is empty', () => {
    expect(validateLoopConfig({})).toEqual([]);
  });
});

describe('evaluateMetadataBlockingErrors integration (loop)', () => {
  // "최소 반복 1회" 정책: zod default('1') 이 빈 값을 미리 채우므로 빈
  // config 가 handler.validate 단계까지 도달하면 단순히 통과한다 — 0/음수 등
  // 명시적 무효 값만 validateLoopConfig 가 잡는다.
  it('returns [] when config is empty (zod default fills count)', () => {
    expect(evaluateMetadataBlockingErrors(loopNodeMetadata, {})).toEqual([]);
  });

  it('returns [] when count is set and valid', () => {
    expect(
      evaluateMetadataBlockingErrors(loopNodeMetadata, { count: '10' }),
    ).toEqual([]);
  });

  it('still blocks explicit zero count', () => {
    expect(
      evaluateMetadataBlockingErrors(loopNodeMetadata, { count: '0' }),
    ).toContain('count must be greater than 0');
  });
});
