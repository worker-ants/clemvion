import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * `headers` / `queryParams` 의 공용 entry. 향후 메타 필드 (e.g. `description`,
 * `enabled`) 가 추가되더라도 strip 되지 않도록 다른 노드 (form, carousel) 와
 * 동일하게 `.passthrough()` 적용. handler 의 `toKeyValueRecord` 가 `{key,value}`
 * 만 추출해 HTTP 요청에 전달하므로 추가 메타가 외부로 누출되지 않는다 (review W-3).
 *
 * `\r` / `\n` 가 포함된 입력은 schema 단계에서 거부 — header/query 인젝션 방어
 * 의 1차 라인. 핸들러도 `stripCrlf` 로 다시 한 번 방어 (review W-1
 * defense-in-depth).
 */
const NO_CRLF_RE = /^[^\r\n]*$/;
export const keyValueSchema = z
  .object({
    key: z
      .string()
      .regex(NO_CRLF_RE, 'CRLF characters are not allowed in key')
      .meta({ ui: { label: 'Key', widget: 'text' } }),
    value: z
      .string()
      .regex(NO_CRLF_RE, 'CRLF characters are not allowed in value')
      .meta({ ui: { label: 'Value', widget: 'expression' } }),
  })
  .passthrough();

/**
 * HTTP Request output. CONVENTIONS Principle 7 — `config` echoes the **raw**
 * request settings the workflow author entered (URL credentials stripped,
 * `{{ ... }}` preserved). `output.response` carries the parsed response
 * body (opaque — the user targets arbitrary APIs); `output.requestBody`
 * carries the evaluated request body that hit the wire (capped at 256KB
 * with `bodyTruncated`). `output.responseHeaders` echoes the response
 * headers with credential-shaped values redacted. The standardized
 * `output.error` envelope still appears on non-2xx / transport failures
 * (CONVENTIONS §3.2). Tier 3 per node-jazzy-liskov plan —
 * `output.response: unknown`.
 */
export const httpRequestNodeOutputSchema = z
  .object({
    config: z
      .object({
        method: z.string().optional(),
        url: z.string().optional(),
        authentication: z.string().optional(),
        integrationId: z.string().optional(),
        headers: z.array(z.unknown()).optional(),
        queryParams: z.array(z.unknown()).optional(),
        body: z.unknown().optional(),
        bodyType: z.string().optional(),
        responseType: z.string().optional(),
        timeout: z.number().optional(),
        followRedirects: z.boolean().optional(),
        verifySsl: z.boolean().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        response: z.unknown().optional(),
        requestBody: z.unknown().optional(),
        requestBodyType: z.string().optional(),
        responseHeaders: z.record(z.string(), z.string()).optional(),
        bodyTruncated: z.boolean().optional(),
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
        durationMs: z.number().optional(),
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
      .meta({
        ui: {
          label: 'URL',
          widget: 'expression',
          order: 2,
          // warningRule `http_request:no-url` 가 강제하는 필수성을 UI 표시
          // (asterisk) 에 반영. zod 의 .optional() 은 저장 관용성·LLM tool 호출
          // 시 부분 인자 허용을 위해 유지 — 필수성 정의는 ui.required 가
          // SSOT (node-component.interface.ts:222-226 참고).
          required: true,
        },
      }),
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
          // warningRule `http_request:integration-auth-needs-integration-id`
          // 와 동일 조건을 UI required cue 로 표면화.
          requiredWhen: { field: 'authentication', equals: 'integration' },
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
  // Re-run dry-run (spec/5-system/13-replay-rerun.md §7) — handler returns a
  // mock instead of performing the real HTTP call when `__dryRun === true`.
  supportsDryRun: true,
  label: 'HTTP Request',
  description: 'Make HTTP requests',
  icon: 'Globe',
  color: '#F97316',
  executionMetadata: { kind: 'standard' },
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
      message: 'URL must be entered.',
    },
    {
      id: 'http_request:integration-auth-needs-integration-id',
      when: 'authentication == integration && !integrationId',
      message: 'Integration must be selected when using Integration auth.',
    },
  ],
  validateConfig: validateHttpRequestConfig,
};
