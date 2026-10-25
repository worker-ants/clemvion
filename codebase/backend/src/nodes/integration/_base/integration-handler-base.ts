import { Logger } from '@nestjs/common';
import {
  IntegrationCredentialsUnreadableError,
  IntegrationsService,
} from '../../../modules/integrations/integrations.service.js';
import { Integration } from '../../../modules/integrations/entities/integration.entity.js';
import {
  isLiteralReference,
  type IntegrationUse,
} from '../../../modules/integrations/personal-integration-use.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

const logger = new Logger('IntegrationHandlerBase');
let warnedMissingNodeExecutionId = false;

/**
 * 조회가 통합을 돌려주지 않은 통합 ID. 노드 실행 컨텍스트마다 둔다. 엔진은 핸들러를 부를 때마다 컨텍스트를 새로 만들므로
 * 다른 노드나 병렬 분기와 섞이지 않는다.
 *
 * 핸들러는 실패하면 설정의 통합 ID 로 {@link IntegrationHandlerBase.logUsage} 를 부른다. 개인 통합 사용 판정의 거절은 없는
 * 통합과 같아야 하는데(REQ-INTMGMT-052), 그대로 두면 거절된 개인 통합의 활동 탭과 `last_error` 에 남의 워크플로우 실행이
 * 남는다. 그래서 조회가 거절된 ID 는 기록하지 않는다(REQ-INTMGMT-053 의 조회 거절). 자격 증명을 읽지 못한 통합은 조회가
 * 통합을 찾은 경우라 지금처럼 기록한다. 기록 규칙 전체(얻은 통합만 받는 `logUsage`)는 NERV Task `CLE-T-PTC4SF` 가 맡는다.
 */
const rejectedLookups = new WeakMap<ExecutionContext, Set<string>>();

/**
 * Shared helpers for node handlers that read Integration credentials and
 * attribute calls to the IntegrationUsageLog via the execution context.
 *
 * Handlers call:
 *  - `resolveIntegration(...)` to fetch + validate the Integration entity
 *    (`acquireIntegration` + `assertUsable`)
 *  - `logUsage(...)` to record success/failure for the Activity tab
 */
export interface IntegrationUsageParams {
  integrationId: string;
  status: 'success' | 'failed';
  durationMs: number;
  error?: { code?: string; message?: string } | null;
  /**
   * API 식별 정보. SoT: `spec/4-nodes/4-integration/_product-overview.md` INT-US-05.
   *  - `label`: catalog key (e.g., `cafe24.<resource>.<operation>`). 통합별로 NULL 가능.
   *  - `method`: HTTP method / SQL 동사 / `SEND` 등 (의미 통합별 상이).
   *  - `path`: host+path / driver / SMTP host 등 (의미 통합별 상이).
   * 길이 한도 (label 128, method 8, path 256) 초과 시 서비스 레이어가
   * 끝에 `…` 를 붙여 자른다.
   * 빈 문자열·`undefined` 는 서비스 레이어에서 `null` 로 coerce 된다.
   */
  api?: {
    label?: string | null;
    method?: string | null;
    path?: string | null;
  };
}

export class IntegrationHandlerBase {
  constructor(protected readonly integrationsService?: IntegrationsService) {}

  protected getWorkspaceId(context: ExecutionContext): string | undefined {
    return context.variables.__workspaceId as string | undefined;
  }

  /** 얻기(1·2단계)와 검증(3단계)을 이어 부른다(CLE-NODE-INT-COMMON 「IntegrationHandlerBase」). */
  protected async resolveIntegration(
    integrationId: string,
    context: ExecutionContext,
    expectedServiceType: string,
  ): Promise<Integration> {
    const integration = await this.acquireIntegration(integrationId, context);
    this.assertUsable(integration, expectedServiceType);
    return integration;
  }

  /**
   * 통합을 얻는다. 지금 노드와 참조 값이 리터럴이었는지를 `use` 로 넘긴다. 리터럴인지는 평가 전 원본
   * (`context.rawConfig.integrationId`)이 평가한 값과 같은 문자열인지로 본다. 원본이 없으면 표현식으로 본다.
   */
  protected async acquireIntegration(
    integrationId: string,
    context: ExecutionContext,
  ): Promise<Integration> {
    if (!this.integrationsService) {
      throw new Error('Integration service is not available');
    }
    const workspaceId = this.getWorkspaceId(context);
    if (!workspaceId) {
      throw new Error(
        'Missing workspace context — handler cannot resolve the integration',
      );
    }

    const use: IntegrationUse = {
      nodeId: context.nodeId ?? null,
      fromExpression: !isLiteralReference(
        context.rawConfig?.integrationId,
        integrationId,
      ),
    };
    try {
      return await this.integrationsService.getForExecution(
        integrationId,
        workspaceId,
        use,
      );
    } catch (err) {
      if (!(err instanceof IntegrationCredentialsUnreadableError)) {
        const ids = rejectedLookups.get(context) ?? new Set<string>();
        ids.add(integrationId);
        rejectedLookups.set(context, ids);
      }
      throw err;
    }
  }

  /** 얻은 통합이 노드가 기대한 유형이고 연결된 상태인지 본다. */
  protected assertUsable(
    integration: Integration,
    expectedServiceType: string,
  ): void {
    if (integration.serviceType !== expectedServiceType) {
      throw new IntegrationError(
        'INTEGRATION_TYPE_MISMATCH',
        `Integration ${integration.id} is type "${integration.serviceType}", not "${expectedServiceType}"`,
      );
    }
    if (integration.status !== 'connected') {
      throw new IntegrationError(
        'INTEGRATION_NOT_CONNECTED',
        `Integration "${integration.name}" is ${integration.status}${
          integration.statusReason ? ` (${integration.statusReason})` : ''
        }`,
      );
    }
  }

  protected async logUsage(
    context: ExecutionContext,
    params: IntegrationUsageParams,
  ): Promise<void> {
    if (!this.integrationsService) return;
    if (rejectedLookups.get(context)?.has(params.integrationId)) return;
    if (!context.nodeExecutionId) {
      // Engine must populate nodeExecutionId before dispatching a handler.
      // If this fires in production it means IntegrationUsageLog rows are
      // being dropped silently — surface it once so the gap is caught.
      if (!warnedMissingNodeExecutionId) {
        warnedMissingNodeExecutionId = true;
        logger.warn(
          'ExecutionContext.nodeExecutionId missing — IntegrationUsageLog rows will be skipped for this call.',
        );
      }
      return;
    }
    // B-5-6: logUsage 실패 (예: db down) 가 노드 실행 자체를 깨면 안 된다.
    // logUsage 는 진단/관측 용도이며, 우선 사용자 노드 실행 성공/실패는
    // 보존하고 logUsage 실패는 warn 로그로만 surface.
    try {
      await this.integrationsService.logUsage({
        integrationId: params.integrationId,
        nodeExecutionId: context.nodeExecutionId,
        workflowId: context.workflowId,
        status: params.status,
        durationMs: params.durationMs,
        error: params.error ?? null,
        api: params.api,
      });
    } catch (err) {
      logger.warn(
        `logUsage failed for integration ${params.integrationId} (status=${params.status}) — swallowing to avoid crashing node execution: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

export class IntegrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

/**
 * Sanitizes an arbitrary thrown value for recording in IntegrationUsageLog.
 * Prefers the structured `IntegrationError` code/message pair, otherwise
 * extracts a safe string from the error and masks credential-like tokens
 * so that pg / nodemailer messages don't leak secrets
 * into activity logs.
 */
export function toLogError(err: unknown): {
  code: string;
  message: string;
} {
  if (err instanceof IntegrationError) {
    return { code: err.code, message: sanitizeMessage(err.message) };
  }

  return {
    code: 'INTEGRATION_CALL_FAILED',
    message: sanitizeMessage(err instanceof Error ? err.message : String(err)),
  };
}

/**
 * Redacts likely secret tokens from free-form error messages. Intentionally
 * conservative — we match common secret-looking patterns (long hex/base64
 * strings, `password=…`, `Bearer …`) and replace them with `***`.
 */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // password=..., pwd=..., secret=..., token=..., api_key=..., apikey=...
  [/((?:password|pwd|secret|token|api[_-]?key)=)[^&\s"']+/gi, '$1***'],
  // Bearer / Basic Authorization header fragments
  [/(Bearer|Basic)\s+[A-Za-z0-9+/=._-]{8,}/g, '$1 ***'],
  // Long opaque hex/base64-ish blobs (24+ chars)
  [/(?<![A-Za-z0-9+/=._-])[A-Za-z0-9+/=]{32,}(?![A-Za-z0-9+/=])/g, '***'],
];

export function sanitizeMessage(input: string): string {
  let out = input;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Config-echo sanitisation. Handlers that emit `config` on
 * `NodeHandlerOutput` should pass the echoed snapshot through this helper
 * so `password` / `apiKey` / `token` / `secret` / `accessToken` fields
 * never land in the structured cache, even if the caller carelessly
 * spreads the original config. CONVENTIONS §7 — "자격증명 / 시크릿은 절대
 * 노출 금지".
 */
const CREDENTIAL_KEYS = new Set([
  'password',
  'pwd',
  'apiKey',
  'api_key',
  'apikey',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'secret',
  'clientSecret',
  'client_secret',
  'privateKey',
  'private_key',
]);

export function sanitizeConfigEcho<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    const arr = value as unknown[];
    return arr.map((v) => sanitizeConfigEcho(v)) as unknown as T;
  }
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (CREDENTIAL_KEYS.has(k)) {
      out[k] = '***';
    } else {
      out[k] = sanitizeConfigEcho(v);
    }
  }
  return out as unknown as T;
}
