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
        recordValues: z.boolean().optional(),
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
    /**
     * When `true`, each `meta.modifications[i]` entry is augmented with
     * `before` / `after` snapshots of the variable value, with sensitive
     * keys masked via `maskValueForLog`. Default `false` because the
     * snapshots can be large for collection variables and may include user
     * data that should not surface in run logs by default.
     *
     * Spec: 4-nodes/1-logic/5-variable-modification.md §5.1.
     */
    recordValues: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Record values in meta',
          widget: 'checkbox',
          hint: 'Include before/after snapshots in meta.modifications (masked). Off by default.',
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
  // Mirror the handler's whitelist exactly. The schema enum
  // (`modOperationSchema`) and handler `applyModification` switch share
  // this same 6-operation set — keep all three in sync.
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
      message: 'At least one modification must be added.',
    },
    {
      id: 'variable_modification:first-variable-empty',
      when: 'length(modifications) > 0 && !modifications.0.variable',
      message: 'First modification\'s target variable must be selected.',
    },
  ],
  validateConfig: validateVariableModificationConfig,
};
