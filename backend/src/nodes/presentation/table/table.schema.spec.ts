import { evaluateWarnings } from '@workflow/node-summary';
import { tableNodeMetadata, validateTableConfig } from './table.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('tableNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      tableNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('table:no-columns', () => {
    it('fires when columns is empty', () => {
      expect(firedIds({ mode: 'dynamic', columns: [] })).toContain(
        'table:no-columns',
      );
    });

    it('fires when columns is missing entirely', () => {
      expect(firedIds({ mode: 'dynamic' })).toContain('table:no-columns');
    });

    it('does NOT fire when at least one column is defined', () => {
      expect(
        firedIds({ mode: 'dynamic', columns: [{ field: 'name' }] }),
      ).not.toContain('table:no-columns');
    });
  });

  describe('table:invalid-mode', () => {
    it('fires for unknown modes', () => {
      expect(
        firedIds({ mode: 'unknown', columns: [{ field: 'a' }] }),
      ).toContain('table:invalid-mode');
    });

    it('does NOT fire for static / dynamic', () => {
      expect(
        firedIds({ mode: 'static', columns: [{ field: 'a' }] }),
      ).not.toContain('table:invalid-mode');
      expect(
        firedIds({ mode: 'dynamic', columns: [{ field: 'a' }] }),
      ).not.toContain('table:invalid-mode');
    });
  });
});

describe('validateTableConfig (imperative)', () => {
  it('returns [] for a fully-configured table', () => {
    expect(
      validateTableConfig({
        mode: 'dynamic',
        columns: [{ field: 'name' }],
      }),
    ).toEqual([]);
  });

  it('rejects non-array columns', () => {
    expect(validateTableConfig({ mode: 'dynamic', columns: 'oops' })).toContain(
      'columns must be an array',
    );
  });

  it('does NOT reject undefined columns (zod default applies)', () => {
    expect(validateTableConfig({ mode: 'dynamic' })).toEqual([]);
  });

  it('rejects non-array rows in static mode', () => {
    expect(
      validateTableConfig({
        mode: 'static',
        columns: [{ field: 'a' }],
        rows: 'oops',
      }),
    ).toContain('rows must be an array in static mode');
  });

  it('does NOT enforce rows-array in dynamic mode', () => {
    expect(
      validateTableConfig({
        mode: 'dynamic',
        columns: [{ field: 'a' }],
        rows: 'irrelevant-in-dynamic',
      }),
    ).toEqual([]);
  });

  it('rejects sortBy that does not match any column field', () => {
    expect(
      validateTableConfig({
        mode: 'dynamic',
        columns: [{ field: 'name' }, { field: 'age' }],
        sortBy: 'missing',
      }),
    ).toContain('sortBy "missing" must match one of the defined column fields');
  });

  it('accepts sortBy that matches a defined column field', () => {
    expect(
      validateTableConfig({
        mode: 'dynamic',
        columns: [{ field: 'name' }, { field: 'age' }],
        sortBy: 'age',
      }),
    ).toEqual([]);
  });

  it('forwards global buttons errors via shared validateButtons', () => {
    const errors = validateTableConfig({
      mode: 'dynamic',
      columns: [{ field: 'name' }],
      buttons: [{ id: '', type: 'port', label: '' }],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'buttons[0].id is required',
        'buttons[0].label is required and must be a string',
      ]),
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (table)', () => {
  it('merges declarative warning + imperative validation', () => {
    const errors = evaluateMetadataBlockingErrors(tableNodeMetadata, {
      mode: 'dynamic',
      columns: [],
      sortBy: 'phantom',
    });
    expect(errors).toContain('컬럼을 1개 이상 정의해야 합니다.');
    // sortBy doesn't match because columns is empty → no field list → skipped.
    // Add a column to confirm that branch fires correctly:
    const withColumn = evaluateMetadataBlockingErrors(tableNodeMetadata, {
      mode: 'dynamic',
      columns: [{ field: 'name' }],
      sortBy: 'phantom',
    });
    expect(withColumn).toContain(
      'sortBy "phantom" must match one of the defined column fields',
    );
  });
});
