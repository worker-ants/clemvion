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

// ADR R-wontdo-async-fanin 으로 fan-in barrier 를 만들지 않기로 했으므로
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
