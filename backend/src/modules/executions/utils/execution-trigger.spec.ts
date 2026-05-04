import {
  deriveExecutionTrigger,
  ExecutionTriggerSource,
} from './execution-trigger';

type MakeArgs = {
  triggerId?: string | null;
  executedBy?: string | null;
  parentExecutionId?: string | null;
  trigger?: { type: string; name: string } | null;
  executor?: { name?: string | null; email?: string | null } | null;
};

const makeExec = (a: MakeArgs = {}) => ({
  triggerId: a.triggerId ?? null,
  executedBy: a.executedBy ?? null,
  parentExecutionId: a.parentExecutionId ?? null,
  trigger: a.trigger ?? null,
  executor: a.executor ?? null,
});

describe('deriveExecutionTrigger', () => {
  it('returns unknown when nothing is set', () => {
    expect(deriveExecutionTrigger(makeExec())).toEqual({
      source: 'unknown',
      label: null,
    });
  });

  describe('subworkflow', () => {
    it('classifies execution with parentExecutionId as subworkflow', () => {
      const result = deriveExecutionTrigger(
        makeExec({ parentExecutionId: 'parent-1' }),
        'Parent Workflow',
      );
      expect(result).toEqual({
        source: 'subworkflow',
        label: 'Parent Workflow',
      });
    });

    it('null label when parent workflow name is unavailable', () => {
      const result = deriveExecutionTrigger(
        makeExec({ parentExecutionId: 'parent-1' }),
      );
      expect(result.source).toBe('subworkflow');
      expect(result.label).toBeNull();
    });

    it('subworkflow takes priority over manual/trigger fields', () => {
      const result = deriveExecutionTrigger(
        makeExec({
          parentExecutionId: 'parent-1',
          executedBy: 'user-1',
          executor: { name: 'Alice' },
          triggerId: 'trig-1',
          trigger: { type: 'schedule', name: 'Daily' },
        }),
        'Parent',
      );
      expect(result.source).toBe('subworkflow');
      expect(result.label).toBe('Parent');
    });
  });

  describe('manual', () => {
    it('uses executor.name as label', () => {
      const result = deriveExecutionTrigger(
        makeExec({
          executedBy: 'user-1',
          executor: { name: 'Alice', email: 'a@x.com' },
        }),
      );
      expect(result).toEqual({ source: 'manual', label: 'Alice' });
    });

    it('falls back to executor.email when name is missing', () => {
      const result = deriveExecutionTrigger(
        makeExec({
          executedBy: 'user-1',
          executor: { name: null, email: 'a@x.com' },
        }),
      );
      expect(result).toEqual({ source: 'manual', label: 'a@x.com' });
    });

    it('null label when executor relation is not loaded', () => {
      const result = deriveExecutionTrigger(
        makeExec({ executedBy: 'user-1', executor: null }),
      );
      expect(result).toEqual({ source: 'manual', label: null });
    });

    it('manual takes priority over schedule/webhook', () => {
      const result = deriveExecutionTrigger(
        makeExec({
          executedBy: 'user-1',
          executor: { name: 'Alice' },
          triggerId: 'trig-1',
          trigger: { type: 'schedule', name: 'Daily' },
        }),
      );
      expect(result.source).toBe('manual');
      expect(result.label).toBe('Alice');
    });
  });

  describe('schedule / webhook', () => {
    it('classifies trigger.type=schedule as schedule with trigger.name label', () => {
      const result = deriveExecutionTrigger(
        makeExec({
          triggerId: 'trig-1',
          trigger: { type: 'schedule', name: '매일 9시 보고서' },
        }),
      );
      expect(result).toEqual({
        source: 'schedule',
        label: '매일 9시 보고서',
      });
    });

    it('classifies trigger.type=webhook as webhook with trigger.name label', () => {
      const result = deriveExecutionTrigger(
        makeExec({
          triggerId: 'trig-2',
          trigger: { type: 'webhook', name: 'Stripe payment hook' },
        }),
      );
      expect(result).toEqual({
        source: 'webhook',
        label: 'Stripe payment hook',
      });
    });

    it('falls back to unknown when triggerId set but trigger relation missing', () => {
      const result = deriveExecutionTrigger(
        makeExec({ triggerId: 'trig-1', trigger: null }),
      );
      expect(result).toEqual({ source: 'unknown', label: null });
    });

    it('falls back to unknown for unrecognized trigger.type', () => {
      const result = deriveExecutionTrigger(
        makeExec({
          triggerId: 'trig-1',
          // future/unknown trigger type
          trigger: { type: 'mystery', name: 'ignored' },
        }),
      );
      expect(result.source).toBe<ExecutionTriggerSource>('unknown');
      expect(result.label).toBeNull();
    });
  });
});
