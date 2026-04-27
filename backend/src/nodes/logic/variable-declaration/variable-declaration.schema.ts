import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const varDefSchema = z
  .object({
    name: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Name',
          widget: 'text',
          placeholder: 'variableName',
        },
      }),
    type: z
      .enum(['string', 'number', 'boolean', 'array', 'object'])
      .default('string')
      .meta({ ui: { label: 'Type', widget: 'select' } }),
    defaultValue: z
      .unknown()
      .optional()
      .meta({
        ui: { label: 'Default Value', widget: 'expression' },
      }),
  })
  .passthrough();

/**
 * Variable Declaration passes input through and only mutates the execution
 * variable pool (`context.variables.<name>`) — the declared variables are
 * surfaced to expressions via `$var.<name>`, NOT through this node's output.
 * Hence the `output` schema mirrors the passthrough input with `unknown`.
 */
export const variableDeclarationNodeOutputSchema = z
  .object({
    config: z
      .object({
        variables: z.array(varDefSchema).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const variableDeclarationNodeConfigSchema = z
  .object({
    variables: z
      .array(varDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Variables',
          widget: 'field-array',
          itemLabel: 'Variable',
        },
      }),
  })
  .passthrough();
export type VariableDeclarationConfig = z.infer<
  typeof variableDeclarationNodeConfigSchema
>;

export const variableDeclarationNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

/**
 * Imperative escape hatch — per-variable name/type validation needs array
 * iteration the mini-DSL can't express. Single-field "is variables empty?"
 * / "first variable.name set?" checks live in `warningRules` below.
 */
export function validateVariableDeclarationConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const variables = c.variables;

  if (Array.isArray(variables)) {
    for (let i = 0; i < variables.length; i++) {
      const v = (variables[i] ?? {}) as Record<string, unknown>;
      if (!v.name || typeof v.name !== 'string') {
        errors.push(`variables[${i}].name is required and must be a string`);
      }
      if (!v.type || typeof v.type !== 'string') {
        errors.push(`variables[${i}].type is required and must be a string`);
      }
    }
  }

  return errors;
}

export const variableDeclarationNodeMetadata: NodeComponentMetadata = {
  type: 'variable_declaration',
  category: 'logic',
  label: 'Variable',
  description: 'Declare variables',
  icon: 'Variable',
  color: '#3B82F6',
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `variableDeclarationSummary` warning ("No variables defined" —
  //    fires when variables[] is empty OR no variable has a name set)
  //  - backend handler.validate's "variables non-empty" + per-variable
  //    name/type rules. Per-item iteration lives in `validateConfig`.
  warningRules: [
    {
      id: 'variable_declaration:no-variables',
      when: 'length(variables) == 0',
      message: '최소 1개 이상의 변수를 정의해야 합니다.',
    },
    {
      id: 'variable_declaration:first-variable-name-empty',
      when: 'length(variables) > 0 && !variables.0.name',
      message: '첫 번째 변수의 이름을 입력해야 합니다.',
    },
  ],
  validateConfig: validateVariableDeclarationConfig,
};
