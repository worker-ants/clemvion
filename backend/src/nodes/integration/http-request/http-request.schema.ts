import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const keyValueSchema = z.object({
  key: z.string().meta({ ui: { label: 'Key', widget: 'text' } }),
  value: z.string().meta({ ui: { label: 'Value', widget: 'expression' } }),
});

/**
 * HTTP Request output is opaque (user targets arbitrary APIs). The handler
 * always wraps the raw body in `output.response` and surfaces a standardized
 * `output.error` envelope on non-2xx / transport failures (CONVENTIONS §3.2).
 * Tier 3 per node-jazzy-liskov plan — `output.response: unknown`.
 */
export const httpRequestNodeOutputSchema = z
  .object({
    config: z
      .object({
        method: z.string().optional(),
        url: z.string().optional(),
        authentication: z.string().optional(),
        integrationId: z.string().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        response: z.unknown().optional(),
        error: z
          .object({
            code: z.string().optional(),
            message: z.string().optional(),
            details: z.record(z.string(), z.unknown()).optional(),
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
        statusCode: z.number().optional(),
        duration: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.enum(['success', 'error']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const httpRequestNodeConfigSchema = z
  .object({
    method: z
      .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
      .default('GET')
      .meta({ ui: { label: 'Method', widget: 'select', order: 1 } }),
    url: z
      .string()
      .optional()
      .meta({ ui: { label: 'URL', widget: 'expression', order: 2 } }),
    authentication: z
      .enum(['none', 'integration', 'custom'])
      .default('none')
      .meta({ ui: { label: 'Authentication', widget: 'select', order: 3 } }),
    integrationId: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Integration',
          widget: 'integration-selector',
          order: 4,
          visibleWhen: { field: 'authentication', equals: 'integration' },
        },
        // Assistant candidate picker 의 후보 조회 범위 힌트.
        // backend 의 CandidateLookupService 가 Integration 테이블을
        // `service_type=http` 로 필터해 이 노드의 picker 에 전달한다.
        // 값이 비면 connected 전체가 후보로 노출된다.
        integrationServiceType: 'http',
      }),
    headers: z
      .array(keyValueSchema)
      .default([])
      .meta({
        ui: {
          label: 'Headers',
          widget: 'kv-expression',
          order: 5,
        },
      }),
    queryParams: z
      .array(keyValueSchema)
      .default([])
      .meta({
        ui: {
          label: 'Query Params',
          widget: 'kv-expression',
          order: 6,
        },
      }),
    body: z
      .unknown()
      .optional()
      .meta({
        ui: { label: 'Body', widget: 'code', language: 'json', order: 7 },
      }),
    bodyType: z
      .enum(['json', 'form-data', 'x-www-form-urlencoded', 'raw', 'binary'])
      .default('json')
      .meta({ ui: { label: 'Body Type', widget: 'select', order: 8 } }),
    responseType: z
      .enum(['json', 'text', 'binary'])
      .default('json')
      .meta({ ui: { label: 'Response Type', widget: 'select', order: 9 } }),
    timeout: z
      .number()
      .int()
      .default(30000)
      .meta({ ui: { label: 'Timeout (ms)', widget: 'number', order: 10 } }),
    followRedirects: z
      .boolean()
      .default(true)
      .meta({
        ui: { label: 'Follow Redirects', widget: 'checkbox', order: 11 },
      }),
    verifySsl: z
      .boolean()
      .default(true)
      .meta({ ui: { label: 'Verify SSL', widget: 'checkbox', order: 12 } }),
  })
  .passthrough();
export type HttpRequestConfig = z.infer<typeof httpRequestNodeConfigSchema>;

export const httpRequestNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'success', label: 'Success', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

/**
 * Imperative escape hatch — `timeout` numeric range needs `> 0` AND a
 * non-numeric type guard the mini-DSL cannot model in a single rule. The
 * "URL set?" / "integration auth needs integrationId" checks live in
 * `warningRules` below so the canvas badge fires.
 */
export function validateHttpRequestConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  if (
    c.timeout !== undefined &&
    (typeof c.timeout !== 'number' || c.timeout <= 0)
  ) {
    errors.push('timeout must be a positive number');
  }

  return errors;
}

export const httpRequestNodeMetadata: NodeComponentMetadata = {
  type: 'http_request',
  category: 'integration',
  label: 'HTTP Request',
  description: 'Make HTTP requests',
  icon: 'Globe',
  color: '#F97316',
  // `summaryTemplate.warnWhen` retained for backward compat — `warningRules`
  // is the new SSOT.
  summaryTemplate: {
    template: '{{method|default:GET}} {{url}}',
    warnWhen: '!url',
    warnMessage: 'URL not set',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - legacy `summaryTemplate.warnWhen` (URL missing)
  //  - backend handler.validate's "url is required" + "integrationId is
  //    required when authentication is 'integration'" rules.
  // `method` enum + `bodyType` / `responseType` enums are bounded by zod, so
  // no extra rule is needed for those. `timeout` numeric range lives in
  // `validateConfig` because the mini-DSL can't pair `> 0` with a type
  // guard in a single expression.
  warningRules: [
    {
      id: 'http_request:no-url',
      when: '!url',
      message: 'URL 을 입력해야 합니다.',
    },
    {
      id: 'http_request:integration-auth-needs-integration-id',
      when: 'authentication == integration && !integrationId',
      message: 'Integration 인증을 사용하려면 integration 을 선택해야 합니다.',
    },
  ],
  validateConfig: validateHttpRequestConfig,
};
