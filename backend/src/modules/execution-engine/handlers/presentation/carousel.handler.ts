import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';
import { ButtonDef, validateButtons } from '../../types/button.types.js';

function toStr(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }
  return JSON.stringify(value);
}

function sanitizeUrl(url: string): string {
  if (/^javascript:/i.test(url.trim())) return '';
  return url;
}

export class CarouselHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const mode = (config.mode as string) ?? 'dynamic';

    if (mode === 'static') {
      if (
        !config.items ||
        !Array.isArray(config.items) ||
        config.items.length === 0
      ) {
        errors.push(
          'items is required and must be a non-empty array in static mode',
        );
      } else {
        for (let i = 0; i < (config.items as unknown[]).length; i++) {
          const item = (config.items as Record<string, unknown>[])[i];
          if (!item.title || typeof item.title !== 'string') {
            errors.push(`items[${i}].title is required and must be a string`);
          }
        }
      }
    } else if (mode === 'dynamic') {
      if (!config.titleField || typeof config.titleField !== 'string') {
        errors.push('titleField is required and must be a string');
      }
    } else {
      errors.push('mode must be either "static" or "dynamic"');
    }

    errors.push(...validateButtons(config));

    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ExecutionContext,
  ): Promise<unknown> {
    const mode = (config.mode as string) ?? 'dynamic';
    const layout = (config.layout as string) ?? 'card';

    let items: Array<{ title: string; description: string; image?: string }>;

    if (mode === 'static') {
      const configItems = Array.isArray(config.items)
        ? (config.items as Array<{
            title: string;
            description: string;
            image?: string;
          }>)
        : [];
      items = configItems.map((item) => ({
        title: String(item.title ?? ''),
        description: String(item.description ?? ''),
        image: item.image
          ? sanitizeUrl(String(item.image)) || undefined
          : undefined,
      }));
    } else {
      const titleField = config.titleField as string;
      const descriptionField = config.descriptionField as string | undefined;
      const imageField = config.imageField as string | undefined;
      const maxItems = config.maxItems as number | undefined;

      const inputArray = Array.isArray(input)
        ? input
        : input != null
          ? [input]
          : [];
      const limitedArray = maxItems
        ? inputArray.slice(0, maxItems)
        : inputArray;

      items = limitedArray.map((item: Record<string, unknown>) => ({
        title: toStr(item[titleField]),
        description: descriptionField ? toStr(item[descriptionField]) : '',
        image: imageField
          ? sanitizeUrl(toStr(item[imageField])) || undefined
          : undefined,
      }));
    }

    const rendered = this.renderHtml(items, layout);

    const buttons = config.buttons as ButtonDef[] | undefined;
    if (Array.isArray(buttons) && buttons.length > 0) {
      return Promise.resolve({
        type: 'carousel',
        items,
        layout,
        rendered,
        status: 'waiting_for_input',
        interactionType: 'buttons',
        buttonConfig: {
          buttons,
          buttonTimeout: config.buttonTimeout,
          buttonTimeoutAction: config.buttonTimeoutAction ?? 'continue',
        },
      });
    }

    return Promise.resolve({ type: 'carousel', items, layout, rendered });
  }

  private renderHtml(
    items: Array<{ title: string; description: string; image?: string }>,
    layout: string,
  ): string {
    const itemsHtml = items
      .map(
        (item) =>
          `<div class="carousel-item">` +
          (item.image
            ? `<img src="${this.escapeHtml(item.image)}" alt="${this.escapeHtml(item.title)}" />`
            : '') +
          `<h3>${this.escapeHtml(item.title)}</h3>` +
          `<p>${this.escapeHtml(item.description)}</p>` +
          `</div>`,
      )
      .join('');

    return `<div class="carousel carousel-${this.escapeHtml(layout)}">${itemsHtml}</div>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (ch) => map[ch]);
  }
}
