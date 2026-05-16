import { evaluateWarnings } from '@workflow/node-summary';
import { codeNodeMetadata, validateCodeConfig } from './code.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('codeNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      codeNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('code:no-code', () => {
    it('fires when code is missing', () => {
      expect(firedIds({})).toContain('code:no-code');
    });

    it('fires when code is empty string', () => {
      expect(firedIds({ code: '' })).toContain('code:no-code');
    });

    it('does NOT fire when code body is set', () => {
      expect(firedIds({ code: 'return 1;' })).not.toContain('code:no-code');
    });
  });
});

describe('validateCodeConfig (imperative)', () => {
  it('returns [] when timeout is omitted', () => {
    expect(validateCodeConfig({ code: 'return 1;' })).toEqual([]);
  });

  it('returns [] when timeout sits inside 1..120 seconds', () => {
    expect(validateCodeConfig({ code: 'return 1;', timeout: 30 })).toEqual([]);
    expect(validateCodeConfig({ code: 'return 1;', timeout: 1 })).toEqual([]);
    expect(validateCodeConfig({ code: 'return 1;', timeout: 120 })).toEqual([]);
  });

  it('rejects non-numeric timeout', () => {
    expect(validateCodeConfig({ timeout: '30' })).toEqual([
      'timeout must be a number between 1 and 120 seconds',
    ]);
  });

  it('rejects timeout below 1 or above 120', () => {
    expect(validateCodeConfig({ timeout: 0 })).toEqual([
      'timeout must be a number between 1 and 120 seconds',
    ]);
    expect(validateCodeConfig({ timeout: 121 })).toEqual([
      'timeout must be a number between 1 and 120 seconds',
    ]);
  });

  it('rejects non-finite timeout (Infinity, NaN)', () => {
    expect(validateCodeConfig({ timeout: Infinity })).toEqual([
      'timeout must be a number between 1 and 120 seconds',
    ]);
    expect(validateCodeConfig({ timeout: NaN })).toEqual([
      'timeout must be a number between 1 and 120 seconds',
    ]);
  });
});

describe('evaluateMetadataBlockingErrors integration (code)', () => {
  it('emits the Korean warning when code body is empty', () => {
    expect(evaluateMetadataBlockingErrors(codeNodeMetadata, {})).toContain(
      'Body of the code to run must be entered.',
    );
  });

  it('returns [] when code is set and timeout is unset', () => {
    expect(
      evaluateMetadataBlockingErrors(codeNodeMetadata, { code: 'return 1;' }),
    ).toEqual([]);
  });

  it('combines warningRules + validateConfig errors', () => {
    const errors = evaluateMetadataBlockingErrors(codeNodeMetadata, {
      timeout: 999,
    });
    expect(errors).toContain('Body of the code to run must be entered.');
    expect(errors).toContain(
      'timeout must be a number between 1 and 120 seconds',
    );
  });
});
