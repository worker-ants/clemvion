import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  PRESENTATION_MAX_BYTES,
  truncateArrayForOutput,
} from '../../core/truncate-output.util.js';
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
  ): Promise<NodeHandlerOutput> {
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

    // Cap evaluated `items` at the Presentation 1MB threshold so the
    // surfaced array stays bounded and the buttonItemMap below references
    // only items that are actually present in the output (truncation drops
    // the tail elements and would otherwise leave dangling button → index
    // mappings).
    const cappedItems = truncateArrayForOutput(items, PRESENTATION_MAX_BYTES);

    // Collect all buttons: global + per-item. Iterate the capped list so
    // dropped items don't leave dangling button → index mappings (the index
    // would point past `items.length` after truncation).
    const globalButtons = (config.buttons as ButtonDef[] | undefined) ?? [];
    const allButtons: ButtonDef[] = [...globalButtons];
    const buttonItemMap: Record<string, number> = {};

    for (let i = 0; i < cappedItems.value.length; i++) {
      const itemBtns = cappedItems.value[i].buttons;
      if (itemBtns) {
        for (const btn of itemBtns) {
          buttonItemMap[btn.id] = i;
          allButtons.push(btn);
        }
      }
    }

    // CONVENTIONS Principle 7 — config echoes raw user-entered settings
    // (per-item title / description / image, button labels, titleField etc.
    // may carry `{{ ... }}` templates that the engine resolved before
    // dispatch). Runtime-evaluated dynamic items live in `output.items`;
    // static literal items live solely in `config.items` (Principle 1.1
    // config↔output orthogonality).
    // D1 (2026-05-17) — explicit enumeration baseline. Echo every non-sensitive
    // schema field unconditionally so undefined keys still surface intent and
    // future credential-shaped fields can't slip in via spread.
    const rawConfig = context.rawConfig ?? config;
    const configEcho: Record<string, unknown> = {
      mode: rawConfig.mode ?? mode,
      layout: rawConfig.layout ?? layout,
      items: rawConfig.items,
      source: rawConfig.source,
      titleField: rawConfig.titleField,
      descriptionField: rawConfig.descriptionField,
      imageField: rawConfig.imageField,
      maxItems: rawConfig.maxItems,
      buttons: rawConfig.buttons,
      itemButtons: rawConfig.itemButtons,
    };

    // Build the output payload with static/dynamic split per CONVENTIONS
    // Principle 1.1 (config↔output orthogonality) + Principle 4.3 (waiting
    // shape):
    //   - static  → items live in `config.items`; `output` carries no
    //               runtime-derived array (use `{}` or `{ itemsTruncated }`
    //               surface for cap signalling).
    //   - dynamic → `source` + field mapping is runtime-derived → surface
    //               the resolved `items` array in `output.items`.
    // `output.rendered` HTML snapshot is removed: the frontend reconstructs
    // the carousel from `config` + `items` (CONVENTIONS Principle 1 — output
    // holds business results only, not presentation artefacts).
    const payload: Record<string, unknown> = {};
    if (mode === 'dynamic') {
      payload.items = cappedItems.value;
    }
    if (cappedItems.truncated) {
      payload.itemsTruncated = true;
      payload.itemsTotalCount = cappedItems.originalLength;
    }

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
}
