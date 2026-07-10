import { evaluateWarnings } from '@workflow/node-summary';
import {
  validateVariableModificationConfig,
  variableModificationNodeMetadata,
} from './variable-modification.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('variableModificationNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      variableModificationNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('variable_modification:no-modifications', () => {
    it('fires when modifications is missing', () => {
      expect(firedIds({})).toContain('variable_modification:no-modifications');
    });

    it('fires when modifications is empty', () => {
      expect(firedIds({ modifications: [] })).toContain(
        'variable_modification:no-modifications',
      );
    });

    it('does NOT fire when modifications has entries', () => {
      expect(
        firedIds({ modifications: [{ variable: 'x', operation: 'set' }] }),
      ).not.toContain('variable_modification:no-modifications');
    });
  });

  describe('variable_modification:first-variable-empty', () => {
    it('fires when first modification has no variable', () => {
      expect(firedIds({ modifications: [{ operation: 'set' }] })).toContain(
        'variable_modification:first-variable-empty',
      );
    });

    it('does NOT fire when first modification has a variable', () => {
      expect(
        firedIds({ modifications: [{ variable: 'x', operation: 'set' }] }),
      ).not.toContain('variable_modification:first-variable-empty');
    });
  });
});

describe('validateVariableModificationConfig (imperative)', () => {
  it('returns [] for a valid modification', () => {
    expect(
      validateVariableModificationConfig({
        modifications: [{ variable: 'x', operation: 'set' }],
      }),
    ).toEqual([]);
  });

  it('rejects modification without variable', () => {
    expect(
      validateVariableModificationConfig({
        modifications: [{ operation: 'set' }],
      }),
    ).toContain('modifications[0].variable is required and must be a string');
  });

  it('rejects unknown operation', () => {
    const errors = validateVariableModificationConfig({
      modifications: [{ variable: 'x', operation: 'sploosh' }],
    });
    expect(errors.some((e) => e.startsWith('modifications[0].operation'))).toBe(
      true,
    );
  });

  it('rejects legacy operations removed from the enum (set_field/delete_field)', () => {
    // `set_field` / `delete_field` were removed from `modOperationSchema`
    // because the handler never implemented them. Keep them explicitly
    // rejected here to catch accidental re-introduction.
    for (const op of ['set_field', 'delete_field']) {
      expect(
        validateVariableModificationConfig({
          modifications: [{ variable: 'x', operation: op }],
        }).some((e) => e.startsWith('modifications[0].operation')),
      ).toBe(true);
    }
  });

  // L1 — 예약 prefix (`spec/conventions/execution-context.md` 원칙 5).
  it('rejects a target variable starting with the reserved "__" prefix', () => {
    expect(
      validateVariableModificationConfig({
        modifications: [{ variable: '__workspaceId', operation: 'set' }],
      }),
    ).toContain(
      'modifications[0].variable must not start with reserved prefix "__"',
    );
  });

  it('reports the offending index for reserved names', () => {
    expect(
      validateVariableModificationConfig({
        modifications: [
          { variable: 'ok', operation: 'set' },
          { variable: '__dryRun', operation: 'set' },
        ],
      }),
    ).toContain(
      'modifications[1].variable must not start with reserved prefix "__"',
    );
  });

  it('allows a single-underscore target (원칙 4 는 top-level 전용)', () => {
    expect(
      validateVariableModificationConfig({
        modifications: [{ variable: '_private', operation: 'set' }],
      }),
    ).toEqual([]);
  });

  it('does not stack the reserved error on top of the missing-variable error', () => {
    const errors = validateVariableModificationConfig({
      modifications: [{ operation: 'set' }],
    });
    expect(errors).toContain(
      'modifications[0].variable is required and must be a string',
    );
    expect(errors.join('\n')).not.toContain('reserved prefix');
  });
});

describe('evaluateMetadataBlockingErrors integration (variable_modification)', () => {
  it('emits the warning on a freshly-created node', () => {
    expect(
      evaluateMetadataBlockingErrors(variableModificationNodeMetadata, {}),
    ).toContain('At least one modification must be added.');
  });

  it('returns [] when configured', () => {
    expect(
      evaluateMetadataBlockingErrors(variableModificationNodeMetadata, {
        modifications: [{ variable: 'x', operation: 'set' }],
      }),
    ).toEqual([]);
  });
});
