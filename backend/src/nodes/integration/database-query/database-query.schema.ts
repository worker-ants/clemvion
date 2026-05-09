import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * Database Query output shape varies by driver and query type (SELECT vs
 * INSERT/UPDATE/DELETE). Row columns are user-query-dependent and opaque.
 * Tier 3 per node-jazzy-liskov plan.
 */
export const databaseQueryNodeOutputSchema = z
  .object({
    config: z
      .object({
        integrationId: z.string().optional(),
        query: z.string().optional(),
        queryType: z
          .enum(['select', 'insert', 'update', 'delete', 'raw'])
          .optional(),
        parameters: z.union([z.array(z.unknown()), z.string()]).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        rows: z.array(z.record(z.string(), z.unknown())).optional(),
        rowCount: z.number().optional(),
        insertId: z.number().optional(),
        fields: z
          .array(
            z
              .object({
                name: z.string().optional(),
                dataTypeID: z.number().optional(),
              })
              .passthrough(),
          )
          .optional(),
        error: z
          .object({
            code: z.string().optional(),
            message: z.string().optional(),
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
        durationMs: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.enum(['success', 'error']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const databaseQueryNodeConfigSchema = z
  .object({
    integrationId: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Integration',
          widget: 'integration-selector',
          order: 1,
        },
        // Assistant candidate picker 의 후보 조회 범위 힌트.
        // backend 의 CandidateLookupService 가 Integration 테이블을
        // `service_type=database` 로 필터해 이 노드의 picker 에 전달한다.
        // 값이 비면 connected 전체가 후보로 노출된다.
        integrationServiceType: 'database',
      }),
    queryType: z
      .enum(['select', 'insert', 'update', 'delete', 'raw'])
      .default('select')
      .meta({ ui: { label: 'Query Type', widget: 'select', order: 2 } }),
    query: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'SQL',
          widget: 'code',
          language: 'sql',
          order: 3,
        },
      }),
    parameters: z
      .union([z.array(z.unknown()), z.string()])
      .default([])
      .meta({
        ui: {
          label: 'Parameters',
          widget: 'expression',
          order: 4,
          hint: 'JSON array of values bound to $1, $2, ...',
        },
      }),
  })
  .passthrough();
export type DatabaseQueryConfig = z.infer<typeof databaseQueryNodeConfigSchema>;

export const databaseQueryNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'success', label: 'Success', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

/**
 * Imperative escape hatch — `parameters` is a sum type (`array | JSON-array
 * string`) that the mini-DSL cannot express in a single rule. Single-field
 * "is integrationId set?" / "is query set?" checks live in `warningRules`
 * below so the canvas badge fires.
 */
export function validateDatabaseQueryConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  if (
    c.parameters !== undefined &&
    c.parameters !== null &&
    !Array.isArray(c.parameters) &&
    typeof c.parameters !== 'string'
  ) {
    errors.push('parameters must be an array or a JSON array string');
  }

  return errors;
}

export const databaseQueryNodeMetadata: NodeComponentMetadata = {
  type: 'database_query',
  category: 'integration',
  label: 'Database',
  description: 'Execute SQL queries',
  icon: 'Database',
  color: '#F97316',
  executionMetadata: { kind: 'standard' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `databaseQuerySummary` warning ("Query not set")
  //  - backend handler.validate's "integrationId is required" + "query is
  //    required" rules.
  // `queryType` enum is bounded by zod, so no extra rule is needed there.
  // `parameters` sum-type guard lives in `validateConfig`.
  warningRules: [
    {
      id: 'database_query:no-integration',
      when: '!integrationId',
      message: 'Database integration 을 선택해야 합니다.',
    },
    {
      id: 'database_query:no-query',
      when: '!query',
      message: 'SQL query 를 입력해야 합니다.',
    },
  ],
  validateConfig: validateDatabaseQueryConfig,
};
