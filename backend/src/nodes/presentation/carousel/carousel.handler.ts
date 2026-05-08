import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { ButtonDef } from '../_shared/button.types.js';
import { carouselNodeMetadata } from './carousel.schema.js';

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
  metadata = carouselNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers mode dispatch,
    // titleField / items / itemButtons / per-item title + buttons + global
    // buttons. We normalize `mode` to its zod default ('dynamic') before
    // dispatching to the SSOT so a missing `mode` still fires the
    // dynamic-mode warningRules (the rule's `mode == dynamic` predicate
    // can't see the zod default, which is applied at parse time).
    const normalized =
      (config?.mode as string | undefined) === undefined
        ? { ...config, mode: 'dynamic' }
        : config;
    const errors = [
      ...evaluateMetadataBlockingErrors(this.metadata, normalized),
    ];

    const mode = (normalized.mode as string) ?? 'dynamic';
    if (
      mode === 'dynamic' &&
      config.titleField !== undefined &&
      typeof config.titleField !== 'string'
    ) {
      errors.push('titleField is required and must be a string');
    }
    // schema's `length(items)` happily returns the string length of a non-
    // array `items`, so the warningRule misses `items: 'not-array'`. Catch it.
    if (
      mode === 'static' &&
      config.items !== undefined &&
      !Array.isArray(config.items)
    ) {
      errors.push('items must be an array in static mode');
    }

    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
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

    // CONVENTIONS Principle 7 — config echoes raw user-entered settings
    // (per-item title / description / image, button labels, titleField etc.
    // may carry `{{ ... }}` templates that the engine resolved before
    // dispatch). evaluated rendered items live in output.
    const rawConfig = context.rawConfig ?? config;
    const payload: Record<string, unknown> = { items, rendered };
    const configEcho: Record<string, unknown> = {
      layout: rawConfig.layout ?? layout,
      mode: rawConfig.mode ?? mode,
    };
    if (Array.isArray(rawConfig.items)) configEcho.items = rawConfig.items;
    if (rawConfig.titleField) configEcho.titleField = rawConfig.titleField;
    if (rawConfig.descriptionField)
      configEcho.descriptionField = rawConfig.descriptionField;
    if (rawConfig.imageField) configEcho.imageField = rawConfig.imageField;
    if (Array.isArray(rawConfig.buttons))
      configEcho.buttons = rawConfig.buttons;
    if (Array.isArray(rawConfig.itemButtons))
      configEcho.itemButtons = rawConfig.itemButtons;

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
