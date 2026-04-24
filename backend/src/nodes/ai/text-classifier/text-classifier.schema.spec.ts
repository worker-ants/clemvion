import {
  textClassifierNodeConfigSchema,
  textClassifierNodeOutputSchema,
} from './text-classifier.schema';

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
