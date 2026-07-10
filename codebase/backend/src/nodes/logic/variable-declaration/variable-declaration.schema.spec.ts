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

  // L1 — 예약 prefix (`spec/conventions/execution-context.md` 원칙 5).
  // 리터럴 이름만 여기서 잡힌다. `{{ }}` 로 만들어지는 이름은 handler(L2) 몫.
  it('rejects a variable name starting with the reserved "__" prefix', () => {
    expect(
      validateVariableDeclarationConfig({
        variables: [{ name: '__workspaceId', type: 'string' }],
      }),
    ).toContain('variables[0].name must not start with reserved prefix "__"');
  });

  it('reports the offending index for reserved names', () => {
    expect(
      validateVariableDeclarationConfig({
        variables: [
          { name: 'ok', type: 'string' },
          { name: '__dryRun', type: 'boolean' },
        ],
      }),
    ).toContain('variables[1].name must not start with reserved prefix "__"');
  });

  it('allows a single-underscore name (원칙 4 는 top-level 전용, variables 맵과 무관)', () => {
    expect(
      validateVariableDeclarationConfig({
        variables: [{ name: '_private', type: 'string' }],
      }),
    ).toEqual([]);
  });

  it('does not stack the reserved error on top of the missing-name error', () => {
    // name 이 비어 있으면 required 에러만 나와야 한다 (else-if 분기 고정).
    const errors = validateVariableDeclarationConfig({
      variables: [{ type: 'string' }],
    });
    expect(errors).toContain(
      'variables[0].name is required and must be a string',
    );
    expect(errors.join('\n')).not.toContain('reserved prefix');
  });
});

describe('evaluateMetadataBlockingErrors integration (variable_declaration)', () => {
  it('emits the warning on a freshly-created node', () => {
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
