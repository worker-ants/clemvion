import { loopNodeMetadata, validateLoopConfig } from './loop.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

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

  it('rejects count > maxIterations cross-field', () => {
    const errors = validateLoopConfig({ count: 200, maxIterations: 100 });
    expect(errors).toContain(
      'count must be less than or equal to maxIterations (100)',
    );
  });

  it('skips cross-field check when count is an expression', () => {
    expect(
      validateLoopConfig({ count: '{{ $var.n }}', maxIterations: 5 }),
    ).toEqual([]);
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
