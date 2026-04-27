import {
  NodeHandler,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { ButtonDef } from '../_shared/button.types.js';
import { templateNodeMetadata } from './template.schema.js';

export class TemplateHandler implements NodeHandler {
  metadata = templateNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig delegating to validateButtons)
    // owns the empty-template + global buttons rules. The two remaining
    // type guards below stay handler-side because zod typically narrows them
    // before reaching us — they fire only for direct programmatic callers
    // bypassing zod parsing (legacy fixtures, unit tests).
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];

    if (config.template !== undefined && typeof config.template !== 'string') {
      errors.push('template must be a string');
    }
    if (
      config.outputFormat !== undefined &&
      !['html', 'markdown', 'text'].includes(config.outputFormat as string)
    ) {
      errors.push('outputFormat must be one of: html, markdown, text');
    }

    return { valid: errors.length === 0, errors };
  }

  execute(...[, config]: Parameters<NodeHandler['execute']>): Promise<unknown> {
    const content = typeof config.template === 'string' ? config.template : '';
    const outputFormat = (config.outputFormat as string) ?? 'text';

    // `content` is the template string after the expression engine has
    // resolved it — that's the runtime value. `outputFormat` and the raw
    // template source stay in `config` only (Principle 1.1). Discriminator
    // `type: 'template'` removed (Principle 1.1.4).
    const payload: Record<string, unknown> = { rendered: content };
    const configEcho: Record<string, unknown> = {
      outputFormat,
      template: content,
    };

    const buttons = config.buttons as ButtonDef[] | undefined;
    if (Array.isArray(buttons) && buttons.length > 0) {
      return Promise.resolve({
        config: {
          ...configEcho,
          buttons,
          buttonConfig: {
            buttons,
          },
        },
        output: payload,
        status: 'waiting_for_input',
        meta: { interactionType: 'buttons', durationMs: 0 },
      });
    }

    return Promise.resolve({ config: configEcho, output: payload });
  }
}
