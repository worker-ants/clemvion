import { evaluateWarnings } from '@workflow/node-summary';
import {
  textClassifierNodeConfigSchema,
  textClassifierNodeMetadata,
  textClassifierNodeOutputSchema,
  validateTextClassifierConfig,
} from './text-classifier.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('textClassifierNodeConfigSchema', () => {
  it('defaults includeEvidence to false', () => {
    const result = textClassifierNodeConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeEvidence).toBe(false);
    }
  });

  it('accepts includeEvidence: true', () => {
    const result = textClassifierNodeConfigSchema.safeParse({
      includeEvidence: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeEvidence).toBe(true);
    }
  });
});

describe('textClassifierNodeOutputSchema', () => {
  // Autocomplete-hint schema. Real handler returns must parse; extra keys pass through.
  it('accepts single-label result', () => {
    const fixture = {
      category: 'support',
      confidence: 0.92,
      originalInput: 'I need help',
    };
    const result = textClassifierNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts null category (fallback case)', () => {
    const fixture = {
      category: null,
      originalInput: 'unclassifiable text',
    };
    const result = textClassifierNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts multi-label result', () => {
    const fixture = {
      categories: [{ name: 'support', confidence: 0.9 }, { name: 'billing' }],
      originalInput: 'I have a billing question',
    };
    const result = textClassifierNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts error output', () => {
    const fixture = {
      error: 'LLM request failed',
      originalInput: 'test',
    };
    const result = textClassifierNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('rejects categories array item missing name', () => {
    const fixture = {
      categories: [{ confidence: 0.9 }],
      originalInput: 'x',
    };
    const result = textClassifierNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(false);
  });

  it('accepts single-label result with evidence', () => {
    const fixture = {
      category: 'Positive',
      confidence: 0.99,
      evidence: ['happy'],
      originalInput: 'I am so happy today!',
    };
    const result = textClassifierNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts multi-label result with per-item evidence', () => {
    const fixture = {
      categories: [
        { name: 'Billing', confidence: 0.9, evidence: ['refund'] },
        { name: 'Tech', confidence: 0.85, evidence: ['crashing', 'app'] },
      ],
      originalInput: 'I need a refund and the app is crashing',
    };
    const result = textClassifierNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });
});

describe('textClassifierNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      textClassifierNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('text_classifier:no-llm-provider', () => {
    it('fires when both model and llmConfigId are missing', () => {
      expect(firedIds({})).toContain('text_classifier:no-llm-provider');
    });

    it('does NOT fire when llmConfigId is set', () => {
      expect(firedIds({ llmConfigId: 'cfg-1' })).not.toContain(
        'text_classifier:no-llm-provider',
      );
    });
  });

  describe('text_classifier:no-categories', () => {
    it('fires when categories is missing', () => {
      expect(firedIds({})).toContain('text_classifier:no-categories');
    });

    it('fires when categories is empty array', () => {
      expect(firedIds({ categories: [] })).toContain(
        'text_classifier:no-categories',
      );
    });

    it('does NOT fire when at least one category is defined', () => {
      expect(firedIds({ categories: [{ name: 'a' }] })).not.toContain(
        'text_classifier:no-categories',
      );
    });
  });

  describe('text_classifier:no-input-field', () => {
    it('fires when inputField is missing', () => {
      expect(firedIds({})).toContain('text_classifier:no-input-field');
    });

    it('does NOT fire when inputField is set', () => {
      expect(firedIds({ inputField: '$input.text' })).not.toContain(
        'text_classifier:no-input-field',
      );
    });
  });
});

describe('validateTextClassifierConfig (imperative)', () => {
  it('returns [] for a fully valid config', () => {
    expect(
      validateTextClassifierConfig({
        categories: [{ name: 'support' }, { name: 'billing' }],
      }),
    ).toEqual([]);
  });

  it('rejects category missing name', () => {
    expect(
      validateTextClassifierConfig({ categories: [{ description: 'x' }] }),
    ).toContain('Category 1: name is required');
  });

  it('rejects category using the reserved __none__ sentinel', () => {
    expect(
      validateTextClassifierConfig({ categories: [{ name: '__none__' }] }),
    ).toContain('Category 1: "__none__" is a reserved name');
  });
});

describe('evaluateMetadataBlockingErrors integration (text_classifier)', () => {
  it('emits multiple Korean warnings on a freshly-created node', () => {
    const errors = evaluateMetadataBlockingErrors(
      textClassifierNodeMetadata,
      {},
    );
    expect(errors.some((e) => e.includes('LLM provider'))).toBe(true);
    expect(errors).toContain('하나 이상의 카테고리를 추가해야 합니다.');
    expect(errors).toContain('Input Field 를 입력해야 합니다.');
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(textClassifierNodeMetadata, {
        model: 'gpt-4o',
        categories: [{ name: 'support' }],
        inputField: '$input.text',
      }),
    ).toEqual([]);
  });
});
