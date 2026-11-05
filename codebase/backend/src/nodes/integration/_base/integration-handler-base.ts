import { Logger } from '@nestjs/common';
import { IntegrationsService } from '../../../modules/integrations/integrations.service.js';
import { Integration } from '../../../modules/integrations/entities/integration.entity.js';
import {
  isLiteralReference,
  type IntegrationUse,
} from '../../../modules/integrations/personal-integration-use.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

const logger = new Logger('IntegrationHandlerBase');
let warnedMissingNodeExecutionId = false;

/**
 * Shared helpers for node handlers that read Integration credentials and
 * attribute calls to the IntegrationUsageLog via the execution context.
 *
 * Handlers call:
 *  - `acquireIntegration(...)` to fetch the Integration entity (1·2단계)
 *  - `assertUsable(...)` to validate its type and status (3단계)
 *  - `logUsage(integration, ...)` to record success/failure for the Activity tab
 *
 * 활동 로그는 얻은 통합에만 남긴다(REQ-INTMGMT-053 · 062). `logUsage` 는 통합 ID 대신 `acquireIntegration` 이 돌려준
 * 통합을 받으므로 통합을 얻기 전에 끝난 실행(워크스페이스 확인 실패, 조회 거절, 조회 중 일시 오류, 자격 증명 읽기 실패)은
 * 넘길 통합이 없어 기록되지 않는다. 핸들러는 얻은 통합을 들고 있다가 3단계 이후의 실패도 그 통합으로 기록한다.
 */
export interface IntegrationUsageParams {
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

  /**
   * 통합을 얻는다(1·2단계). 지금 노드와 참조 값이 리터럴이었는지를 `use` 로 넘긴다. 리터럴인지는 평가 전 원본
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
    return this.integrationsService.getForExecution(
      integrationId,
      workspaceId,
      use,
    );
  }

  /** 얻은 통합이 노드가 기대한 유형이고 연결된 상태인지 본다(3단계). */
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

  /** `integration` 은 `acquireIntegration` 이 돌려준 통합이다(6단계). */
  protected async logUsage(
    integration: Integration,
    context: ExecutionContext,
    params: IntegrationUsageParams,
  ): Promise<void> {
    if (!this.integrationsService) return;
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
      await this.integrationsService.logUsage(integration, {
        nodeExecutionId: context.nodeExecutionId,
        workflowId: context.workflowId,
        status: params.status,
        durationMs: params.durationMs,
        error: params.error ?? null,
        api: params.api,
      });
    } catch (err) {
      logger.warn(
        `logUsage failed for integration ${integration.id} (status=${params.status}) — swallowing to avoid crashing node execution: ${err instanceof Error ? err.message : String(err)}`,
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
