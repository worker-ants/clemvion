import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const modOperationSchema = z.enum([
  'set',
  'increment',
  'decrement',
  'append',
  'push',
  'pop',
  'set_field',
  'delete_field',
]);

export const modDefSchema = z
  .object({
    variable: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Variable',
          widget: 'text',
          placeholder: 'variableName',
        },
      }),
    operation: modOperationSchema.default('set').meta({
      ui: { label: 'Operation', widget: 'select' },
    }),
    value: z
      .unknown()
      .optional()
      .meta({
        ui: { label: 'Value', widget: 'expression' },
      }),
  })
  .passthrough();

/**
 * Variable Modification mutates `context.variables` in place and passes the
 * input through as output. Like Variable Declaration, modified variables
 * surface through `$var.<name>` — not the node's output envelope.
 */
export const variableModificationNodeOutputSchema = z
  .object({
    config: z
      .object({
        modifications: z.array(modDefSchema).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const variableModificationNodeConfigSchema = z
  .object({
    modifications: z
      .array(modDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Modifications',
          widget: 'field-array',
          itemLabel: 'Modification',
        },
      }),
  })
  .passthrough();
export type VariableModificationConfig = z.infer<
  typeof variableModificationNodeConfigSchema
>;

export const variableModificationNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

/**
 * Imperative escape hatch — per-modification variable/operation validation
 * needs array iteration the mini-DSL can't express. Single-field "is
 * modifications empty?" / "first modification.variable set?" checks live in
 * `warningRules` below.
 */
export function validateVariableModificationConfig(config: unknown): string[] {
  // Mirror the handler's whitelist exactly. Note `set_field` /
  // `delete_field` are valid in the schema enum but the handler rejects
  // them — we mirror the handler so handler.validate parity is preserved.
  const VALID_OPERATIONS = new Set([
    'set',
    'increment',
    'decrement',
    'append',
    'push',
    'pop',
  ]);
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const modifications = c.modifications;

  if (Array.isArray(modifications)) {
    for (let i = 0; i < modifications.length; i++) {
      const m = (modifications[i] ?? {}) as Record<string, unknown>;
      if (!m.variable || typeof m.variable !== 'string') {
        errors.push(
          `modifications[${i}].variable is required and must be a string`,
        );
      }
      if (!m.operation || !VALID_OPERATIONS.has(m.operation as string)) {
        errors.push(
          `modifications[${i}].operation must be one of: ${[...VALID_OPERATIONS].join(', ')}`,
        );
      }
    }
  }

  return errors;
}

export const variableModificationNodeMetadata: NodeComponentMetadata = {
  type: 'variable_modification',
  category: 'logic',
  label: 'Set Variable',
  description: 'Modify variables',
  icon: 'PenLine',
  color: '#3B82F6',
  executionMetadata: { kind: 'standard' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `variableModificationSummary` warning ("Variable not selected"
  //    — fires when modifications[] is empty OR first modification.variable
  //    is blank)
  //  - backend handler.validate's "modifications non-empty" + per-item
  //    variable/operation rules. Per-item iteration lives in
  //    `validateConfig`.
  warningRules: [
    {
      id: 'variable_modification:no-modifications',
      when: 'length(modifications) == 0',
      message: '최소 1개 이상의 변경을 추가해야 합니다.',
    },
    {
      id: 'variable_modification:first-variable-empty',
      when: 'length(modifications) > 0 && !modifications.0.variable',
      message: '첫 번째 변경의 대상 변수를 선택해야 합니다.',
    },
  ],
  validateConfig: validateVariableModificationConfig,
};
