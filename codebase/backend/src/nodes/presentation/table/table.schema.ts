import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { validateButtons } from '../_shared/button.types';

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
    userMessage: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'User Message',
          widget: 'expression',
          placeholder: '클릭 시 chat 발화 텍스트 (생략 시 자동 합성: label)',
          visibleWhen: { field: 'type', equals: 'port' },
        },
        description:
          'AI Agent render_* tool 모드에서 type="port" 버튼 클릭 시 chat 에 발화될 user message. 미설정 시 frontend 가 자동 합성 (label). type="link" 에서는 무시.',
      }),
  })
  .passthrough();

const columnDefSchema = z
  .object({
    field: z
      .string()
      .default('')
      .meta({ ui: { label: 'Field', widget: 'expression' } }),
    label: z
      .string()
      .default('')
      .meta({ ui: { label: 'Label', widget: 'expression' } }),
    width: z
      .string()
      .optional()
      .meta({ ui: { label: 'Width', widget: 'text' } }),
    sortable: z
      .boolean()
      .optional()
      .meta({ ui: { label: 'Sortable', widget: 'checkbox' } }),
    format: z
      .string()
      .optional()
      .meta({ ui: { label: 'Format', widget: 'text' } }),
  })
  .passthrough();

const rowDefSchema = z.record(z.string(), z.string()).default({});

/**
 * Table runtime output. `rows[i].<field>` is populated from resolved columns
 * (see handler): frontend enricher `enrichTableOutputSchema` projects
 * `config.columns[].field` into `output.rows[]` items for autocomplete. When
 * buttons are configured the engine fills `output.interaction.{type, data,
 * receivedAt}` on click.
 */
export const tableNodeOutputSchema = z
  .object({
    config: z
      .object({
        mode: z.enum(['static', 'dynamic']).optional(),
        columns: z.array(columnDefSchema).optional(),
        pageSize: z.number().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        buttons: z.array(buttonDefSchema).optional(),
        buttonConfig: z.record(z.string(), z.unknown()).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        rows: z.array(z.record(z.string(), z.unknown())).optional(),
        totalRows: z.number().optional(),
        // D5 (2026-05-17) — `output.rendered` HTML snapshot 폐기.
        // frontend `TableContent` 가 `rows` + `columns` 로 직접 렌더.
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

export const tableNodeConfigSchema = z
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
            { value: 'dynamic', label: 'Dynamic (from data)' },
            { value: 'static', label: 'Static (manual)' },
          ],
        },
      }),
    dataSource: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Data Source',
          widget: 'expression',
          placeholder: '{{ $node["Node"].output }} or {{ $var.list }}',
          hint: 'Array data source (leave empty for previous node input)',
          order: 1,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    columns: z
      .array(columnDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Columns',
          widget: 'field-array',
          itemLabel: 'Column',
          order: 2,
          group: 'Columns',
        },
      }),
    rows: z
      .array(rowDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Rows',
          widget: 'field-array',
          itemLabel: 'Row',
          order: 3,
          group: 'Rows',
          visibleWhen: { field: 'mode', equals: 'static' },
        },
      }),
    pagination: z
      .boolean()
      .default(true)
      .meta({
        ui: { label: 'Enable Pagination', widget: 'checkbox', order: 10 },
      }),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(20)
      .meta({
        ui: {
          label: 'Page Size',
          widget: 'number',
          order: 11,
          visibleWhen: { field: 'pagination', equals: true },
        },
      }),
    sortBy: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Default Sort Column',
          widget: 'expression',
          placeholder: 'Optional field to sort by',
          order: 12,
        },
      }),
    sortOrder: z
      .enum(['asc', 'desc'])
      .default('asc')
      .meta({
        ui: {
          label: 'Sort Order',
          widget: 'select',
          order: 13,
          options: [
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
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
          order: 20,
          group: 'Buttons',
          collapsible: true,
        },
      }),
  })
  .passthrough();
export type TableConfig = z.infer<typeof tableNodeConfigSchema>;

export const tableNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

/**
 * Imperative escape hatch for cross-field table rules the mini-DSL can't
 * express:
 *  - `sortBy` must reference one of `columns[].field` (cross-collection lookup)
 *  - `rows` non-array in static mode (type guard zod can't easily express on
 *    an `unknown` passthrough payload — kept for parity with the existing
 *    handler check)
 *  - global `buttons` validation (delegated to the shared `validateButtons`).
 *
 * Single-field "is it set?" checks live in `warningRules` above so they fire
 * the canvas badge.
 */
export function validateTableConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const mode = (c.mode as string) ?? 'dynamic';

  if (c.columns !== undefined && !Array.isArray(c.columns)) {
    errors.push('columns must be an array');
  }

  if (mode === 'static' && c.rows !== undefined && !Array.isArray(c.rows)) {
    errors.push('rows must be an array in static mode');
  }

  if (c.sortBy && typeof c.sortBy === 'string' && Array.isArray(c.columns)) {
    const columnFields = (c.columns as Array<{ field: string }>).map(
      (col) => col.field,
    );
    if (!columnFields.includes(c.sortBy)) {
      errors.push(
        `sortBy "${c.sortBy}" must match one of the defined column fields`,
      );
    }
  }

  errors.push(...validateButtons(c));
  return errors;
}

export const tableNodeMetadata: NodeComponentMetadata = {
  type: 'table',
  category: 'presentation',
  label: 'Table',
  description: 'Display as table',
  icon: 'Table',
  color: '#EC4899',
  executionMetadata: { kind: 'standard' },
  isDynamicPorts: true,
  dynamicPorts: {
    kind: 'presentation-buttons',
    continueId: 'continue',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `tableSummary` warning branches (no columns)
  //  - backend handler.validate's mode validation
  // Cross-field `sortBy ↔ columns[].field` and shared button rules live in
  // `validateConfig`.
  warningRules: [
    {
      id: 'table:no-columns',
      when: 'length(columns) == 0',
      message: 'At least one column must be defined.',
    },
    {
      id: 'table:invalid-mode',
      when: 'mode != static && mode != dynamic',
      message: 'Mode must be either static or dynamic.',
    },
  ],
  validateConfig: validateTableConfig,
};
