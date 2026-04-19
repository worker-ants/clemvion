import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { ButtonDef, validateButtons } from '../_shared/button.types.js';

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

function validateItemButtons(buttons: unknown[], prefix: string): string[] {
  const errors: string[] = [];
  if (buttons.length > 4) {
    errors.push(`${prefix}: maximum 4 buttons per item`);
  }
  const ids = new Set<string>();
  for (let j = 0; j < buttons.length; j++) {
    const btn = buttons[j] as Record<string, unknown>;
    if (!btn.id || typeof btn.id !== 'string') {
      errors.push(`${prefix}.buttons[${j}].id is required`);
    } else if (btn.id.includes('__item_')) {
      errors.push(
        `${prefix}.buttons[${j}].id must not contain reserved separator "__item_"`,
      );
    } else if (ids.has(btn.id)) {
      errors.push(
        `${prefix}.buttons[${j}].id must be unique (duplicate: ${btn.id})`,
      );
    } else {
      ids.add(btn.id);
    }
    if (!btn.label || typeof btn.label !== 'string') {
      errors.push(`${prefix}.buttons[${j}].label is required`);
    }
    if (!btn.type || !['link', 'port'].includes(btn.type as string)) {
      errors.push(`${prefix}.buttons[${j}].type must be "link" or "port"`);
    }
    if (btn.type === 'link' && (!btn.url || typeof btn.url !== 'string')) {
      errors.push(
        `${prefix}.buttons[${j}].url is required for link type buttons`,
      );
    } else if (btn.type === 'link' && btn.url && typeof btn.url === 'string') {
      const trimmedUrl = btn.url.trim().toLowerCase();
      if (/^(javascript|data|vbscript):/i.test(trimmedUrl)) {
        errors.push(
          `${prefix}.buttons[${j}].url contains a disallowed URL scheme`,
        );
      }
    }
    if (btn.type === 'port' && btn.url) {
      errors.push(
        `${prefix}.buttons[${j}].url is not allowed for port type buttons`,
      );
    }
  }
  return errors;
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
          // Validate item-level buttons
          if (item.buttons && Array.isArray(item.buttons)) {
            errors.push(
              ...validateItemButtons(item.buttons as unknown[], `items[${i}]`),
            );
          }
        }
      }
    } else if (mode === 'dynamic') {
      if (!config.titleField || typeof config.titleField !== 'string') {
        errors.push('titleField is required and must be a string');
      }
      // Validate shared item buttons for dynamic mode
      if (config.itemButtons && Array.isArray(config.itemButtons)) {
        errors.push(
          ...validateItemButtons(
            config.itemButtons as unknown[],
            'itemButtons',
          ),
        );
      }
    } else {
      errors.push('mode must be either "static" or "dynamic"');
    }

    // Validate global buttons
    errors.push(...validateButtons(config));

    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,

    _context: ExecutionContext,
  ): Promise<unknown> {
    const mode = (config.mode as string) ?? 'dynamic';
    const layout = (config.layout as string) ?? 'card';

    let items: Array<{
      title: string;
      description: string;
      image?: string;
      buttons?: ButtonDef[];
    }>;

    if (mode === 'static') {
      const configItems = Array.isArray(config.items)
        ? (config.items as Array<{
            title: string;
            description: string;
            image?: string;
            buttons?: ButtonDef[];
          }>)
        : [];
      items = configItems.map((item) => ({
        title: String(item.title ?? ''),
        description: String(item.description ?? ''),
        image: item.image
          ? sanitizeUrl(String(item.image)) || undefined
          : undefined,
        buttons:
          Array.isArray(item.buttons) && item.buttons.length > 0
            ? item.buttons
            : undefined,
      }));
    } else {
      const titleField = config.titleField as string;
      const descriptionField = config.descriptionField as string | undefined;
      const imageField = config.imageField as string | undefined;
      const itemButtons = Array.isArray(config.itemButtons)
        ? (config.itemButtons as ButtonDef[])
        : undefined;
      const maxItems = config.maxItems as number | undefined;

      // source is resolved by the expression engine before reaching the handler
      const sourceData = config.source;
      const inputArray = Array.isArray(sourceData)
        ? sourceData
        : Array.isArray(input)
          ? input
          : input != null
            ? [input]
            : [];
      const limitedArray = maxItems
        ? inputArray.slice(0, maxItems)
        : inputArray;

      items = limitedArray.map(
        (item: Record<string, unknown>, itemIdx: number) => {
          const result: {
            title: string;
            description: string;
            image?: string;
            buttons?: ButtonDef[];
          } = {
            title: toStr(item[titleField]),
            description: descriptionField ? toStr(item[descriptionField]) : '',
            image: imageField
              ? sanitizeUrl(toStr(item[imageField])) || undefined
              : undefined,
          };
          if (itemButtons && itemButtons.length > 0) {
            // Apply same buttons to all dynamic items, with unique IDs per item
            result.buttons = itemButtons.map((btn) => ({
              ...btn,
              id: `${btn.id}__item_${itemIdx}`,
            }));
          }
          return result;
        },
      );
    }

    const rendered = this.renderHtml(items, layout);

    // Collect all buttons: global + per-item
    const globalButtons = (config.buttons as ButtonDef[] | undefined) ?? [];
    const allButtons: ButtonDef[] = [...globalButtons];
    const buttonItemMap: Record<string, number> = {};

    for (let i = 0; i < items.length; i++) {
      if (items[i].buttons) {
        for (const btn of items[i].buttons!) {
          buttonItemMap[btn.id] = i;
          allButtons.push(btn);
        }
      }
    }

    // Runtime-only fields go into `output`; literal config (layout, mode,
    // static items definition) is echoed in `config` only (Principle 1.1).
    // The `type: 'carousel'` discriminator is dropped per Principle 1.1.4.
    const payload: Record<string, unknown> = { items, rendered };
    const configEcho: Record<string, unknown> = { layout, mode };
    if (Array.isArray(config.items)) configEcho.items = config.items;
    if (config.titleField) configEcho.titleField = config.titleField;
    if (config.descriptionField)
      configEcho.descriptionField = config.descriptionField;
    if (config.imageField) configEcho.imageField = config.imageField;
    if (Array.isArray(config.buttons)) configEcho.buttons = config.buttons;
    if (Array.isArray(config.itemButtons))
      configEcho.itemButtons = config.itemButtons;

    if (allButtons.length > 0) {
      return Promise.resolve({
        config: {
          ...configEcho,
          buttonConfig: {
            buttons: allButtons,
            buttonItemMap:
              Object.keys(buttonItemMap).length > 0 ? buttonItemMap : undefined,
          },
        },
        output: payload,
        status: 'waiting_for_input',
        meta: { interactionType: 'buttons', durationMs: 0 },
      });
    }

    return Promise.resolve({ config: configEcho, output: payload });
  }

  private renderHtml(
    items: Array<{
      title: string;
      description: string;
      image?: string;
      buttons?: ButtonDef[];
    }>,
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
