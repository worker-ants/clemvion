import { evaluateWarnings } from '@workflow/node-summary';
import {
  databaseQueryNodeMetadata,
  validateDatabaseQueryConfig,
} from './database-query.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('databaseQueryNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      databaseQueryNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('database_query:no-integration', () => {
    it('fires when integrationId is missing', () => {
      expect(firedIds({})).toContain('database_query:no-integration');
    });

    it('does NOT fire when integrationId is set', () => {
      expect(firedIds({ integrationId: 'i-1' })).not.toContain(
        'database_query:no-integration',
      );
    });
  });

  describe('database_query:no-query', () => {
    it('fires when query is missing', () => {
      expect(firedIds({})).toContain('database_query:no-query');
    });

    it('fires when query is empty string', () => {
      expect(firedIds({ query: '' })).toContain('database_query:no-query');
    });

    it('does NOT fire when query is set', () => {
      expect(firedIds({ query: 'SELECT 1' })).not.toContain(
        'database_query:no-query',
      );
    });
  });
});

describe('validateDatabaseQueryConfig (imperative)', () => {
  it('returns [] when parameters is omitted', () => {
    expect(validateDatabaseQueryConfig({ query: 'SELECT 1' })).toEqual([]);
  });

  it('accepts parameters as an array', () => {
    expect(validateDatabaseQueryConfig({ parameters: [1, 'two'] })).toEqual([]);
  });

  it('accepts parameters as a JSON-array string', () => {
    expect(validateDatabaseQueryConfig({ parameters: '[1, "two"]' })).toEqual(
      [],
    );
  });

  it('rejects parameters that is neither array nor string', () => {
    expect(
      validateDatabaseQueryConfig({ parameters: { a: 1 } as never }),
    ).toContain('parameters must be an array or a JSON array string');
    expect(validateDatabaseQueryConfig({ parameters: 42 as never })).toContain(
      'parameters must be an array or a JSON array string',
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (database_query)', () => {
  it('emits both warnings on a freshly-created node', () => {
    const errors = evaluateMetadataBlockingErrors(
      databaseQueryNodeMetadata,
      {},
    );
    expect(errors).toContain('Database integration must be selected.');
    expect(errors).toContain('SQL query must be entered.');
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(databaseQueryNodeMetadata, {
        integrationId: 'i-1',
        query: 'SELECT 1',
      }),
    ).toEqual([]);
  });
});
