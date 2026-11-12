import { evaluateWarnings } from '@workflow/node-summary';
import { mergeNodeConfigSchema, mergeNodeMetadata } from './merge.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('mergeNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      mergeNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('merge:no-strategy', () => {
    it('fires when strategy is missing', () => {
      expect(firedIds({})).toContain('merge:no-strategy');
    });

    it('fires when strategy is empty string', () => {
      expect(firedIds({ strategy: '' })).toContain('merge:no-strategy');
    });

    it('does NOT fire when strategy is set', () => {
      expect(firedIds({ strategy: 'wait_all' })).not.toContain(
        'merge:no-strategy',
      );
    });
  });

  // W-8: dormant 필드가 설정되면 캔버스 배지로 노출.
  describe('merge:timeout-dormant', () => {
    it('fires when timeout > 0', () => {
      expect(firedIds({ strategy: 'wait_all', timeout: 60 })).toContain(
        'merge:timeout-dormant',
      );
    });

    it('does NOT fire when timeout=0', () => {
      expect(firedIds({ strategy: 'wait_all', timeout: 0 })).not.toContain(
        'merge:timeout-dormant',
      );
    });
  });

  describe('merge:partial-on-timeout-dormant', () => {
    it('fires when partialOnTimeout=true', () => {
      expect(
        firedIds({ strategy: 'wait_all', partialOnTimeout: true }),
      ).toContain('merge:partial-on-timeout-dormant');
    });

    it('does NOT fire when partialOnTimeout=false', () => {
      expect(
        firedIds({ strategy: 'wait_all', partialOnTimeout: false }),
      ).not.toContain('merge:partial-on-timeout-dormant');
    });
  });
});

// REQ-MERGE-018 — `first` · `append` 는 이름과 실제 동작이 달라 advisory 경고를
// 띄운다. advisory 라서 실행 전 검증(handler.validate)은 막지 않는다.
describe('merge strategy advisory rules (REQ-MERGE-018)', () => {
  const fired = (config: Record<string, unknown>) =>
    evaluateWarnings(config, mergeNodeMetadata.warningRules);
  const rule = (id: string) =>
    mergeNodeMetadata.warningRules?.find((r) => r.id === id);

  it.each([
    ['first', 'merge:strategy-first-not-arrival-order'],
    ['append', 'merge:strategy-append-same-as-wait-all'],
  ])('strategy=%s fires %s as advisory', (strategy, id) => {
    const warnings = fired({ strategy }).filter((w) => w.id === id);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('advisory');
    expect(rule(id)?.severity).toBe('advisory');
  });

  it('fires no strategy advisory for wait_all', () => {
    expect(fired({ strategy: 'wait_all' })).toEqual([]);
  });

  it('fires no strategy advisory when strategy is missing', () => {
    const ids = fired({}).map((w) => w.id);
    expect(ids).toEqual(['merge:no-strategy']);
  });

  it.each(['first', 'append'])(
    'strategy=%s does not block handler.validate',
    (strategy) => {
      expect(
        evaluateMetadataBlockingErrors(mergeNodeMetadata, { strategy }),
      ).toEqual([]);
    },
  );

  it('uses the English messages from CLE-NODE-MERGE', () => {
    expect(rule('merge:strategy-first-not-arrival-order')?.message).toBe(
      "Merge strategy 'first' does not pick the first input to arrive. It keeps the input from the connected node whose ID sorts first, which can change when nodes are copied.",
    );
    expect(rule('merge:strategy-append-same-as-wait-all')?.message).toBe(
      "Merge strategy 'append' works the same as 'wait_all': it keeps every input.",
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (merge)', () => {
  it('emits the warning when strategy is missing', () => {
    expect(evaluateMetadataBlockingErrors(mergeNodeMetadata, {})).toEqual([
      'Merge strategy must be selected.',
    ]);
  });

  it('returns [] when strategy is set', () => {
    expect(
      evaluateMetadataBlockingErrors(mergeNodeMetadata, {
        strategy: 'wait_all',
      }),
    ).toEqual([]);
  });

  // CLE-T-AGDM92: 기본값이 dormant 경고를 켜면 새 Merge 노드가 실행 전 검증에서 막힌다.
  it('returns [] for the schema default config', () => {
    expect(
      evaluateMetadataBlockingErrors(
        mergeNodeMetadata,
        mergeNodeConfigSchema.parse({}),
      ),
    ).toEqual([]);
  });
});

describe('mergeNodeConfigSchema.timeout', () => {
  it('defaults to 0 (no timeout)', () => {
    expect(mergeNodeConfigSchema.parse({}).timeout).toBe(0);
  });

  it('rejects a negative timeout', () => {
    expect(mergeNodeConfigSchema.safeParse({ timeout: -1 }).success).toBe(
      false,
    );
  });

  it('accepts 0', () => {
    expect(mergeNodeConfigSchema.safeParse({ timeout: 0 }).success).toBe(true);
  });
});

// fan-in barrier 를 무기한 미뤘으므로(CLE-NODE-MERGE Rationale, 2026-07-17)
// 경고 문구가 나중 단계에서 값이 반영된다고 안내하지 않는다.
describe('merge dormant warning messages', () => {
  const message = (id: string) =>
    mergeNodeMetadata.warningRules?.find((r) => r.id === id)?.message ?? '';

  it.each(['merge:timeout-dormant', 'merge:partial-on-timeout-dormant'])(
    '%s does not promise a future phase',
    (id) => {
      expect(message(id)).not.toBe('');
      expect(message(id)).not.toMatch(/Phase P\d|will honor|takes effect/i);
    },
  );
});

// 설정 패널의 hint 도 경고와 같은 사실을 안내한다. 기다리거나 일부만 병합하는
// 동작이 있는 것처럼 읽히면 캔버스 경고와 어긋난다.
describe('merge dormant field hints', () => {
  const hint = (field: 'timeout' | 'partialOnTimeout') =>
    (
      mergeNodeConfigSchema.shape[field].meta() as
        { ui?: { hint?: string } } | undefined
    )?.ui?.hint ?? '';

  it.each(['timeout', 'partialOnTimeout'] as const)(
    '%s hint says the field has no effect',
    (field) => {
      expect(hint(field)).toMatch(/no effect/i);
      expect(hint(field)).not.toMatch(
        /wait indefinitely|when timeout elapses/i,
      );
    },
  );
});
