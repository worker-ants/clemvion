import { evaluateWarnings } from '@workflow/node-summary';
import {
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
  it('emits the Korean warning when template body is empty', () => {
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
