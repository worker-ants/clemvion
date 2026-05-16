import { evaluateWarnings } from '@workflow/node-summary';
import {
  validateVariableDeclarationConfig,
  variableDeclarationNodeMetadata,
} from './variable-declaration.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('variableDeclarationNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      variableDeclarationNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('variable_declaration:no-variables', () => {
    it('fires when variables is missing', () => {
      expect(firedIds({})).toContain('variable_declaration:no-variables');
    });

    it('fires when variables is empty', () => {
      expect(firedIds({ variables: [] })).toContain(
        'variable_declaration:no-variables',
      );
    });

    it('does NOT fire when at least one variable is defined', () => {
      expect(
        firedIds({ variables: [{ name: 'x', type: 'string' }] }),
      ).not.toContain('variable_declaration:no-variables');
    });
  });

  describe('variable_declaration:first-variable-name-empty', () => {
    it('fires when first variable has no name', () => {
      expect(firedIds({ variables: [{ type: 'string' }] })).toContain(
        'variable_declaration:first-variable-name-empty',
      );
    });

    it('does NOT fire when first variable has a name', () => {
      expect(
        firedIds({ variables: [{ name: 'x', type: 'string' }] }),
      ).not.toContain('variable_declaration:first-variable-name-empty');
    });
  });
});

describe('validateVariableDeclarationConfig (imperative)', () => {
  it('returns [] for a valid variable', () => {
    expect(
      validateVariableDeclarationConfig({
        variables: [{ name: 'x', type: 'string' }],
      }),
    ).toEqual([]);
  });

  it('rejects variable without name', () => {
    expect(
      validateVariableDeclarationConfig({
        variables: [{ type: 'string' }],
      }),
    ).toContain('variables[0].name is required and must be a string');
  });

  it('rejects variable without type', () => {
    expect(
      validateVariableDeclarationConfig({
        variables: [{ name: 'x' }],
      }),
    ).toContain('variables[0].type is required and must be a string');
  });
});

describe('evaluateMetadataBlockingErrors integration (variable_declaration)', () => {
  it('emits the Korean warning on a freshly-created node', () => {
    expect(
      evaluateMetadataBlockingErrors(variableDeclarationNodeMetadata, {}),
    ).toContain('At least one variable must be defined.');
  });

  it('returns [] when configured with a valid variable', () => {
    expect(
      evaluateMetadataBlockingErrors(variableDeclarationNodeMetadata, {
        variables: [{ name: 'x', type: 'string' }],
      }),
    ).toEqual([]);
  });
});
