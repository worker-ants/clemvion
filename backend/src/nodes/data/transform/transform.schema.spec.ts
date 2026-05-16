import { evaluateWarnings } from '@workflow/node-summary';
import {
  transformNodeMetadata,
  validateTransformConfig,
} from './transform.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('transformNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      transformNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('transform:no-operations', () => {
    it('fires when operations is missing', () => {
      expect(firedIds({})).toContain('transform:no-operations');
    });

    it('fires when operations is empty array', () => {
      expect(firedIds({ operations: [] })).toContain('transform:no-operations');
    });

    it('does NOT fire when at least one operation is defined', () => {
      expect(
        firedIds({
          operations: [{ type: 'remove_field', field: 'x' }],
        }),
      ).not.toContain('transform:no-operations');
    });
  });
});

describe('validateTransformConfig (imperative)', () => {
  it('returns [] for an empty operations array (warningRules covers it)', () => {
    expect(validateTransformConfig({ operations: [] })).toEqual([]);
  });

  it('returns [] for a fully-formed rename_field op', () => {
    expect(
      validateTransformConfig({
        operations: [{ type: 'rename_field', from: 'a', to: 'b' }],
      }),
    ).toEqual([]);
  });

  it('flags an unknown operation type', () => {
    const errors = validateTransformConfig({
      operations: [{ type: 'mystery_op' }],
    });
    expect(errors[0]).toMatch(/operations\[0\]\.type must be one of:/);
  });

  it('flags missing rename_field.from / .to', () => {
    const errors = validateTransformConfig({
      operations: [{ type: 'rename_field' }],
    });
    expect(errors).toContain('operations[0].from is required');
    expect(errors).toContain('operations[0].to is required');
  });

  it('flags missing field on remove_field / set_field', () => {
    expect(
      validateTransformConfig({ operations: [{ type: 'remove_field' }] }),
    ).toContain('operations[0].field is required');
    expect(
      validateTransformConfig({ operations: [{ type: 'set_field' }] }),
    ).toContain('operations[0].field is required');
  });

  it('flags invalid type_convert.targetType', () => {
    const errors = validateTransformConfig({
      operations: [{ type: 'type_convert', field: 'x', targetType: 'date' }],
    });
    expect(errors).toContain('operations[0].targetType is invalid');
  });

  it('flags invalid string_op.operation', () => {
    const errors = validateTransformConfig({
      operations: [{ type: 'string_op', field: 'x', operation: 'reverse' }],
    });
    expect(errors).toContain('operations[0].operation is invalid');
  });

  it('flags invalid math_op.operation', () => {
    const errors = validateTransformConfig({
      operations: [{ type: 'math_op', field: 'x', operation: 'cube' }],
    });
    expect(errors).toContain('operations[0].operation is invalid');
  });

  it('flags invalid date_op.operation', () => {
    const errors = validateTransformConfig({
      operations: [{ type: 'date_op', field: 'x', operation: 'rotate' }],
    });
    expect(errors).toContain('operations[0].operation is invalid');
  });

  it('flags invalid array_filter.condition', () => {
    const errors = validateTransformConfig({
      operations: [
        {
          type: 'array_filter',
          field: 'items',
          condition: { field: '', operator: 'unknown' },
        },
      ],
    });
    expect(errors).toContain('operations[0].condition is invalid');
  });

  it('flags array_sort with missing or invalid order', () => {
    const errors = validateTransformConfig({
      operations: [{ type: 'array_sort', field: 'x', order: 'random' }],
    });
    expect(errors).toContain('operations[0].order must be "asc" or "desc"');
  });

  it('flags object_pick / object_omit with empty keys', () => {
    expect(
      validateTransformConfig({
        operations: [{ type: 'object_pick', keys: [] }],
      }),
    ).toContain('operations[0].keys must be a non-empty array');
    expect(
      validateTransformConfig({
        operations: [{ type: 'object_omit', keys: [] }],
      }),
    ).toContain('operations[0].keys must be a non-empty array');
  });
});

describe('evaluateMetadataBlockingErrors integration (transform)', () => {
  it('emits the Korean warning when no operations are defined', () => {
    expect(evaluateMetadataBlockingErrors(transformNodeMetadata, {})).toContain(
      'At least one transform operation must be added.',
    );
  });

  it('returns [] for a single valid rename_field operation', () => {
    expect(
      evaluateMetadataBlockingErrors(transformNodeMetadata, {
        operations: [{ type: 'rename_field', from: 'a', to: 'b' }],
      }),
    ).toEqual([]);
  });

  it('combines warningRules + validateConfig errors', () => {
    const errors = evaluateMetadataBlockingErrors(transformNodeMetadata, {
      operations: [{ type: 'rename_field' }],
    });
    expect(errors).toContain('operations[0].from is required');
    expect(errors).toContain('operations[0].to is required');
  });
});
