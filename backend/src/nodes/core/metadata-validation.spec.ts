import {
  evaluateMetadataBlockingErrors,
  evaluateMetadataValidation,
} from './metadata-validation';
import type { NodeComponentMetadata } from './node-component.interface';

const baseMetadata: Pick<NodeComponentMetadata, 'type'> = { type: 'demo' };

describe('evaluateMetadataValidation', () => {
  it('returns empty when neither warningRules nor validateConfig is defined', () => {
    expect(evaluateMetadataValidation(baseMetadata, { x: 1 })).toEqual([]);
  });

  it('fires declarative warningRules in order', () => {
    const metadata = {
      ...baseMetadata,
      warningRules: [
        {
          id: 'demo:missing-name',
          when: '!name',
          message: 'name required',
        },
        {
          id: 'demo:items-too-many',
          when: 'length(items) > 3',
          message: 'too many items',
        },
      ],
    } as Pick<
      NodeComponentMetadata,
      'warningRules' | 'validateConfig' | 'type'
    >;

    const result = evaluateMetadataValidation(metadata, {
      items: [1, 2, 3, 4],
    });
    expect(result.map((r) => r.id)).toEqual([
      'demo:missing-name',
      'demo:items-too-many',
    ]);
    expect(result.every((r) => r.severity === 'blocking')).toBe(true);
  });

  it('respects explicit advisory severity', () => {
    const metadata = {
      ...baseMetadata,
      warningRules: [
        {
          id: 'demo:hint',
          when: '!description',
          message: 'consider adding a description',
          severity: 'advisory' as const,
        },
      ],
    };
    expect(evaluateMetadataValidation(metadata, {})[0]).toMatchObject({
      severity: 'advisory',
    });
  });

  it('appends imperative validateConfig output as blocking', () => {
    const metadata = {
      ...baseMetadata,
      validateConfig: (config: unknown) => {
        const c = config as { foo?: number };
        return c.foo === undefined ? ['foo missing'] : [];
      },
    };
    const result = evaluateMetadataValidation(metadata, {});
    expect(result).toEqual([
      { id: 'demo:imperative-0', message: 'foo missing', severity: 'blocking' },
    ]);
  });

  it('runs warningRules first, then validateConfig', () => {
    const metadata = {
      ...baseMetadata,
      warningRules: [
        { id: 'demo:declared', when: '!a', message: 'declared error' },
      ],
      validateConfig: () => ['imperative error'],
    };
    expect(
      evaluateMetadataValidation(metadata, {}).map((r) => r.message),
    ).toEqual(['declared error', 'imperative error']);
  });
});

describe('evaluateMetadataBlockingErrors', () => {
  it('returns flat string[] of blocking messages only', () => {
    const metadata = {
      ...baseMetadata,
      warningRules: [
        { id: 'demo:hard', when: '!a', message: 'hard error' },
        {
          id: 'demo:soft',
          when: '!b',
          message: 'soft hint',
          severity: 'advisory' as const,
        },
      ],
      validateConfig: () => ['imperative error'],
    };
    expect(evaluateMetadataBlockingErrors(metadata, {})).toEqual([
      'hard error',
      'imperative error',
    ]);
  });
});
