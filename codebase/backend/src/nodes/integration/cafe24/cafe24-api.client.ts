import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Integration } from '../../../modules/integrations/entities/integration.entity.js';
import {
  CAFE24_REFRESH_JOB,
  CAFE24_REFRESH_QUEUE,
  CAFE24_REFRESH_QUEUE_EVENTS,
  Cafe24RefreshJobData,
  REFRESH_JOB_WAIT_TIMEOUT_MS,
} from '../../../modules/integrations/cafe24-token-refresh.constants.js';
import { sanitizeLastErrorMessage } from '../../../modules/integrations/integration-oauth.service.js';
import { parseJwtExp } from '../../../modules/integrations/jwt-exp.js';
import { normalizeCafe24IsoTimezone } from '../../../modules/integrations/cafe24-token-utils.js';
import { IntegrationActionRequiredNotifier } from '../../../modules/integrations/integration-action-required-notifier.service.js';
import {
  extractCafe24ScopeTokens,
  pickRestrictedApprovalScopes,
} from './metadata/restricted-approval.js';

/**
 * Optional DI tokens for swapping the network / sleep primitives in tests.
 * Production never binds these — NestJS resolves them as `undefined` via
 * `@Optional()` and the constructor falls back to `defaultFetch` /
 * `defaultSleep`. Using a string token (not the constructor's TS `typeof
 * fetch` reflection) is what stops `UnknownDependenciesException` —
 * NestJS otherwise tries to look up a provider keyed on the bare
 * `Function` metadata.
 */
export const CAFE24_FETCH_IMPL = 'CAFE24_FETCH_IMPL';
export const CAFE24_SLEEP_IMPL = 'CAFE24_SLEEP_IMPL';

/**
 * Cafe24 Admin API client wrapper.
 *
 * Responsibilities (spec/4-nodes/4-integration/4-cafe24.md §4·§4.1):
 * - Build `https://{mall_id}.cafe24api.com/api/v2/admin/{path}` URLs from
 *   metadata-driven path templates.
 * - Inject `Authorization: Bearer {access_token}` and refresh the token
 *   in-place (atomic 4-field UPDATE) when it expires within 60s.
 * - Honour Cafe24 leaky-bucket rate limits — `X-Cafe24-Call-Remain` /
 *   `X-Cafe24-Time-Remain` driven backoff with up to 2 retries on 429.
 * - Serialise concurrent calls per Integration via an in-process mutex so
 *   the workflow node and the AI Agent MCP bridge can share the same
 *   rate-limit bucket without overdrive (single-pod scope — Cafe24's
 *   leaky bucket is per-app+per-mall so cross-pod serialization is not
 *   required for rate limits). Refresh operations, by contrast, MUST be
 *   serialized cluster-wide because Cafe24 invalidates the previous
 *   refresh_token on every rotation — see `refreshViaQueue` (BullMQ
 *   `jobId = integrationId` dedup for proactive/background; unique jobId
 *   + DB pessimistic_write lock for reactive_401, spec §9.6 resolution).
 * - Translate 401/403 into an atomic Integration.status transition to
 *   `error(auth_failed)` (spec §6.1).
 */

export type Cafe24Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface Cafe24CallOptions {
  method: Cafe24Method;
  /** Template path (e.g. `products/{product_no}`) with placeholders already substituted. */
  path: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  /** Per-call timeout. Defaults to 30s. */
  timeoutMs?: number;
}

export interface Cafe24CallResult {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  callUsage?: number;
  callRemain?: number;
  timeUsage?: number;
  timeRemain?: number;
  callLimit?: string;
  retries: number;
}

export class Cafe24RateLimitedError extends Error {
  readonly code = 'CAFE24_RATE_LIMITED';
  constructor(
    readonly retries: number,
    readonly lastRetryAfterSec: number,
    readonly mallId: string,
  ) {
    super(
      `Cafe24 leaky bucket exhausted after ${retries} retries (mall=${mallId})`,
    );
    this.name = 'Cafe24RateLimitedError';
  }
}

export class Cafe24AuthFailedError extends Error {
  readonly code = 'CAFE24_AUTH_FAILED';
  constructor(
    readonly status: 401 | 403,
    readonly mallId: string,
    readonly responseBody: unknown,
  ) {
    const summary = summarizeCafe24ErrorBody(responseBody);
    const suffix = summary ? ` — ${summary}` : '';
    super(
      `Cafe24 authentication failed (${status}) for mall ${mallId}${suffix}`,
    );
    this.name = 'Cafe24AuthFailedError';
  }
}

/**
 * Extract a compact, user-actionable summary from Cafe24's error body.
 * Cafe24 wraps errors in several shapes depending on which API/endpoint
 * surface — try each one in order. The summary surfaces on the
 * `Cafe24AuthFailedError.message` so the MCP error response carries the
 * real cause ("INVALID_TOKEN: Access token has expired") rather than a
 * generic "authentication failed (403)". Tokens never appear in Cafe24's
 * error bodies, so it's safe to forward.
 */
function summarizeCafe24ErrorBody(body: unknown): string {
  if (body === null || body === undefined) return '';
  if (typeof body === 'string') return body.slice(0, 200);
  if (typeof body !== 'object') return '';
  const b = body as Record<string, unknown>;
  const errorObj =
    typeof b.error === 'object' && b.error !== null
      ? (b.error as Record<string, unknown>)
      : null;
  const code =
    pickString(b.error_code) ||
    (errorObj && pickString(errorObj.code)) ||
    (typeof b.error === 'string' ? b.error : null);
  const message =
    pickString(b.error_message) ||
    (errorObj && pickString(errorObj.message)) ||
    pickString(b.error_description) ||
    pickString(b.message);
  if (code && message) return `${code}: ${message}`.slice(0, 200);
  if (code) return code.slice(0, 200);
  if (message) return message.slice(0, 200);
  // Fall back to a JSON snippet — last resort so we never silently drop
  // diagnostic info on an unfamiliar shape.
  try {
    return JSON.stringify(body).slice(0, 200);
  } catch {
    return '';
  }
}

function pickString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Convert a thrown error from `pingConnection` 내부 단계 into the same
 * `IntegrationTestResult` shape the surrounding flow returns. Keeps the
 * "never throws" contract centralised and avoids 3 copies of the same
 * try/catch ladder.
 *
 * 알려진 종류:
 * - `Cafe24AuthFailedError` (401/403 — refresh 단계 또는 자격증명 불완전 시)
 * - `Cafe24TransportFailedError` (refresh fetch 실패)
 * - `Cafe24IncompleteCredentialsError` (assertCredentials)
 * 그 외 unknown 은 transport 실패로 분류 (best-effort — pingConnection 의
 * "never throws" 계약을 위해 silently swallow 하지 않고 메시지를 surface).
 */
function mapPingError(err: unknown): {
  success: false;
  code: string;
  message: string;
} {
  if (err instanceof Cafe24AuthFailedError) {
    return { success: false, code: 'CAFE24_AUTH_FAILED', message: err.message };
  }
  if (err instanceof Cafe24IncompleteCredentialsError) {
    return {
      success: false,
      code: 'INTEGRATION_INCOMPLETE',
      message: err.message,
    };
  }
  if (err instanceof Cafe24TransportFailedError) {
    return {
      success: false,
      code: 'CAFE24_TRANSPORT_FAILED',
      message: err.message,
    };
  }
  return {
    success: false,
    code: 'CAFE24_TRANSPORT_FAILED',
    message: extractErrorMessage(err),
  };
}

export class Cafe24TransportFailedError extends Error {
  readonly code = 'CAFE24_TRANSPORT_FAILED';
  constructor(readonly cause: unknown) {
    super(extractErrorMessage(cause));
    this.name = 'Cafe24TransportFailedError';
  }
}

export class Cafe24IncompleteCredentialsError extends Error {
  readonly code = 'INTEGRATION_INCOMPLETE';
  constructor(reason: string) {
    super(`Cafe24 credentials incomplete: ${reason}`);
    this.name = 'Cafe24IncompleteCredentialsError';
  }
}

interface Cafe24Credentials {
  mall_id?: string;
  app_type?: 'public' | 'private';
  client_id?: string;
  client_secret?: string;
  access_token?: string;
  refresh_token?: string;
  scopes?: string[];
  expires_at?: string;
  cafe24_operator_id?: string;
}

export const REFRESH_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_RETRIES = 2;

/**
 * HTTP methods whose body must be Cafe24-envelope-wrapped before send.
 * DELETE is intentionally excluded — see callsite in
 * `executeWithRateLimit`.
 */
const WRITE_METHODS_WITH_ENVELOPE: ReadonlySet<Cafe24Method> = new Set([
  'POST',
  'PUT',
]);

/**
 * Internal helper — a Promise chain keyed by Integration ID acts as a
 * mutex. Each `call()` chains its work onto the existing tail so only one
 * fetch per Integration is in-flight at a time within this process.
 */
const integrationLocks = new Map<string, Promise<unknown>>();

function withIntegrationLock<T>(
  integrationId: string,
  task: () => Promise<T>,
): Promise<T> {
  const prev = integrationLocks.get(integrationId) ?? Promise.resolve();
  const next = prev.then(task, task);
  const tracked = next.catch(() => undefined);
  integrationLocks.set(integrationId, tracked);
  // Best-effort cleanup once this work is the tail. Use the *tracked*
  // (catch-handled) promise as the chain root so finally never observes
  // an unhandled rejection, and explicitly swallow any error so the
  // cleanup chain itself stays non-throwing.
  tracked
    .finally(() => {
      if (integrationLocks.get(integrationId) === tracked) {
        integrationLocks.delete(integrationId);
      }
    })
    .catch(() => undefined);
  return next;
}

@Injectable()
export class Cafe24ApiClient {
  private readonly logger = new Logger(Cafe24ApiClient.name);
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly refreshQueue: Queue<Cafe24RefreshJobData> | null;
  private readonly refreshQueueEvents: QueueEvents | null;

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly dataSource: DataSource,
    // `@Optional() @Inject(token)` keeps NestJS from trying to resolve
    // `typeof fetch` / `Function` as a real provider. Bare default-value
    // constructor params trip `UnknownDependenciesException` in the
    // production DI graph (TS default values are invisible to the
    // `design:paramtypes` reflection metadata). Tests construct the
    // client directly with positional arguments and bypass DI entirely.
    @Optional() @Inject(CAFE24_FETCH_IMPL) fetchImpl?: typeof fetch,
    @Optional()
    @Inject(CAFE24_SLEEP_IMPL)
    sleepImpl?: (ms: number) => Promise<void>,
    // BullMQ refresh queue — production binds via Cafe24Module so refresh
    // operations serialize cross-instance (spec §9.6 trade-off resolution).
    // Tests construct the client without the queue and fall through to the
    // legacy in-process refresh path; existing test fixtures need no
    // BullMQ stubbing.
    @Optional()
    @InjectQueue(CAFE24_REFRESH_QUEUE)
    refreshQueue?: Queue<Cafe24RefreshJobData>,
    @Optional()
    @Inject(CAFE24_REFRESH_QUEUE_EVENTS)
    refreshQueueEvents?: QueueEvents,
    // A-1: integration_action_required 알림 발사기. @Optional 로 두어
    // 옛 테스트 (notifier 없이 직접 생성) 가 깨지지 않게 한다.
    @Optional()
    private readonly actionRequiredNotifier?: IntegrationActionRequiredNotifier,
  ) {
    this.fetchImpl = fetchImpl ?? defaultFetch;
    this.sleepImpl = sleepImpl ?? defaultSleep;
    this.refreshQueue = refreshQueue ?? null;
    this.refreshQueueEvents = refreshQueueEvents ?? null;
  }

  async call(
    integration: Integration,
    opts: Cafe24CallOptions,
  ): Promise<Cafe24CallResult> {
    return withIntegrationLock(integration.id, async () => {
      const creds = (integration.credentials ?? {}) as Cafe24Credentials;
      this.assertCredentials(creds);

      // Refresh proactively if the token expires within the window.
      await this.ensureFreshToken(integration);

      // Re-read credentials after potential refresh.
      const accessToken =
        ((integration.credentials ?? {}) as Cafe24Credentials).access_token ??
        creds.access_token!;
      const mallId = creds.mall_id!;

      return this.executeWithRateLimit(
        integration,
        mallId,
        accessToken,
        opts,
        0,
      );
    });
  }

  /**
   * 사용자 진단용 연결 테스트. spec/2-navigation/4-integration.md §5.8 의
   * `GET /api/v2/admin/apps` 핑으로 access_token 의 유효성을 확인한다.
   *
   * `call()` 과 다른 점:
   * - 401 시 즉시 `markAuthFailed` 를 발사하지 않고 명시적으로 refresh 후
   *   1회 재시도. proactive `ensureFreshToken` 이 race condition 으로 빗나간
   *   stale token 을 자가 회복한다.
   * - 401 재시도도 실패하면 토큰 자체 문제로 확정해 `markAuthFailed` 로
   *   `error(auth_failed)` 전이.
   * - 403 은 어느 시점이든 status 격하하지 않고 메시지만 전달 (스코프
   *   부족·앱 미설치는 사용자가 reauth/scope 추가로 해결).
   * - transport 실패는 `consecutive_network_failures` 카운터에 합산하지
   *   않는다. 사용자가 직접 누른 진단 호출이라 노드 자동 호출의 신호로
   *   섞여서는 안 된다.
   *
   * **never throws** — 자격증명 누락·refresh 실패·HTTP 실패·transport 실패
   * 모두 `{ success: false, code, message }` 형태로 변환해 반환한다.
   *
   * 잠금 의미: `withIntegrationLock` 은 task 단위 promise-chain 직렬화이며,
   * task 내부에서 호출하는 `ensureFreshToken`/`refreshAccessToken`/`rawPing`
   * 은 락을 다시 잡지 않는다. `call()` 도 동일 패턴이므로 재진입 데드락
   * 위험은 없다.
   */
  async pingConnection(
    integration: Integration,
  ): Promise<{ success: boolean; code?: string; message?: string }> {
    return withIntegrationLock(integration.id, async () => {
      let creds: Cafe24Credentials;
      try {
        creds = (integration.credentials ?? {}) as Cafe24Credentials;
        this.assertCredentials(creds);
      } catch (err) {
        // assertCredentials 가 throw 하는 경로도 테스트 결과로 변환해야
        // "never throws" 계약을 지킨다.
        return mapPingError(err);
      }

      // 1차: proactive refresh window 안이면 미리 갱신.
      try {
        await this.ensureFreshToken(integration);
      } catch (err) {
        return mapPingError(err);
      }

      const mallId = creds.mall_id!;

      // 2차: /apps 핑.
      const first = await this.rawPing(
        mallId,
        this.currentAccessToken(integration),
      );
      if (first.kind === 'success') return { success: true };
      if (first.kind === 'transport') {
        return {
          success: false,
          code: 'CAFE24_TRANSPORT_FAILED',
          message: first.message,
        };
      }
      if (first.status === 403) {
        return {
          success: false,
          code: 'CAFE24_INSUFFICIENT_SCOPE',
          message: this.formatAuthFailure(first.status, mallId, first.body),
        };
      }
      // status === 401: 명시적 refresh 후 1회 재시도.
      try {
        await this.refreshAccessToken(integration);
      } catch (err) {
        return mapPingError(err);
      }

      const second = await this.rawPing(
        mallId,
        this.currentAccessToken(integration),
      );
      if (second.kind === 'success') return { success: true };
      if (second.kind === 'transport') {
        return {
          success: false,
          code: 'CAFE24_TRANSPORT_FAILED',
          message: second.message,
        };
      }
      if (second.status === 403) {
        // 1차와 동일하게 status 격하하지 않음.
        return {
          success: false,
          code: 'CAFE24_INSUFFICIENT_SCOPE',
          message: this.formatAuthFailure(second.status, mallId, second.body),
        };
      }
      // 재시도도 401 — 토큰 자체 문제로 확정. status 격하.
      if (second.status === 401) {
        await this.markAuthFailed(integration);
      }
      return {
        success: false,
        code: 'CAFE24_AUTH_FAILED',
        message: this.formatAuthFailure(second.status, mallId, second.body),
      };
    });
  }

  private currentAccessToken(integration: Integration): string {
    const creds = (integration.credentials ?? {}) as Cafe24Credentials;
    return creds.access_token!;
  }

  /** Per-call timeout for the diagnostic ping. Matches `call()` 의 30초. */
  private static readonly PING_TIMEOUT_MS = 30_000;

  /**
   * 단일 fetch — 카운터·status 격하 부작용 없는 raw probe. pingConnection 의
   * 401 retry 분기를 명시적으로 제어하기 위해 executeWithRateLimit 와 분리.
   *
   * Discriminated union return:
   * - `kind: 'success'` — HTTP 2xx
   * - `kind: 'http'` — HTTP 응답이 왔으나 비-2xx (status·body 동봉)
   * - `kind: 'transport'` — fetch 자체 실패 (network·timeout)
   */
  private async rawPing(
    mallId: string,
    accessToken: string,
  ): Promise<
    | { kind: 'success' }
    | { kind: 'http'; status: number; body: unknown }
    | { kind: 'transport'; message: string }
  > {
    const url = this.buildUrl(mallId, 'apps');
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Cafe24ApiClient.PING_TIMEOUT_MS,
    );
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (err) {
      return { kind: 'transport', message: extractErrorMessage(err) };
    } finally {
      clearTimeout(timer);
    }
    if (response.ok) return { kind: 'success' };
    const body = await safeReadJson(response);
    return { kind: 'http', status: response.status, body };
  }

  /** Single-line summary of an auth failure for the test result message. */
  private formatAuthFailure(
    status: number,
    mallId: string,
    body: unknown,
  ): string {
    const summary = summarizeCafe24ErrorBody(body);
    const suffix = summary ? ` — ${summary}` : '';
    return `Cafe24 authentication failed (${status}) for mall ${mallId}${suffix}`;
  }

  private assertCredentials(creds: Cafe24Credentials): void {
    if (!creds.mall_id) {
      throw new Cafe24IncompleteCredentialsError('mall_id is missing');
    }
    if (!creds.access_token) {
      throw new Cafe24IncompleteCredentialsError('access_token is missing');
    }
    if (!creds.refresh_token) {
      throw new Cafe24IncompleteCredentialsError('refresh_token is missing');
    }
    if (creds.app_type === 'private') {
      if (!creds.client_id || !creds.client_secret) {
        throw new Cafe24IncompleteCredentialsError(
          'private app requires client_id and client_secret',
        );
      }
    }
  }

  /**
   * If the token is missing or within REFRESH_WINDOW_MS of expiry, exchange
   * the refresh_token and atomically update credentials + tokenExpiresAt.
   *
   * Source of truth for the expiry instant is `Integration.tokenExpiresAt`
   * (spec/2-navigation/4-integration.md §10.5 — the canonical column the
   * atomic refresh writes). The mirror at `credentials.expires_at` is kept
   * in sync by the refresh path and the OAuth callback path, but older
   * rows or non-cafe24 flows may have a NULL mirror — falling back to the
   * entity column ensures proactive refresh fires for those too. Without
   * this fallback, a freshly-connected integration whose initial callback
   * only set the column would silently skip refresh forever and surface
   * a 401 (`access_token time expired`) on the first call after Cafe24's
   * 2h TTL.
   *
   * **Cross-instance race protection:** when a BullMQ refresh queue is
   * bound (production), the actual refresh is delegated to the queue with
   * `jobId = integrationId` so two pods cannot fire `/oauth/token` with
   * the same old refresh_token simultaneously. The caller waits for the
   * worker to finish, then re-reads the integration row from the DB to
   * see the refreshed credentials. When no queue is bound (unit tests),
   * the legacy in-process refresh path runs — same correctness, single
   * pod.
   *
   * Returns silently on success; throws Cafe24AuthFailedError on refresh
   * failure (caller treats as `error(auth_failed)` state transition).
   */
  private async ensureFreshToken(integration: Integration): Promise<void> {
    const expiresAtMs = resolveTokenExpiry(integration);
    const mallId =
      (integration.credentials as Cafe24Credentials | null | undefined)
        ?.mall_id ?? 'unknown';
    // 옛 코드는 `expiresAtMs === null` 일 때 silently return 했다. 그 결과,
    // OAuth callback 단계가 `expires_in` 만 읽어 cafe24 응답에서 NULL 로
    // 저장된 row 가 영영 refresh 되지 않아 2h 후 첫 호출에서 `access_token
    // time expired (401)` 로 좌초했다 (사용자 보고 2026-05-17). callback 측
    // 픽스 (`parseTokenExpiresAt` — cafe24 `expires_at` 파싱 + 2h fallback)
    // 와 함께, 이미 DB 에 NULL 로 저장된 통합도 다음 호출 시 자가 회복되도록
    // null 을 "needs refresh" 로 해석한다. cafe24 는 항상 access_token 에
    // 만료가 있어 (Cafe24 docs) NULL 은 정상 상태가 아님.
    if (expiresAtMs !== null && expiresAtMs - Date.now() > REFRESH_WINDOW_MS) {
      // 정상 경로 — 매 API 호출마다 발사되므로 debug 레벨로 noise 최소화.
      // ttlSec 은 운영 디버깅 시 "이 통합의 token 잔여 시간" 확인용.
      this.logger.debug(
        `Cafe24 token fresh — skip refresh (integrationId=${integration.id} mall_id=${mallId} ttlSec=${Math.floor((expiresAtMs - Date.now()) / 1000)})`,
      );
      return;
    }

    // Refresh trigger — 발사 빈도가 낮고 (access_token 2h 마다 1회 정도)
    // 운영 인사이트 가치가 높아 info(log) 레벨. ttlSec=null 은 OAuth callback
    // 잔재 케이스 (위 주석 참고).
    const ttlLabel =
      expiresAtMs === null
        ? 'null'
        : `${Math.floor((expiresAtMs - Date.now()) / 1000)}`;
    this.logger.log(
      `Cafe24 token expiring or null — proactive refresh (integrationId=${integration.id} mall_id=${mallId} ttlSec=${ttlLabel} source=proactive)`,
    );

    if (this.refreshQueue && this.refreshQueueEvents) {
      await this.refreshViaQueue(integration, 'proactive');
      return;
    }
    await this.refreshAccessToken(integration);
  }

  /**
   * Cross-instance-safe refresh path.
   *
   * **proactive/background**: Enqueues with `jobId = integration.id`. BullMQ
   * rejects duplicate jobIds while the existing job is in waiting/active state
   * and returns the existing job reference instead, so concurrent callers
   * (within the same pod or across pods) all wait on the same worker execution.
   *
   * **reactive_401**: Enqueues with a unique jobId
   * (`${integrationId}#reactive-${Date.now()}-${rand}`) to bypass BullMQ dedup
   * entirely — a completed proactive job with the same integration.id would
   * otherwise be returned as-is and skip the worker. Cross-pod serialization
   * falls back to the pessimistic_write row lock inside `refreshAccessToken`.
   *
   * After the worker completes, we re-read the integration row from the DB and
   * mutate the caller's reference so the subsequent `executeWithRateLimit` sees
   * the refreshed bearer.
   *
   * **Side-effect contract** (caller invariant): on successful return, the
   * caller's `integration.credentials.access_token` IS guaranteed to be
   * the freshly-issued token — both this method and `refreshAccessToken`
   * re-fetch the row from the DB and mutate the live entity. Callers that
   * read `integration.credentials.access_token` immediately after refresh
   * can rely on it without additional DB round-trips.
   *
   * If the worker called `markAuthFailed` (refresh_token invalid), the
   * fresh row carries `status='error'` — surface as Cafe24AuthFailedError
   * to keep call() error semantics consistent with the in-process path.
   */
  private async refreshViaQueue(
    integration: Integration,
    source: Cafe24RefreshJobData['source'],
  ): Promise<void> {
    const queue = this.refreshQueue!;
    const events = this.refreshQueueEvents!;
    // 2026-05-21 — reactive_401 만 jobId 를 unique 화하여 BullMQ 의 completed/failed
    // job dedup 자체를 우회한다. 옛 fix (`removeOnComplete: { age: 0 }`) 는 신규
    // job 이 생성될 때만 적용되는 옵션이라, 같은 jobId 의 기존 completed job 이
    // Redis 에 있으면 `Queue.add()` 가 그 기존 job 참조를 그대로 반환하여 worker
    // 가 새로 돌지 않는 회귀가 있었다 (검증: `bullmq/dist/cjs/commands/
    // addStandardJob-9.lua:22-27` — `EXISTS jobIdKey → handleDuplicatedJob`,
    // 신규 options 적용 없음). caller 가 empirical 401 을 받았다는 강한 신호인
    // reactive_401 경로는 worker 가 반드시 새로 돌아야 하므로 jobId 자체를
    // unique 하게 만들어 dedup 우회.
    //
    // **cross-pod serialization trade-off**: unique jobId 채택 시 두 pod 가 동시에
    // empirical 401 을 받으면 worker 가 둘 다 돈다. 그러나 (a) caller-side `withIntegrationLock`
    // 이 in-process 직렬화하고, (b) `refreshAccessToken` 의 `dataSource.transaction`
    // 안 pessimistic_write row lock 이 PostgreSQL 레벨에서 직렬화하며, (c) proactive
    // 가 정상 작동하면 reactive_401 발생 자체가 매우 드물어 cross-pod 동시 401 은
    // 사실상 발생하지 않는다. 동시 401 이 발생하더라도 한 pod 의 refresh 만 성공
    // 하고 다른 pod 은 invalid_grant 격하 → 사용자 reauth 로 회복 가능한 fail-safe
    // 결과. "dedup 회귀로 refresh 가 영원히 안 되는" 위험보다 훨씬 작은 비용.
    //
    // proactive / background 는 기존 `jobId = integrationId` dedup 유지 — proactive
    // 는 정상 path 마다 발사되므로 dedup 이 thundering herd / refresh_token race 의
    // 핵심 보호막이고, jobId 충돌이 회귀 위험이 아니라 의도된 직렬화 메커니즘.
    // spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 만료 SoT — JWT
    // exp 격상 (2026-05-18)" 의 후속 보강.
    const jobId =
      source === 'reactive_401'
        ? `${integration.id}#reactive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : integration.id;
    const job = await queue.add(
      CAFE24_REFRESH_JOB,
      { integrationId: integration.id, source },
      {
        jobId,
        // attempts:1 because refresh failures (invalid_grant) are terminal
        // — retrying replays the same 401 and just floods the alert path.
        attempts: 1,
        // Keep completed jobs briefly so concurrent `add()` from a slow
        // caller still resolves to a real job reference; the next refresh
        // round (≥1h later in normal use) will not collide. reactive_401
        // 도 unique jobId 라 같은 retention 으로 통일.
        removeOnComplete: { age: 60 },
        removeOnFail: { age: 300 },
      },
    );

    try {
      await job.waitUntilFinished(events, REFRESH_JOB_WAIT_TIMEOUT_MS);
    } catch (err) {
      // waitUntilFinished resolves on completion and rejects on failure or
      // timeout. **Critical race**: in a multi-pod cluster the worker can
      // complete the refresh on Pod B while Pod A's `waitUntilFinished` is
      // still pending — if QueueEvents misses the `completed` event (Redis
      // hiccup, brief network blip) Pod A times out **even though the
      // refresh was successful and the DB row carries a fresh token**.
      //
      // Re-fetch the integration and consult the DB state directly:
      // 1. `status='error', statusReason='auth_failed'` — worker called
      //    markAuthFailed (refresh_token invalid). Surface canonical error.
      // 2. `tokenExpiresAt > now + REFRESH_WINDOW_MS` — token IS fresh,
      //    worker succeeded but the event was lost. Treat as success,
      //    fall through to caller mutation below.
      // 3. Otherwise — genuine transport failure. Throw.
      //
      // Without this fall-through, the caller's stale `integration`
      // reference is used in any retry → old access_token → 401 →
      // `markAuthFailed` → the integration the worker just refreshed
      // gets demoted to `error(auth_failed)` (CONC-1).
      const fresh = await this.integrationRepository.findOne({
        where: { id: integration.id },
      });
      if (fresh?.status === 'error' && fresh.statusReason === 'auth_failed') {
        const mallId =
          (fresh.credentials as Cafe24Credentials | undefined)?.mall_id ??
          integration.id;
        throw new Cafe24AuthFailedError(401, mallId, fresh.lastError);
      }
      const freshExpiry = fresh ? resolveTokenExpiry(fresh) : null;
      if (
        !fresh ||
        fresh.status !== 'connected' ||
        freshExpiry === null ||
        freshExpiry - Date.now() <= REFRESH_WINDOW_MS
      ) {
        throw new Cafe24TransportFailedError(err);
      }
      // Worker actually succeeded — the timeout was spurious. Log a
      // debug breadcrumb and fall through (the post-try block below will
      // re-fetch and mutate the caller).
      this.logger.debug(
        `Cafe24 refresh worker succeeded for ${integration.id} but waitUntilFinished timed out — recovered via DB re-read`,
      );
    }

    // Worker succeeded (either via QueueEvents or via the fall-through
    // above). Re-fetch from DB and mutate the caller's reference so the
    // next stage of call() sees the refreshed bearer.
    const fresh = await this.integrationRepository.findOne({
      where: { id: integration.id },
    });
    if (!fresh) {
      throw new Cafe24TransportFailedError(
        new Error('Integration vanished during refresh'),
      );
    }
    integration.credentials = fresh.credentials;
    integration.tokenExpiresAt = fresh.tokenExpiresAt;
    integration.status = fresh.status;
    integration.statusReason = fresh.statusReason;
    integration.lastError = fresh.lastError;
  }

  /**
   * Spec §6.1 / §5.8 의 401 자가 회복 공통 helper — `executeWithRateLimit`
   * (노드/MCP 실행 경로) 와 `pingConnection` (연결 테스트 경로) 가 같은
   * refresh+1회 retry 정책을 공유하기 위한 단일 진입점.
   *
   * 동작:
   * - BullMQ refresh 큐가 바인딩되어 있으면 `refreshViaQueue('reactive_401')`.
   *   2026-05-21 갱신 — reactive_401 은 `jobId` 자체를 `${integrationId}#reactive-...`
   *   로 unique 화하여 BullMQ 의 completed/failed job dedup 을 우회. caller 가
   *   empirical 401 을 받았다는 강한 신호이므로 worker 가 반드시 새로 돌아야
   *   하며, 같은 `integrationId` 의 기존 completed proactive/background job 이
   *   Redis 에 잔존해 worker 호출을 무력화하는 회귀를 차단. cross-pod 직렬화는
   *   `refreshAccessToken` 의 row-level pessimistic_write lock 으로 폴백 보호.
   *   source `'reactive_401'` 은 worker 의 short-circuit guard 도 skip 시킨다
   *   (`Cafe24TokenRefreshProcessor.process`). spec/2-navigation/4-integration.md
   *   ## Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)".
   * - 큐 미바인딩 (테스트 환경) 시 in-process `refreshAccessToken`. 프로덕션
   *   환경은 항상 큐 바인딩 — DI 미주입은 deployment 오류로 간주.
   *
   * **Side-effect contract**: 정상 return 후 `integration.credentials
   * .access_token` 은 새 토큰으로 갱신됨. caller 는 별도 DB round-trip 없이
   * `integration.credentials.access_token` 을 그대로 다음 호출에 사용 가능.
   *
   * **에러 의미**: refresh 가 401/403 (`invalid_grant`) 으로 실패하면
   * 두 경로 모두 자체적으로 `markAuthFailed` 발사 + `Cafe24AuthFailedError`
   * throw → caller 에게 자동 propagate. caller 는 별도 catch 없이 그대로
   * throw 를 통과시키면 됨. transport 실패는 `Cafe24TransportFailedError`.
   */
  private async performAuthRefresh(integration: Integration): Promise<void> {
    if (this.refreshQueue && this.refreshQueueEvents) {
      await this.refreshViaQueue(integration, 'reactive_401');
      return;
    }
    await this.refreshAccessToken(integration);
  }

  /**
   * 외부 호출자 (현재 `Cafe24McpToolProvider.buildTools` — spec §8.6 expired
   * 자가 회복) 가 큐 경유 refresh 를 명시적으로 트리거할 수 있도록 노출한
   * public entry. proactive `ensureFreshToken` 과 reactive 401 retry 가 둘
   * 다 `refreshViaQueue` 를 거치는 것과 같은 단일 경로 (jobId dedup) 를
   * 강제한다 — direct in-process refresh path 우회 방지.
   *
   * 본 메서드의 `source` 는 BullMQ payload 의 `source` 필드로 직접 흘러가며,
   * 진단·메트릭 라벨링에 사용된다 ('proactive' / 'background'). buildTools
   * 단계 호출은 'background' 로 분류 — API 호출 직전 (`call()`) proactive 와
   * 구분되는 진입점이므로.
   *
   * 큐 미바인딩 (테스트 환경) 시 in-process `refreshAccessToken` 으로 폴백.
   * 동작·에러 의미는 `performAuthRefresh` 와 동일.
   */
  async refreshTokenViaQueue(
    integration: Integration,
    source: 'proactive' | 'background' = 'background',
  ): Promise<void> {
    if (this.refreshQueue && this.refreshQueueEvents) {
      await this.refreshViaQueue(integration, source);
      return;
    }
    // 큐 미바인딩은 테스트 환경 또는 deployment 설정 누락 신호. 운영에서
    // 발생하면 cross-pod dedup 보호가 풀린 상태이므로 가시성 확보.
    this.logger.warn(
      `cafe24 refreshQueue not bound — falling back to in-process refresh (integrationId=${integration.id}, source=${source})`,
    );
    await this.refreshAccessToken(integration);
  }

  async refreshAccessToken(integration: Integration): Promise<void> {
    const creds = (integration.credentials ?? {}) as Cafe24Credentials;
    if (!creds.mall_id || !creds.refresh_token) {
      throw new Cafe24IncompleteCredentialsError(
        'mall_id and refresh_token are required for refresh',
      );
    }

    // refresh 시작 로그 — 큐 worker 경로와 in-process fallback 둘 다 동일하게
    // 통과하므로 caller stack 으로 분기 구분. `app_type` 은 private/public 분기
    // 진단 (private 의 경우 client_id/secret 가 credentials 에 직접 저장됨).
    this.logger.log(
      `Cafe24 token refresh starting (integrationId=${integration.id} mall_id=${creds.mall_id} app_type=${creds.app_type ?? 'unknown'})`,
    );

    const { clientId, clientSecret } = this.resolveClientCredentials(creds);
    const tokenUrl = `https://${creds.mall_id}.cafe24api.com/api/v2/oauth/token`;
    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refresh_token,
    });

    let response: Response;
    try {
      response = await this.fetchImpl(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`,
          ).toString('base64')}`,
        },
        body: form.toString(),
      });
    } catch (err) {
      // REQ-C2: refresh 자체의 transport 실패도 connected 의 연속 실패에
      // 포함시킨다. spec §6 의 카운터는 "노드 실행 중 커넥션 실패" 를
      // 정의하는데, refresh 는 노드 실행의 사전 단계이므로 동일 카운터에
      // 합산하는 것이 일관적.
      await this.recordNetworkFailure(integration, err);
      throw new Cafe24TransportFailedError(err);
    }

    if (response.status === 401 || response.status === 403) {
      const body = await safeReadJson(response);
      // SEC-C2: Cafe24 가 응답에 client_secret 의 일부나 token 조각을
      // echo 하는 비정상 케이스 (운영 보고 2026-05-16) 를 대비해 운영
      // 로그에 그대로 평문 기록하지 않는다. `sanitizeLastErrorMessage`
      // 의 패턴이 적용되어 `client_secret=...`, `Bearer ...`,
      // `Authorization: ...` 등은 `***` 로 마스킹.
      const bodyForLog = sanitizeLastErrorMessage(
        typeof body === 'string'
          ? body.slice(0, 500)
          : JSON.stringify(body).slice(0, 500),
      );
      this.logger.warn(
        `Cafe24 token refresh ${response.status} (integrationId=${integration.id} mall_id=${creds.mall_id}): ${bodyForLog}`,
      );
      await this.markAuthFailed(integration);
      throw new Cafe24AuthFailedError(response.status, creds.mall_id, body);
    }
    if (!response.ok) {
      const body = await safeReadJson(response);
      // SEC-C2: 옛 코드는 raw body 를 그대로 Error message 에 넣어 throw
      // 했고, 이 message 가 `markIntegrationCallbackError` 의 lastError 에
      // 잔류하는 경로가 있었다. 직접 sanitize 후 message 에 포함.
      throw new Error(
        `Cafe24 token refresh failed (${response.status}): ${sanitizeLastErrorMessage(JSON.stringify(body))}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const accessToken = readString(data, 'access_token');
    const refreshToken = readString(data, 'refresh_token');
    if (!accessToken) {
      throw new Error('Cafe24 token refresh response missing access_token');
    }
    // 만료 시각 SoT — JWT exp 우선 (2026-05-18 갱신). Cafe24 의 access_token
    // 은 JWT 라 `exp` claim 이 RFC 7519 정의상 epoch seconds (UTC absolute)
    // 라 TZ 모호성 없음. 옛 코드는 TZ-less ISO 를 Date.parse 로 처리해 서버
    // local time 으로 해석돼 UTC 컨테이너에서 9h skew 가 발생하던 회귀를
    // 본 precedence 로 영구 차단. spec/2-navigation/4-integration.md §10.5
    // + Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)".
    //
    // precedence: JWT exp → expires_in → expires_at ISO (TZ-less 면 +09:00
    // KST 정규화) → 2h default.
    const jwtExpMs = parseJwtExp(accessToken);
    const expiresIn = readNumber(data, 'expires_in');
    const expiresAtStr = readString(data, 'expires_at');
    // M-6 fix (ai-review 2026-05-18) — normalizeCafe24IsoTimezone 이중 호출
    // 제거. expiresAtStr 가 truthy 일 때 한 번만 정규화한 뒤 그 결과를
    // Date.parse 검사·생성 모두에 재사용.
    const expiresAtMs = expiresAtStr
      ? Date.parse(normalizeCafe24IsoTimezone(expiresAtStr))
      : Number.NaN;
    const expiresAt =
      jwtExpMs !== null
        ? new Date(jwtExpMs)
        : expiresIn
          ? new Date(Date.now() + expiresIn * 1000)
          : Number.isFinite(expiresAtMs)
            ? new Date(expiresAtMs)
            : new Date(Date.now() + 2 * 60 * 60 * 1000); // Cafe24 default 2h

    // Atomic 4-field UPDATE — spec §10.5. credentials + tokenExpiresAt are
    // co-located on the Integration row so a single save() is atomic.
    // B-4-3: BullMQ jobId dedup 외에 DB row-level write lock 도 추가
    // (defense-in-depth). 같은 integrationId 의 동시 refresh 요청이 두
    // pod 에서 BullMQ dedup 우회로 도달하더라도 PostgreSQL row lock 이
    // serialize. lock 이 잠시 대기하므로 latency 영향은 작고, 잘못된 토큰
    // 덮어쓰기 위험을 0 으로 만든다.
    //
    // **cross-pod race 경계 (reactive_401 특수 케이스)**: pessimistic_write lock
    // 은 DB write 를 직렬화하지만 `/oauth/token` HTTP 호출은 lock 범위 밖에서
    // 이미 발사된다. 두 pod 이 동시에 reactive_401 을 처리하면 양쪽 모두
    // Cafe24 에 HTTP 요청을 보낼 수 있고, 첫 번째 worker 가 rotate 한 후
    // 두 번째 worker 는 stale refresh_token 으로 `invalid_grant` 를 받아
    // `markAuthFailed` 를 발사한다. 이는 의도된 trade-off — reactive_401 이
    // "refresh 가 영원히 안 되는" 회귀보다 "cross-pod 동시 401 시 reauth
    // 필요"가 훨씬 더 작은 비용이다. proactive/background 는 BullMQ
    // `jobId = integrationId` dedup 이 이 HTTP 이중 발사를 원천 차단한다.
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Integration);
      const fresh = await repo.findOne({
        where: { id: integration.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!fresh) throw new Error('Integration vanished during refresh');
      const updatedCreds: Cafe24Credentials = {
        ...((fresh.credentials ?? {}) as Cafe24Credentials),
        access_token: accessToken,
        refresh_token:
          refreshToken ??
          (fresh.credentials as Cafe24Credentials)?.refresh_token,
        expires_at: expiresAt.toISOString(),
      };
      fresh.credentials = updatedCreds as unknown as Record<string, unknown>;
      fresh.tokenExpiresAt = expiresAt;
      fresh.status = 'connected';
      fresh.statusReason = null;
      fresh.lastRotatedAt = new Date();
      await repo.save(fresh);
      // Mutate the live entity passed in so subsequent code in this call
      // chain sees the refreshed token.
      integration.credentials = updatedCreds as unknown as Record<
        string,
        unknown
      >;
      integration.tokenExpiresAt = expiresAt;
      integration.status = 'connected';
      integration.statusReason = null;
    });

    // refresh 성공 로그 — newExpiresAt 동봉으로 다음 refresh 시점 예측 가능
    // (운영 모니터링: 갱신 주기가 의도대로인지 추적). refreshTokenRotated
    // 라벨은 Cafe24 가 새 refresh_token 을 발급했는지 (rotation) 가시화 —
    // 일반적으로 매 refresh 마다 새 토큰 발급되어야 한다 (Cafe24 docs).
    this.logger.log(
      `Cafe24 token refresh succeeded (integrationId=${integration.id} mall_id=${creds.mall_id} newExpiresAt=${expiresAt.toISOString()} refreshTokenRotated=${refreshToken !== null && refreshToken !== creds.refresh_token})`,
    );
  }

  private resolveClientCredentials(creds: Cafe24Credentials): {
    clientId: string;
    clientSecret: string;
  } {
    if (creds.app_type === 'private') {
      if (!creds.client_id || !creds.client_secret) {
        throw new Cafe24IncompleteCredentialsError(
          'private app client_id/secret missing',
        );
      }
      return { clientId: creds.client_id, clientSecret: creds.client_secret };
    }
    const id = process.env.CAFE24_CLIENT_ID;
    const secret = process.env.CAFE24_CLIENT_SECRET;
    if (!id || !secret) {
      throw new Cafe24IncompleteCredentialsError(
        'CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET env missing for public app',
      );
    }
    return { clientId: id, clientSecret: secret };
  }

  /**
   * Atomically transition the Integration to `error(reason)` and emit the
   * action-required notification on first entry into that bucket.
   *
   * @param errBody Cafe24 response body from the failing 401/403 call.
   *   Required when `reason === 'insufficient_scope'` so we can populate
   *   `last_error.details.requiresCafe24Approval` from the response;
   *   ignored for plain auth failures. Other 401/403 paths (refresh
   *   loops, pre-flight pings) MUST forward the body if they have one
   *   so the UI can surface the partner-approval hint.
   *   See `spec/2-navigation/4-integration.md` §10.4 + spec/conventions/
   *   cafe24-restricted-scopes.md §4.3.
   */
  private async markAuthFailed(
    integration: Integration,
    reason: 'auth_failed' | 'insufficient_scope' = 'auth_failed',
    errBody?: unknown,
  ): Promise<void> {
    // A-1: error 도메인 신규 진입에만 알림. 이미 같은 reason 으로 error 였으면
    // 알림 emit 을 건너뛴다 (notifier 의 24h dedup 으로 추가 보호도 있음).
    const transitioning =
      integration.status !== 'error' || integration.statusReason !== reason;
    // requiresCafe24Approval — Cafe24 응답에서 mall.<read|write>_<r> 토큰을
    // 뽑아 별도 승인 명단 (`cafe24-restricted-scopes.md` §1) 과 교차한다.
    // 매칭이 비어 있으면 details 자체를 omit 해 다른 reason 의 last_error
    // shape 과 분리. spec/2-navigation/4-integration.md §10.4 정책.
    const requiresApproval =
      reason === 'insufficient_scope'
        ? pickRestrictedApprovalScopes(extractCafe24ScopeTokens(errBody))
        : undefined;
    const lastErrorDetails =
      requiresApproval !== undefined
        ? { requiresCafe24Approval: requiresApproval }
        : undefined;
    try {
      await this.integrationRepository.update(integration.id, {
        status: 'error',
        statusReason: reason,
        lastError: {
          code: 'CAFE24_AUTH_FAILED',
          message:
            reason === 'insufficient_scope'
              ? 'Cafe24 returned 403 (insufficient scope)'
              : 'Cafe24 returned 401/403',
          at: new Date().toISOString(),
          ...(lastErrorDetails ? { details: lastErrorDetails } : {}),
        },
      });
      integration.status = 'error';
      integration.statusReason = reason;
      if (transitioning && this.actionRequiredNotifier) {
        await this.actionRequiredNotifier.notify(integration, reason);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to mark Integration ${integration.id} as ${reason}: ${extractErrorMessage(err)}`,
      );
    }
  }

  /**
   * REQ-C3 — spec §6 의 `connected → error(insufficient_scope) | 403 +
   * 서비스별 missing_scope 시그널` 전이. Cafe24 가 403 응답 body 의
   * `error_code` / `error.code` / `error_message` 에 다음 시그널을 echo
   * 하는 경우 insufficient_scope 로 분기.
   *
   * 우리가 토큰 발급 단계에서 부여받지 못한 scope 를 사용하는 노드를
   * 호출하면 Cafe24 가 `403 INSUFFICIENT_SCOPE` 또는 유사 메시지를
   * 반환. 이때 사용자가 reauthorize 만 시도하면 같은 401/403 반복.
   * Spec 은 별도 statusReason 으로 UI 가 "권한 부족" 안내를 띄울 수
   * 있게 한다.
   */
  private detectInsufficientScope(errBody: unknown): boolean {
    if (errBody === null || errBody === undefined) return false;
    if (typeof errBody === 'string') {
      return /\binsufficient[_ ]?scope\b|\bmissing[_ ]?scope\b|\bINVALID[_ ]?SCOPE\b/i.test(
        errBody,
      );
    }
    if (typeof errBody !== 'object') return false;
    const b = errBody as Record<string, unknown>;
    const candidates: unknown[] = [
      b.error_code,
      b.error_message,
      b.error_description,
      b.message,
    ];
    if (typeof b.error === 'object' && b.error !== null) {
      const e = b.error as Record<string, unknown>;
      candidates.push(e.code, e.message, e.description);
    } else if (typeof b.error === 'string') {
      candidates.push(b.error);
    }
    for (const c of candidates) {
      if (typeof c !== 'string') continue;
      if (
        /\binsufficient[_ ]?scope\b|\bmissing[_ ]?scope\b|\bINVALID[_ ]?SCOPE\b/i.test(
          c,
        )
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * REQ-C2 — spec §6 의 `connected → error(network) | 3회 연속 실패` 전이.
   * fetch 가 transport 레벨에서 실패할 때 카운터를 +1 한다. 3 도달 시점에
   * status 를 `error(network)` 로 전이하고 카운터를 리셋. 카운터 리셋은
   * `resetNetworkFailures` 가 담당하며 다음 정상 응답 시 호출된다.
   */
  private async recordNetworkFailure(
    integration: Integration,
    cause: unknown,
  ): Promise<void> {
    try {
      const next = (integration.consecutiveNetworkFailures ?? 0) + 1;
      if (next >= 3) {
        await this.integrationRepository.update(integration.id, {
          status: 'error',
          statusReason: 'network',
          consecutiveNetworkFailures: 0,
          lastError: {
            code: 'CAFE24_TRANSPORT_FAILED',
            message: extractErrorMessage(cause).slice(0, 200),
            at: new Date().toISOString(),
          },
        });
        integration.status = 'error';
        integration.statusReason = 'network';
        integration.consecutiveNetworkFailures = 0;
        this.logger.warn(
          `Cafe24 integration ${integration.id} demoted to error(network) — 3 consecutive transport failures (spec §6)`,
        );
        // A-1: threshold-hit 시점만 알림 (반복 발사 없음 — counter reset 후
        // 다시 누적되어야 같은 reason 으로 재발사 가능). notifier 의 24h dedup
        // 이 추가 보호.
        if (this.actionRequiredNotifier) {
          await this.actionRequiredNotifier.notify(integration, 'network');
        }
      } else {
        await this.integrationRepository.update(integration.id, {
          consecutiveNetworkFailures: next,
        });
        integration.consecutiveNetworkFailures = next;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to record network failure for ${integration.id}: ${extractErrorMessage(err)}`,
      );
    }
  }

  private async resetNetworkFailures(integration: Integration): Promise<void> {
    if ((integration.consecutiveNetworkFailures ?? 0) === 0) return;
    try {
      await this.integrationRepository.update(integration.id, {
        consecutiveNetworkFailures: 0,
      });
      integration.consecutiveNetworkFailures = 0;
    } catch (err) {
      this.logger.warn(
        `Failed to reset network failures counter for ${integration.id}: ${extractErrorMessage(err)}`,
      );
    }
  }

  private async executeWithRateLimit(
    integration: Integration,
    mallId: string,
    accessToken: string,
    opts: Cafe24CallOptions,
    attempt: number,
    /**
     * 401 자가 회복 (spec §6.1) 의 1회 재시도 flag. proactive
     * `ensureFreshToken` 이 race window 로 빗나가 만료된 access_token 으로
     * 호출이 401 을 받으면, refresh 후 동일 요청을 정확히 1회 재시도한다.
     * `true` 로 진입하면 다시 401 을 받아도 retry 하지 않고 격하 — 무한
     * 재귀 차단.
     */
    triedAuthRetry: boolean = false,
  ): Promise<Cafe24CallResult> {
    const url = this.buildUrl(mallId, opts.path, opts.query);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    // Envelope wrapping is POST/PUT-only. DELETE has no documented body
    // shape that uses the `request` wrapper (and our metadata DELETE rows
    // are path-only — no body fields), so DELETE with body would be a
    // metadata mistake we'd rather surface than silently re-wrap. Any
    // future method (e.g. PATCH) must be added to this allowlist
    // explicitly so its wire-format expectation gets reviewed.
    let bodyString: string | undefined;
    if (
      opts.body !== undefined &&
      WRITE_METHODS_WITH_ENVELOPE.has(opts.method)
    ) {
      headers['Content-Type'] = 'application/json';
      bodyString = JSON.stringify(wrapInCafe24Envelope(opts.body));
    } else if (opts.body !== undefined && opts.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      bodyString = JSON.stringify(opts.body);
    }

    const controller = new AbortController();
    const timeoutMs = opts.timeoutMs ?? 30_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: opts.method,
        headers,
        body: bodyString,
        signal: controller.signal,
      });
    } catch (err) {
      // REQ-C2: 연속 transport 실패 카운터 +1. 3 도달 시 markStatus
      // `error(network)` 로 전이 (spec §6). recordNetworkFailure 내부에서
      // 실패하더라도 본 throw 는 그대로 진행 — caller 가 transport 오류로
      // 처리. 카운터 갱신 실패는 best-effort.
      await this.recordNetworkFailure(integration, err);
      throw new Cafe24TransportFailedError(err);
    } finally {
      clearTimeout(timer);
    }

    const respHeaders = readHeaderMap(response.headers);
    const callMeta = parseRateLimitHeaders(respHeaders);

    // REQ-C2: HTTP 응답이 정상적으로 돌아왔다 = transport 레벨은 성공.
    // 다음 단계의 status 분기와 무관하게 카운터 리셋. 401/403 인 경우는
    // markAuthFailed 가 별도로 status='error(auth_failed)' 로 전이하므로
    // 카운터 리셋은 무해 (그 행은 이미 connected 가 아님).
    await this.resetNetworkFailures(integration);

    // Rate-limited — retry per spec policy with random jitter so multiple
    // concurrent callers sharing the same Integration don't all wake up
    // at the same instant and hammer the server in lockstep (thundering
    // herd → another 429 → another batched retry).
    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const baseSec = Math.max(
        callMeta.callRemain ?? 0,
        callMeta.timeRemain ?? 0,
        1,
      );
      const jitterMs = Math.floor(Math.random() * 500);
      const sleepMs = baseSec * 1000 + jitterMs;
      this.logger.debug(
        `Cafe24 429 (attempt ${attempt + 1}) — sleeping ${baseSec}s (+${jitterMs}ms jitter) for mall=${mallId}`,
      );
      await this.sleepImpl(sleepMs);
      return this.executeWithRateLimit(
        integration,
        mallId,
        accessToken,
        opts,
        attempt + 1,
      );
    }
    if (response.status === 429) {
      throw new Cafe24RateLimitedError(
        attempt,
        Math.max(callMeta.callRemain ?? 0, callMeta.timeRemain ?? 0, 0),
        mallId,
      );
    }

    if (response.status === 401 || response.status === 403) {
      const errBody = await safeReadJson(response);
      // Server-side diagnostic — Cafe24's error code/description rarely
      // contains sensitive info (it never echoes tokens), and without this
      // log there is no way to tell APP_NOT_INSTALLED from EXPIRED_TOKEN
      // from INSUFFICIENT_SCOPE — every cause surfaces to the user as
      // "auth failed (403)". Trimmed to 500 chars so an unexpectedly large
      // body cannot blow up the log line. SEC-C2: 보호 차원으로
      // `sanitizeLastErrorMessage` 적용 — Cafe24 가 echo 하는 비정상
      // 시크릿 조각을 운영 로그에 평문 기록하지 않는다.
      const bodyForLog = sanitizeLastErrorMessage(
        typeof errBody === 'string'
          ? errBody.slice(0, 500)
          : JSON.stringify(errBody).slice(0, 500),
      );
      this.logger.warn(
        `Cafe24 API ${response.status} mall=${mallId} ${opts.method} ${opts.path}: ${bodyForLog}`,
      );

      // Spec §6.1 401 자가 회복 — proactive ensureFreshToken 이 race
      // window (NULL legacy row, 다중 인스턴스 cache miss, DB-wall clock
      // skew) 로 빗나간 경우의 최후 안전망. pingConnection() (§5.8) 과
      // 정책 통일. 403 은 refresh 로 회복 불가 (스코프/앱 미설치) — 즉시
      // 격하로 직진. refresh 자체가 401/403 이면 performAuthRefresh 내부
      // (refreshAccessToken / refreshViaQueue) 가 이미 markAuthFailed +
      // Cafe24AuthFailedError throw 하므로 자동 propagate.
      if (response.status === 401 && !triedAuthRetry) {
        // 401 자가 회복 진입 로그 — 운영에서 "프로액티브 갱신이 빗나갔는데
        // reactive 401 으로 회복되는 케이스" 의 빈도/시점을 추적. retryCount
        // 는 attempt (rate-limit retry) 가 아닌 reactive retry 의 의미상 1.
        this.logger.log(
          `Cafe24 401 detected — performAuthRefresh + retry (integrationId=${integration.id} mall_id=${mallId} ${opts.method} ${opts.path} source=reactive_401)`,
        );
        await this.performAuthRefresh(integration);
        // performAuthRefresh contract 상 새 토큰이 integration.credentials
        // 에 mutate 되어 있음 (refreshAccessToken / refreshViaQueue 둘 다).
        // performAuthRefresh 의 side-effect contract 상 integration.credentials
        // .access_token 은 새 토큰으로 갱신됨. fallback `?? accessToken` 은
        // 만일 contract 가 깨질 경우 무한 401 루프 (triedAuthRetry=true 가
        // 차단) 로 가지 않고 옛 토큰으로 한 번 더 시도 후 격하되는 방어선.
        const refreshedToken =
          (integration.credentials as Cafe24Credentials | null)?.access_token ??
          accessToken;
        // attempt counter 리셋: 401 자가 회복은 429 rate limit retry 와
        // 별개의 단발성 흐름. triedAuthRetry=true 로 재귀 차단.
        return this.executeWithRateLimit(
          integration,
          mallId,
          refreshedToken,
          opts,
          0,
          true,
        );
      }

      // 403 또는 401-after-retry — 격하 확정.
      // REQ-C3: 403 + scope 시그널 시 status_reason='insufficient_scope'
      // 로 분기. 401 은 항상 auth_failed (토큰 자체 문제).
      const reason: 'auth_failed' | 'insufficient_scope' =
        response.status === 403 && this.detectInsufficientScope(errBody)
          ? 'insufficient_scope'
          : 'auth_failed';
      await this.markAuthFailed(integration, reason, errBody);
      throw new Cafe24AuthFailedError(response.status, mallId, errBody);
    }

    const body = await safeReadJson(response);

    return {
      status: response.status,
      body,
      headers: respHeaders,
      ...callMeta,
      retries: attempt,
    };
  }

  private buildUrl(
    mallId: string,
    path: string,
    query?: Record<string, unknown>,
  ): string {
    const cleanPath = path.replace(/^\//, '');
    const url = new URL(
      `https://${mallId}.cafe24api.com/api/v2/admin/${cleanPath}`,
    );
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.append(k, stringifyQueryValue(v));
      }
    }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.cafe24api.com')) {
      throw new Error(
        `Cafe24ApiClient: refusing to call non-Cafe24 host ${url.hostname} (SSRF guard)`,
      );
    }
    return url.toString();
  }
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function defaultSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// Direct alias of the global `fetch`. `globalThis.fetch` is typed as
// `any` in our @types setup, so going through it triggers unsafe-argument
// lint warnings; the bare `fetch` identifier resolves through TypeScript's
// own DOM/Node `lib` declarations and is typed as `typeof fetch` cleanly.
const defaultFetch: typeof fetch = fetch;

/**
 * Wrap a write-request body in Cafe24's `request` envelope.
 *
 * Cafe24 Admin API rejects flat bodies with `400 "Please enter the Request
 * parameter."` — every POST/PUT must be shaped as
 * `{ shop_no?, request: { ...rest } }` where `shop_no` is the only field
 * allowed to live at the top level alongside `request`. Source: every
 * `https://developers.cafe24.com/docs/ko/api/admin/` "Request body" sample
 * follows this exact shape; no other top-level keys are documented across
 * the catalog we use. Centralising the transform here keeps both the node
 * handler and the MCP tool provider caller-side flat: they pass the
 * metadata-driven body map as-is, and the wire format stays a pure
 * protocol concern of this client.
 *
 * **Caller contract**: pass a *flat* body map (the metadata-driven
 * `location: 'body'` fields). Do NOT pre-wrap — if the input already has
 * a `request` key the function throws, because re-wrapping would produce
 * `{ request: { request: ... } }` which Cafe24 silently accepts but
 * misinterprets (every wrapped field becomes ignored).
 *
 * **Purity**: returns a new object; never mutates the input. Safe to call
 * repeatedly on the same `Cafe24CallOptions` across 429 retry attempts.
 *
 * **`shop_no` handling**: any non-`undefined` value (including `0` and
 * `null`) is hoisted to the top level. `0` is meaningful — Cafe24 uses
 * shop_no `0` for some single-mall flows — and `null` propagates through
 * unchanged so a caller mistake is visible in the wire payload rather
 * than silently dropped.
 *
 * Exported for direct unit testing.
 */
export function wrapInCafe24Envelope(body: Record<string, unknown>): {
  shop_no?: unknown;
  request: Record<string, unknown>;
} {
  if (Object.prototype.hasOwnProperty.call(body, 'request')) {
    throw new Error(
      'wrapInCafe24Envelope received a body with a pre-existing `request` key — caller must not pre-wrap',
    );
  }
  const { shop_no, ...rest } = body;
  return shop_no !== undefined ? { shop_no, request: rest } : { request: rest };
}

/**
 * Coerce a query parameter value to a string without ever producing the
 * `[object Object]` default — Cafe24 only accepts scalar query params, so
 * non-scalars are JSON-serialised explicitly.
 */
function stringifyQueryValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  return JSON.stringify(value);
}

function readHeaderMap(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

function parseRateLimitHeaders(h: Record<string, string>): {
  callUsage?: number;
  callRemain?: number;
  timeUsage?: number;
  timeRemain?: number;
  callLimit?: string;
} {
  const out: ReturnType<typeof parseRateLimitHeaders> = {};
  const num = (key: string): number | undefined => {
    const v = h[key];
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  out.callUsage = num('x-cafe24-call-usage');
  out.callRemain = num('x-cafe24-call-remain');
  out.timeUsage = num('x-cafe24-time-usage');
  out.timeRemain = num('x-cafe24-time-remain');
  if (h['x-api-call-limit']) out.callLimit = h['x-api-call-limit'];
  return out;
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

/**
 * Resolve the access-token expiry instant from an Integration row.
 *
 * Precedence: JWT `exp` claim (access_token 내 — TZ-bugged stored value 를
 * 무력화하는 ground truth) → `Integration.tokenExpiresAt` (spec §10.5
 * canonical column) → `credentials.expires_at` (JSONB mirror).
 * Returns null when no source is available or all parse as invalid.
 *
 * JWT exp 가 최우선인 이유: tokenExpiresAt / credentials.expires_at 는 저장 시
 * TZ 모호성(구 코드 KST→UTC 9h 회귀)으로 실제 만료보다 최대 9h 늦게 기록될 수
 * 있다. JWT exp 는 token 자체에 포함된 불변 값이므로 TZ-bugged 저장값을 무력화하는
 * 유일한 ground truth. JWT 파싱 불가(비-JWT opaque token 등) 시에는 entity column
 * 으로 폴백: 이는 atomic 4-field UPDATE(`refreshAccessToken`)가 column 을 마지막에
 * 기록하고 OAuth 콜백 경로가 역사적으로 column 만 기록했기 때문에 stale-mirror trap
 * 을 피한다.
 *
 * Exported because the BullMQ refresh worker re-evaluates expiry on job
 * pickup (race protection: a refresh that completed milliseconds before
 * the worker started should short-circuit).
 */
export function resolveTokenExpiry(integration: {
  tokenExpiresAt?: Date | null;
  credentials?: Record<string, unknown> | null;
}): number | null {
  // JWT exp 최우선 — Cafe24 API 서버가 token 검증 시 이 claim 을 직접 사용.
  // tokenExpiresAt / credentials.expires_at 는 저장 시 TZ 모호성(구 코드 KST→UTC
  // 9h 회귀)으로 실제 만료보다 최대 9h 늦게 기록될 수 있다. JWT exp 는 token
  // 자체에 포함된 불변 값이므로 TZ-bugged 저장값을 무력화하는 유일한 ground truth.
  const creds = (integration.credentials ?? {}) as Cafe24Credentials;
  const jwtExp = parseJwtExp(
    typeof creds.access_token === 'string' ? creds.access_token : null,
  );
  if (jwtExp !== null) return jwtExp;

  const col = integration.tokenExpiresAt;
  if (col instanceof Date && Number.isFinite(col.getTime())) {
    return col.getTime();
  }
  if (typeof col === 'string' && col) {
    const parsed = Date.parse(col);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (creds.expires_at) {
    const parsed = Date.parse(creds.expires_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readNumber(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Test seam — clears the in-process mutex map. Production code should
 * never call this; tests reset state between cases. */
export function __resetCafe24LocksForTesting(): void {
  integrationLocks.clear();
}
