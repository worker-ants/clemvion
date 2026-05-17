import { evaluateWarnings } from '@workflow/node-summary';
import { loopNodeMetadata, validateLoopConfig } from './loop.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('loopNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      loopNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('loop:no-count', () => {
    it('fires when count is missing', () => {
      expect(firedIds({})).toContain('loop:no-count');
    });

    it('fires when count is empty string', () => {
      expect(firedIds({ count: '' })).toContain('loop:no-count');
    });

    it('does NOT fire when count is a numeric string', () => {
      expect(firedIds({ count: '10' })).not.toContain('loop:no-count');
    });

    it('does NOT fire when count is an expression', () => {
      expect(firedIds({ count: '{{ $var.n }}' })).not.toContain(
        'loop:no-count',
      );
    });
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
  it('emits the warning when count is missing', () => {
    expect(evaluateMetadataBlockingErrors(loopNodeMetadata, {})).toContain(
      'Count must be entered.',
    );
  });

  it('returns [] when count is set and valid', () => {
    expect(
      evaluateMetadataBlockingErrors(loopNodeMetadata, { count: '10' }),
    ).toEqual([]);
  });
});
