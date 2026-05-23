import { z } from 'zod';
import { evaluateWarnings } from '@workflow/node-summary';
import {
  templateNodeConfigSchema,
  templateNodeMetadata,
  validateTemplateConfig,
} from './template.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('templateNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      templateNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('template:no-template', () => {
    it('fires when template is missing', () => {
      expect(firedIds({})).toContain('template:no-template');
    });

    it('fires when template is empty string', () => {
      expect(firedIds({ template: '' })).toContain('template:no-template');
    });

    it('does NOT fire when template body is set', () => {
      expect(firedIds({ template: 'Hello {{name}}' })).not.toContain(
        'template:no-template',
      );
    });
  });
});

describe('validateTemplateConfig (imperative)', () => {
  it('returns [] when no buttons configured', () => {
    expect(
      validateTemplateConfig({ template: 'hi', outputFormat: 'html' }),
    ).toEqual([]);
  });

  it('forwards global buttons errors via shared validateButtons', () => {
    const errors = validateTemplateConfig({
      template: 'hi',
      buttons: [{ id: '', label: '', type: 'port' }],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'buttons[0].id is required',
        'buttons[0].label is required and must be a string',
      ]),
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (template)', () => {
  it('emits the warning when template body is empty', () => {
    expect(evaluateMetadataBlockingErrors(templateNodeMetadata, {})).toContain(
      'Template body must be entered.',
    );
  });

  it('returns [] when template is set and no buttons configured', () => {
    expect(
      evaluateMetadataBlockingErrors(templateNodeMetadata, {
        template: 'Hello',
      }),
    ).toEqual([]);
  });
});

describe('buttonDefSchema — userMessage (spec/4-nodes/6-presentation/0-common.md §1, §10.8)', () => {
  it('preserves userMessage on global buttons and exposes it in JSON Schema', () => {
    const result = templateNodeConfigSchema.parse({
      template: 'Hello {{ name }}',
      buttons: [
        {
          id: 'a',
          label: 'Reply',
          type: 'port',
          userMessage: 'Yes, hello',
        },
      ],
    });
    expect(result.buttons[0].userMessage).toBe('Yes, hello');

    const jsonSchema = z.toJSONSchema(templateNodeConfigSchema) as unknown as {
      properties?: {
        buttons?: { items?: { properties?: Record<string, { type?: string }> } };
      };
    };
    expect(
      jsonSchema.properties?.buttons?.items?.properties?.userMessage,
    ).toBeDefined();
  });
});
