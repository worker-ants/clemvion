import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { AI_NO_LLM_PROVIDER_MESSAGE } from '../llm-provider-rule';

const categoryDefSchema = z.object({
  name: z.string().meta({ ui: { label: 'Name', widget: 'text' } }),
  description: z
    .string()
    .meta({ ui: { label: 'Description', widget: 'textarea' } }),
  examples: z
    .array(z.string())
    .default([])
    .meta({ ui: { label: 'Examples', widget: 'field-array' } }),
});

export const textClassifierNodeConfigSchema = z
  .object({
    llmConfigId: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'LLM Provider',
          widget: 'llm-config-selector',
          order: 1,
        },
      }),
    model: z
      .string()
      .optional()
      .meta({ ui: { label: 'Model', widget: 'text', order: 2 } }),
    inputField: z
      .string()
      .optional()
      .meta({ ui: { label: 'Input Field', widget: 'expression', order: 3 } }),
    categories: z
      .array(categoryDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Categories',
          widget: 'field-array',
          itemLabel: 'Category',
          order: 4,
        },
      }),
    instructions: z
      .string()
      .optional()
      .meta({ ui: { label: 'Instructions', widget: 'textarea', order: 5 } }),
    includeConfidence: z
      .boolean()
      .default(false)
      .meta({
        ui: { label: 'Include Confidence', widget: 'checkbox', order: 6 },
      }),
    includeEvidence: z
      .boolean()
      .default(false)
      .meta({
        ui: { label: 'Include Evidence', widget: 'checkbox', order: 7 },
      }),
    multiLabel: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Multi-label Classification',
          widget: 'checkbox',
          order: 8,
        },
      }),
  })
  .passthrough();
export type TextClassifierConfig = z.infer<
  typeof textClassifierNodeConfigSchema
>;

/**
 * AUTOCOMPLETE HINT SCHEMA — not used for runtime validation.
 *
 * Runtime `$node["X"].output` value after the handler-output adapter unwraps
 * the handler's `{ config, output, meta, port }` return. This produces a
 * FLAT output schema (same shape as ai_agent, different from info_extractor).
 * Covers both single-label and multi-label variants plus the error-port case;
 * `.passthrough()` keeps unknown keys visible if handlers evolve.
 */
export const textClassifierNodeOutputSchema = z
  .object({
    category: z.string().nullable().optional(),
    categories: z
      .array(
        z.object({
          name: z.string(),
          confidence: z.number().optional(),
          evidence: z.array(z.string()).optional(),
        }),
      )
      .optional(),
    confidence: z.number().optional(),
    evidence: z.array(z.string()).optional(),
    originalInput: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const textClassifierNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [],
};

/**
 * Imperative escape hatch — per-category validation needs array iteration
 * (each must have a `name` AND that name must not collide with the reserved
 * `__none__` sentinel). Top-level "categories empty?" / "no provider?" /
 * "no inputField?" checks live in `warningRules` so the canvas badge fires.
 *
 * NOTE: keep the sentinel in lockstep with `TextClassifierHandler.NONE_SENTINEL`
 * — duplicating the value here avoids importing the handler module from the
 * schema (handler can pull from this list once Step 4 slimming lands).
 */
const NONE_SENTINEL = '__none__';
export function validateTextClassifierConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const categories = c.categories;
  if (Array.isArray(categories)) {
    for (let i = 0; i < categories.length; i++) {
      const cat = (categories[i] ?? {}) as Record<string, unknown>;
      if (!cat.name || typeof cat.name !== 'string') {
        errors.push(`Category ${i + 1}: name is required`);
      } else if (cat.name === NONE_SENTINEL) {
        errors.push(`Category ${i + 1}: "${NONE_SENTINEL}" is a reserved name`);
      }
    }
  }
  return errors;
}

export const textClassifierNodeMetadata: NodeComponentMetadata = {
  type: 'text_classifier',
  category: 'ai',
  label: 'Text Classifier',
  description: 'Classify text into categories',
  icon: 'Tags',
  color: '#10B981',
  isDynamicPorts: true,
  dynamicPorts: {
    kind: 'classifier-categories',
    fallbackId: 'fallback',
    errorId: 'error',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `textClassifierSummary` warnings ("Default provider not
  //    configured" / "Categories not defined") — the provider check has
  //    the same hasDefaultLlmConfig context split as ai_agent (see that
  //    node's note); backend fires whenever both model + llmConfigId
  //    are missing.
  //  - backend handler.validate's "At least one category is required"
  //    + "inputField is required" rules.
  // Per-category structural validation lives in `validateConfig`.
  warningRules: [
    {
      id: 'text_classifier:no-llm-provider',
      when: '!model && !llmConfigId',
      message: AI_NO_LLM_PROVIDER_MESSAGE,
    },
    {
      id: 'text_classifier:no-categories',
      when: 'length(categories) == 0',
      message: '하나 이상의 카테고리를 추가해야 합니다.',
    },
    {
      id: 'text_classifier:no-input-field',
      when: '!inputField',
      message: 'Input Field 를 입력해야 합니다.',
    },
  ],
  validateConfig: validateTextClassifierConfig,
};
