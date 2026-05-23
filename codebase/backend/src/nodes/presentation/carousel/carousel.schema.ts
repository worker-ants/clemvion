import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { MAX_BUTTONS_PER_NODE, validateButtons } from '../_shared/button.types';

// Mirror: ButtonDef in _shared/button.types.ts — keep fields in sync.
const buttonDefSchema = z
  .object({
    id: z.string().optional(),
    label: z
      .string()
      .default('')
      .meta({ ui: { label: 'Label', widget: 'expression' } }),
    type: z
      .enum(['link', 'port'])
      .default('port')
      .meta({ ui: { label: 'Type', widget: 'select' } }),
    url: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'URL',
          widget: 'expression',
          visibleWhen: { field: 'type', equals: 'link' },
        },
      }),
    style: z
      .enum(['primary', 'secondary', 'outline', 'danger'])
      .default('secondary')
      .meta({ ui: { label: 'Style', widget: 'select' } }),
    // Note: carousel per-item buttons surface item context (`{item.title} → {label}`)
    // in the synthesis formula, so the placeholder differs intentionally from
    // chart/table/template which use label-only fallback. Both are correct per spec §10.8.
    userMessage: z
      .string()
      .max(500)
      .optional()
      .meta({
        ui: {
          label: 'User Message',
          widget: 'expression',
          placeholder:
            '클릭 시 chat 발화 텍스트 (생략 시 자동 합성: "{item.title} → {label}")',
          visibleWhen: { field: 'type', equals: 'port' },
        },
        description:
          'AI Agent render_* tool 모드에서 type="port" 버튼 클릭 시 chat 에 발화될 user message. 미설정 시 frontend 가 자동 합성. type="link" 에서는 무시.',
      }),
  })
  .passthrough();

const itemDefSchema = z
  .object({
    title: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Title',
          widget: 'expression',
          placeholder: 'Slide title',
          required: true,
        },
      }),
    description: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Description',
          widget: 'expression',
          placeholder: 'Slide description (optional)',
        },
      }),
    image: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Image URL',
          widget: 'expression',
          placeholder: 'https://... (optional)',
        },
      }),
    buttons: z
      .array(buttonDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Item Buttons',
          widget: 'button-list',
          collapsible: true,
        },
      }),
  })
  .passthrough();

/**
 * Carousel runtime output:
 *   - static  mode → `output` carries no runtime array; slides live in
 *                    `config.items` (CONVENTIONS Principle 1.1 — config ↔
 *                    output orthogonality, Principle 4.3 — waiting shape).
 *   - dynamic mode → `output.items` carries the runtime-mapped slides
 *                    (`source` resolve + field mapping + cap).
 * When any button is configured the engine decorates
 * `output.interaction.{type, data, receivedAt}` on click (same shape as
 * Form/Table buttons). HTML snapshot (`output.rendered`) is intentionally
 * NOT part of the schema — the frontend reconstructs the carousel from
 * `config` + `items` (Principle 1 — output holds business results only).
 */
export const carouselNodeOutputSchema = z
  .object({
    config: z
      .object({
        mode: z.enum(['static', 'dynamic']).optional(),
        layout: z.enum(['card', 'image', 'minimal']).optional(),
        items: z.array(itemDefSchema).optional(),
        titleField: z.string().optional(),
        descriptionField: z.string().optional(),
        imageField: z.string().optional(),
        buttons: z.array(buttonDefSchema).optional(),
        itemButtons: z.array(buttonDefSchema).optional(),
        buttonConfig: z.record(z.string(), z.unknown()).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        // Dynamic-mode runtime items. Static mode never populates this.
        items: z
          .array(
            z
              .object({
                title: z.string().optional(),
                description: z.string().optional(),
                image: z.string().optional(),
                buttons: z.array(buttonDefSchema).optional(),
              })
              .passthrough(),
          )
          .optional(),
        itemsTruncated: z.boolean().optional(),
        itemsTotalCount: z.number().optional(),
        interaction: z
          .object({
            type: z.string().optional(),
            data: z.record(z.string(), z.unknown()).optional(),
            receivedAt: z.string().optional(),
          })
          .partial()
          .passthrough()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    meta: z
      .object({
        interactionType: z.string().optional(),
        durationMs: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const carouselNodeConfigSchema = z
  .object({
    mode: z
      .enum(['static', 'dynamic'])
      .default('dynamic')
      .meta({
        ui: {
          label: 'Mode',
          widget: 'select',
          order: 0,
          options: [
            { value: 'static', label: 'Static Items' },
            { value: 'dynamic', label: 'Dynamic (from input)' },
          ],
          // Intentionally does NOT include `items` or `itemButtons`: those hold
          // user-authored content and would cause silent data loss on mode
          // switch. They're already hidden via `visibleWhen` in the opposite
          // mode, so preservation is safe.
        },
      }),

    // ── Static mode fields ──
    items: z
      .array(itemDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Items',
          widget: 'field-array',
          itemLabel: 'Item',
          order: 1,
          group: 'Items',
          visibleWhen: { field: 'mode', equals: 'static' },
          requiredWhen: { field: 'mode', equals: 'static' },
        },
      }),

    // ── Dynamic mode fields ──
    source: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Source',
          widget: 'expression',
          placeholder: '{{ $input.items }}',
          hint: 'Expression that returns the array to display',
          order: 10,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    titleField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Title Field',
          widget: 'expression',
          placeholder: 'title',
          hint: 'Field path for slide title',
          order: 11,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
          requiredWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    descriptionField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Description Field',
          widget: 'expression',
          placeholder: 'description',
          order: 12,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    imageField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Image Field',
          widget: 'expression',
          placeholder: 'imageUrl (optional)',
          order: 13,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    maxItems: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .meta({
        ui: {
          label: 'Max Items',
          widget: 'number',
          order: 14,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    itemButtons: z
      .array(buttonDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Item Buttons',
          widget: 'button-list',
          order: 15,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),

    // ── Common fields ──
    layout: z
      .enum(['card', 'image', 'minimal'])
      .default('card')
      .meta({
        ui: {
          label: 'Layout',
          widget: 'select',
          order: 20,
          options: [
            { value: 'card', label: 'Card' },
            { value: 'image', label: 'Image' },
            { value: 'minimal', label: 'Minimal' },
          ],
        },
      }),
    buttons: z
      .array(buttonDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Buttons',
          widget: 'button-list',
          order: 30,
          group: 'Buttons',
          collapsible: true,
        },
      }),
  })
  .passthrough();
export type CarouselConfig = z.infer<typeof carouselNodeConfigSchema>;

export const carouselNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

/**
 * Per-item button validation shared between static items[i].buttons and the
 * dynamic-mode itemButtons array. Mirrors the legacy
 * `validateItemButtons()` in carousel.handler.ts so the SSOT schema metadata
 * owns the rule (the handler will be slimmed in Step 4).
 */
function validateCarouselItemButtons(
  buttons: unknown[],
  prefix: string,
): string[] {
  const errors: string[] = [];
  // Per-item cap mirrors the per-node global cap (5) — see
  // `MAX_BUTTONS_PER_NODE` and spec/4-nodes/6-presentation/0-common.md §1.1.
  // Carousel can therefore surface up to 10 buttons on a single item
  // (global 5 + item 5) as documented in the spec Rationale.
  if (buttons.length > MAX_BUTTONS_PER_NODE) {
    errors.push(`${prefix}: maximum ${MAX_BUTTONS_PER_NODE} buttons per item`);
  }
  const ids = new Set<string>();
  for (let j = 0; j < buttons.length; j++) {
    const btn = (buttons[j] ?? {}) as Record<string, unknown>;
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

/**
 * Imperative escape hatch for cross-field carousel rules the mini-DSL can't
 * express:
 *  - per-item title checks in static mode (need to iterate `items[]`)
 *  - per-item buttons + shared itemButtons validation (regex + uniqueness)
 *  - global `buttons` validation (delegated to the shared `validateButtons`).
 *
 * Single-field "is it set?" checks live in `warningRules` above so they fire
 * the canvas badge.
 */
export function validateCarouselConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const mode = (c.mode as string) ?? 'dynamic';

  if (mode === 'static' && Array.isArray(c.items)) {
    const items = c.items as Record<string, unknown>[];
    for (let i = 0; i < items.length; i++) {
      const item = items[i] ?? {};
      if (!item.title || typeof item.title !== 'string') {
        errors.push(`items[${i}].title is required and must be a string`);
      }
      if (Array.isArray(item.buttons)) {
        errors.push(
          ...validateCarouselItemButtons(
            item.buttons as unknown[],
            `items[${i}]`,
          ),
        );
      }
    }
  }

  if (mode === 'dynamic' && Array.isArray(c.itemButtons)) {
    errors.push(
      ...validateCarouselItemButtons(c.itemButtons as unknown[], 'itemButtons'),
    );
  }

  errors.push(...validateButtons(c));
  return errors;
}

export const carouselNodeMetadata: NodeComponentMetadata = {
  type: 'carousel',
  category: 'presentation',
  label: 'Carousel',
  description: 'Display as slides',
  icon: 'GalleryHorizontal',
  color: '#EC4899',
  executionMetadata: { kind: 'standard' },
  isDynamicPorts: true,
  dynamicPorts: {
    kind: 'presentation-buttons',
    supportsItems: true,
    supportsItemButtons: true,
    continueId: 'continue',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `carouselSummary` warning branches (titleField missing in
  //    dynamic mode, items empty in static mode, invalid mode value)
  //  - backend handler.validate's top-level structural checks
  // Per-item content checks (item.title, per-item buttons, shared
  // itemButtons, global buttons) live in `validateConfig` because they need
  // array iteration / regex the mini-DSL can't express.
  warningRules: [
    {
      id: 'carousel:dynamic-mode-needs-title-field',
      when: 'mode == dynamic && !titleField',
      message: 'In Dynamic mode, a Title field must be entered.',
    },
    {
      id: 'carousel:static-mode-needs-items',
      when: 'mode == static && length(items) == 0',
      message: 'In Static mode, at least one slide must be added.',
    },
    {
      id: 'carousel:invalid-mode',
      when: 'mode != static && mode != dynamic',
      message: 'Mode must be either static or dynamic.',
    },
  ],
  validateConfig: validateCarouselConfig,
};
