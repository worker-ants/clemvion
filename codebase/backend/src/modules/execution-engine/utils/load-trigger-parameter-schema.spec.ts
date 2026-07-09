import { loadTriggerParameterSchema } from './load-trigger-parameter-schema';
import { resolveTriggerParameters } from './resolve-trigger-parameters';
import { NODE_TYPES } from '../../../nodes/core/node-types.constants';

const region = {
  name: 'region',
  type: 'string' as const,
  required: false,
  description: '',
  defaultValue: '인천',
};

describe('loadTriggerParameterSchema', () => {
  it('looks the node up by type=manual_trigger (not category)', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ config: { parameters: [region] } });
    await loadTriggerParameterSchema({ findOne } as any, 'wf');
    expect(findOne).toHaveBeenCalledWith({
      where: { workflowId: 'wf', type: NODE_TYPES.MANUAL_TRIGGER },
    });
  });

  it('resolves a category-missing manual trigger that a category lookup would miss', async () => {
    // Real data has manual_trigger nodes whose `category` column is absent —
    // the whole point of the type-based lookup. The valid `region` param must
    // still be found and its default applied (regression for the silent {} bug).
    const findOne = jest.fn().mockResolvedValue({
      category: undefined,
      type: 'manual_trigger',
      config: { parameters: [region] },
    });
    const schema = await loadTriggerParameterSchema({ findOne } as any, 'wf');
    expect(schema).toEqual([region]);
    expect(resolveTriggerParameters(schema, {})).toEqual({ region: '인천' });
  });

  it('returns undefined when no manual trigger node exists', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    expect(
      await loadTriggerParameterSchema({ findOne } as any, 'wf'),
    ).toBeUndefined();
  });

  it('returns undefined when the trigger has no parameters key', async () => {
    const findOne = jest.fn().mockResolvedValue({ config: { notes: '' } });
    expect(
      await loadTriggerParameterSchema({ findOne } as any, 'wf'),
    ).toBeUndefined();
  });

  it('returns the schema when every parameter is well-formed', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ config: { parameters: [region] } });
    expect(await loadTriggerParameterSchema({ findOne } as any, 'wf')).toEqual([
      region,
    ]);
  });

  it('discards a structurally invalid schema with a warning', async () => {
    const findOne = jest.fn().mockResolvedValue({
      config: { parameters: [region, { name: '', type: 'string' }] },
    });
    const warn = jest.fn();
    expect(
      await loadTriggerParameterSchema({ findOne } as any, 'wf', { warn }),
    ).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
