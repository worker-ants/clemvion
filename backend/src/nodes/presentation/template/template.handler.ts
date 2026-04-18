import {
  NodeHandler,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import {
  ButtonDef,
  validateButtons,
} from '../_shared/button.types.js';

export class TemplateHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.template || typeof config.template !== 'string') {
      errors.push('template is required and must be a string');
    }

    if (
      config.outputFormat !== undefined &&
      !['html', 'markdown', 'text'].includes(config.outputFormat as string)
    ) {
      errors.push('outputFormat must be one of: html, markdown, text');
    }

    errors.push(...validateButtons(config));

    return { valid: errors.length === 0, errors };
  }

  execute(...[, config]: Parameters<NodeHandler['execute']>): Promise<unknown> {
    const content = config.template as string;
    const outputFormat = (config.outputFormat as string) ?? 'text';

    // config.template is already resolved by the expression engine
    const payload = { type: 'template', format: outputFormat, content };
    const configEcho: Record<string, unknown> = { outputFormat };

    const buttons = config.buttons as ButtonDef[] | undefined;
    if (Array.isArray(buttons) && buttons.length > 0) {
      return Promise.resolve({
        config: {
          ...configEcho,
          buttonConfig: {
            buttons,
          },
        },
        output: payload,
        status: 'waiting_for_input',
        meta: { interactionType: 'buttons' },
      });
    }

    return Promise.resolve({ config: configEcho, output: payload });
  }
}
