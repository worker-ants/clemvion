import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Integration } from '../../../modules/integrations/entities/integration.entity.js';
import {
  MAKESHOP_REFRESH_JOB,
  MAKESHOP_REFRESH_QUEUE,
  MAKESHOP_REFRESH_QUEUE_EVENTS,
  MakeshopRefreshJobData,
  MAKESHOP_REFRESH_JOB_WAIT_TIMEOUT_MS,
} from '../../../modules/integrations/makeshop-token-refresh.constants.js';
import { sanitizeLastErrorMessage } from '../../../modules/integrations/integration-oauth.service.js';
import { parseJwtExp } from '../../../modules/integrations/jwt-exp.js';
import { IntegrationActionRequiredNotifier } from '../../../modules/integrations/integration-action-required-notifier.service.js';

/**
 * Optional DI tokens for swapping the network / sleep primitives in tests.
 * Production never binds these — NestJS resolves them as `undefined` via
 * `@Optional()` and the constructor falls back to `defaultFetch` /
 * `defaultSleep`. Mirrors the Cafe24 client's `@Optional() @Inject(token)`
 * pattern (a bare `typeof fetch` constructor param trips
 * `UnknownDependenciesException`).
 */
export const MAKESHOP_FETCH_IMPL = 'MAKESHOP_FETCH_IMPL';
export const MAKESHOP_SLEEP_IMPL = 'MAKESHOP_SLEEP_IMPL';

/**
 * MakeShop Shop API client wrapper.
 *
 * Responsibilities (spec/4-nodes/4-integration/5-makeshop.md §4·§9):
 * - Build `https://connect.makeshop.co.kr/api/v1/{shop_uid}/{path}` URLs from
 *   metadata-driven path templates. Unlike Cafe24's `{mall_id}.cafe24api.com`
 *   per-shop subdomain, MakeShop is a SINGLE host + `{shop_uid}` path segment.
 * - Inject `Authorization: Bearer {access_token}` and refresh the token
 *   in-place (atomic UPDATE with refresh_token rotation) when it expires
 *   within 60s.
 * - **NO request envelope** — POST/PUT bodies are flat JSON (Cafe24's
 *   `{request:{...}}` wrapper is NOT applied — spec §9.4).
 * - MakeShop publishes no data-call rate-limit headers (spec §9.7). On 429,
 *   honour `Retry-After` (seconds) if present, else a fixed backoff; up to
 *   2 retries; then `MakeshopRateLimitedError`. No leaky-bucket monitoring.
 * - Serialise concurrent calls per Integration via an in-process mutex so
 *   the workflow node and the AI Agent MCP bridge share the same request
 *   ordering. Refresh operations serialise cluster-wide via the dedicated
 *   `makeshop-token-refresh` BullMQ queue (separate from cafe24's).
 * - Translate 401/403 into an atomic Integration.status transition to
 *   `error(auth_failed)` (spec §6.1).
 */

export type MakeshopMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface MakeshopCallOptions {
  method: MakeshopMethod;
  /** Template path (e.g. `product`, `brand/create`) with placeholders already substituted. */
  path: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  /** Per-call timeout. Defaults to 30s. */
  timeoutMs?: number;
}

export interface MakeshopCallResult {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  retries: number;
}

export class MakeshopRateLimitedError extends Error {
  readonly code = 'MAKESHOP_RATE_LIMITED';
  constructor(
    readonly retries: number,
    readonly lastRetryAfterSec: number,
    readonly shopUid: string,
  ) {
    super(
      `MakeShop rate limit exhausted after ${retries} retries (shop=${shopUid})`,
    );
    this.name = 'MakeshopRateLimitedError';
  }
}

export class MakeshopAuthFailedError extends Error {
  readonly code = 'MAKESHOP_AUTH_FAILED';
  constructor(
    readonly status: 401 | 403,
    readonly shopUid: string,
    readonly responseBody: unknown,
  ) {
    const summary = summarizeMakeshopErrorBody(responseBody);
    const suffix = summary ? ` — ${summary}` : '';
    super(
      `MakeShop authentication failed (${status}) for shop ${shopUid}${suffix}`,
    );
    this.name = 'MakeshopAuthFailedError';
  }
}

export class MakeshopTransportFailedError extends Error {
  readonly code = 'MAKESHOP_TRANSPORT_FAILED';
  constructor(readonly cause: unknown) {
    super(extractErrorMessage(cause));
    this.name = 'MakeshopTransportFailedError';
  }
}

export class MakeshopIncompleteCredentialsError extends Error {
  readonly code = 'INTEGRATION_INCOMPLETE';
  constructor(reason: string) {
    super(`MakeShop credentials incomplete: ${reason}`);
    this.name = 'MakeshopIncompleteCredentialsError';
  }
}

/**
 * Extract a compact, user-actionable summary from MakeShop's error body so
 * the MCP / node error response carries the real cause rather than a generic
 * "authentication failed (403)". Tokens never appear in MakeShop error
 * bodies, so it's safe to forward.
 */
function summarizeMakeshopErrorBody(body: unknown): string {
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
 * `{ success: false, code, message }` shape — keeps the "never throws"
 * contract centralised (mirror of cafe24's `mapPingError`).
 */
function mapPingError(err: unknown): {
  success: false;
  code: string;
  message: string;
} {
  if (err instanceof MakeshopAuthFailedError) {
    return {
      success: false,
      code: 'MAKESHOP_AUTH_FAILED',
      message: err.message,
    };
  }
  if (err instanceof MakeshopIncompleteCredentialsError) {
    return {
      success: false,
      code: 'INTEGRATION_INCOMPLETE',
      message: err.message,
    };
  }
  if (err instanceof MakeshopTransportFailedError) {
    return {
      success: false,
      code: 'MAKESHOP_TRANSPORT_FAILED',
      message: err.message,
    };
  }
  return {
    success: false,
    code: 'MAKESHOP_TRANSPORT_FAILED',
    message: extractErrorMessage(err),
  };
}

interface MakeshopCredentials {
  shop_uid?: string;
  client_id?: string;
  client_secret?: string;
  access_token?: string;
  refresh_token?: string;
  scopes?: string[];
  expires_at?: string;
}

export const MAKESHOP_REFRESH_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_RETRIES = 2;
/** Fixed backoff (ms) when a 429 carries no `Retry-After` header (spec §9.7). */
const MAKESHOP_DEFAULT_BACKOFF_MS = 2_000;

/** MakeShop OAuth token endpoint host (spec §4 step 6 / §9.1). */
const MAKESHOP_TOKEN_URL = 'https://auth.makeshop.com/oauth/token';
/** MakeShop Shop API base host (spec §9.3). */
const MAKESHOP_API_HOST = 'connect.makeshop.co.kr';

/**
 * Internal helper — a Promise chain keyed by Integration ID acts as a mutex.
 * One fetch per Integration is in-flight at a time within this process
 * (mirror of cafe24's `withIntegrationLock`).
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
export class MakeshopApiClient {
  private readonly logger = new Logger(MakeshopApiClient.name);
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly refreshQueue: Queue<MakeshopRefreshJobData> | null;
  private readonly refreshQueueEvents: QueueEvents | null;

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly dataSource: DataSource,
    @Optional() @Inject(MAKESHOP_FETCH_IMPL) fetchImpl?: typeof fetch,
    @Optional()
    @Inject(MAKESHOP_SLEEP_IMPL)
    sleepImpl?: (ms: number) => Promise<void>,
    @Optional()
    @InjectQueue(MAKESHOP_REFRESH_QUEUE)
    refreshQueue?: Queue<MakeshopRefreshJobData>,
    @Optional()
    @Inject(MAKESHOP_REFRESH_QUEUE_EVENTS)
    refreshQueueEvents?: QueueEvents,
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
    opts: MakeshopCallOptions,
  ): Promise<MakeshopCallResult> {
    return withIntegrationLock(integration.id, async () => {
      const creds = (integration.credentials ?? {}) as MakeshopCredentials;
      this.assertCredentials(creds);

      await this.ensureFreshToken(integration);

      const accessToken =
        ((integration.credentials ?? {}) as MakeshopCredentials).access_token ??
        creds.access_token!;
      const shopUid = creds.shop_uid!;

      return this.executeWithRetry(integration, shopUid, accessToken, opts, 0);
    });
  }

  /**
   * 사용자 진단용 연결 테스트 (spec §5.9). `GET information` 핑으로
   * access_token 의 유효성을 확인한다. 401 시 명시적 refresh 후 1회 재시도.
   *
   * **never throws** — 자격증명 누락·refresh 실패·HTTP 실패·transport 실패
   * 모두 `{ success: false, code, message }` 형태로 변환해 반환한다.
   */
  async pingConnection(
    integration: Integration,
  ): Promise<{ success: boolean; code?: string; message?: string }> {
    return withIntegrationLock(integration.id, async () => {
      let creds: MakeshopCredentials;
      try {
        creds = (integration.credentials ?? {}) as MakeshopCredentials;
        this.assertCredentials(creds);
      } catch (err) {
        return mapPingError(err);
      }

      try {
        await this.ensureFreshToken(integration);
      } catch (err) {
        return mapPingError(err);
      }

      const shopUid = creds.shop_uid!;

      const first = await this.rawPing(
        shopUid,
        this.currentAccessToken(integration),
      );
      if (first.kind === 'success') return { success: true };
      if (first.kind === 'transport') {
        return {
          success: false,
          code: 'MAKESHOP_TRANSPORT_FAILED',
          message: first.message,
        };
      }
      if (first.status === 403) {
        return {
          success: false,
          code: 'MAKESHOP_AUTH_FAILED',
          message: this.formatAuthFailure(first.status, shopUid, first.body),
        };
      }
      // status === 401: 명시적 refresh 후 1회 재시도.
      try {
        await this.refreshAccessToken(integration);
      } catch (err) {
        return mapPingError(err);
      }

      const second = await this.rawPing(
        shopUid,
        this.currentAccessToken(integration),
      );
      if (second.kind === 'success') return { success: true };
      if (second.kind === 'transport') {
        return {
          success: false,
          code: 'MAKESHOP_TRANSPORT_FAILED',
          message: second.message,
        };
      }
      if (second.status === 401) {
        await this.markAuthFailed(integration);
      }
      return {
        success: false,
        code: 'MAKESHOP_AUTH_FAILED',
        message: this.formatAuthFailure(second.status, shopUid, second.body),
      };
    });
  }

  private currentAccessToken(integration: Integration): string {
    const creds = (integration.credentials ?? {}) as MakeshopCredentials;
    return creds.access_token!;
  }

  private static readonly PING_TIMEOUT_MS = 30_000;

  /**
   * 단일 fetch — status 격하 부작용 없는 raw probe. spec §5.9 `GET information`.
   */
  private async rawPing(
    shopUid: string,
    accessToken: string,
  ): Promise<
    | { kind: 'success' }
    | { kind: 'http'; status: number; body: unknown }
    | { kind: 'transport'; message: string }
  > {
    const url = this.buildUrl(shopUid, 'information');
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      MakeshopApiClient.PING_TIMEOUT_MS,
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

  private formatAuthFailure(
    status: number,
    shopUid: string,
    body: unknown,
  ): string {
    const summary = summarizeMakeshopErrorBody(body);
    const suffix = summary ? ` — ${summary}` : '';
    return `MakeShop authentication failed (${status}) for shop ${shopUid}${suffix}`;
  }

  /**
   * MakeShop OAuth 는 confidential client 모델이라 client_id/secret 가 항상
   * 필요하다 (cafe24 의 public/private 분기 없음 — spec §4 step 4).
   */
  private assertCredentials(creds: MakeshopCredentials): void {
    if (!creds.shop_uid) {
      throw new MakeshopIncompleteCredentialsError('shop_uid is missing');
    }
    if (!creds.access_token) {
      throw new MakeshopIncompleteCredentialsError('access_token is missing');
    }
    if (!creds.refresh_token) {
      throw new MakeshopIncompleteCredentialsError('refresh_token is missing');
    }
    if (!creds.client_id || !creds.client_secret) {
      throw new MakeshopIncompleteCredentialsError(
        'client_id and client_secret are required (confidential client)',
      );
    }
  }

  /**
   * If the token is missing or within MAKESHOP_REFRESH_WINDOW_MS of expiry,
   * exchange the refresh_token and atomically update credentials +
   * tokenExpiresAt.
   *
   * **Token expiry SoT** (spec §4 step 6): `Integration.tokenExpiresAt`
   * (canonical column) → `credentials.expires_at` (JSONB mirror). MakeShop
   * access_token is NOT guaranteed to be a JWT, so we do NOT hard-depend on a
   * JWT `exp` claim — a JWT fallback is only consulted if the token happens to
   * parse as one (guarded). Refresh window 60s like cafe24.
   */
  private async ensureFreshToken(integration: Integration): Promise<void> {
    const expiresAtMs = resolveMakeshopTokenExpiry(integration);
    const shopUid =
      (integration.credentials as MakeshopCredentials | null | undefined)
        ?.shop_uid ?? 'unknown';
    if (
      expiresAtMs !== null &&
      expiresAtMs - Date.now() > MAKESHOP_REFRESH_WINDOW_MS
    ) {
      this.logger.debug(
        `MakeShop token fresh — skip refresh (integrationId=${integration.id} shop_uid=${shopUid} ttlSec=${Math.floor((expiresAtMs - Date.now()) / 1000)})`,
      );
      return;
    }

    const ttlLabel =
      expiresAtMs === null
        ? 'null'
        : `${Math.floor((expiresAtMs - Date.now()) / 1000)}`;
    this.logger.log(
      `MakeShop token expiring or null — proactive refresh (integrationId=${integration.id} shop_uid=${shopUid} ttlSec=${ttlLabel} source=proactive)`,
    );

    if (this.refreshQueue && this.refreshQueueEvents) {
      await this.refreshViaQueue(integration, 'proactive');
      return;
    }
    await this.refreshAccessToken(integration);
  }

  /**
   * Cross-instance-safe refresh path — mirror of cafe24's `refreshViaQueue`.
   * proactive/background use `jobId = integrationId` (BullMQ dedup);
   * reactive_401 uses a unique jobId to bypass completed-job dedup (caller
   * received an empirical 401, so the worker MUST run). Cross-pod
   * serialization falls back to the pessimistic_write row lock inside
   * `refreshAccessToken`.
   */
  private async refreshViaQueue(
    integration: Integration,
    source: MakeshopRefreshJobData['source'],
  ): Promise<void> {
    const queue = this.refreshQueue!;
    const events = this.refreshQueueEvents!;
    const jobId =
      source === 'reactive_401'
        ? `${integration.id}#reactive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : integration.id;
    const job = await queue.add(
      MAKESHOP_REFRESH_JOB,
      { integrationId: integration.id, source },
      {
        jobId,
        attempts: 1,
        removeOnComplete: { age: 60 },
        removeOnFail: { age: 300 },
      },
    );

    try {
      await job.waitUntilFinished(events, MAKESHOP_REFRESH_JOB_WAIT_TIMEOUT_MS);
    } catch (err) {
      // waitUntilFinished can time out spuriously in a multi-pod cluster even
      // though the worker succeeded (QueueEvents missed the `completed`
      // event). Re-read the row and decide directly (mirror of cafe24).
      const fresh = await this.integrationRepository.findOne({
        where: { id: integration.id },
      });
      if (fresh?.status === 'error' && fresh.statusReason === 'auth_failed') {
        const shopUid =
          (fresh.credentials as MakeshopCredentials | undefined)?.shop_uid ??
          integration.id;
        throw new MakeshopAuthFailedError(401, shopUid, fresh.lastError);
      }
      const freshExpiry = fresh ? resolveMakeshopTokenExpiry(fresh) : null;
      if (
        !fresh ||
        fresh.status !== 'connected' ||
        freshExpiry === null ||
        freshExpiry - Date.now() <= MAKESHOP_REFRESH_WINDOW_MS
      ) {
        throw new MakeshopTransportFailedError(err);
      }
      this.logger.debug(
        `MakeShop refresh worker succeeded for ${integration.id} but waitUntilFinished timed out — recovered via DB re-read`,
      );
    }

    const fresh = await this.integrationRepository.findOne({
      where: { id: integration.id },
    });
    if (!fresh) {
      throw new MakeshopTransportFailedError(
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
   * 401 자가 회복 공통 helper — `executeWithRetry` 와 `pingConnection` 이 같은
   * refresh+1회 retry 정책을 공유. 큐 바인딩 시 reactive_401, 미바인딩 시
   * in-process refresh.
   */
  private async performAuthRefresh(integration: Integration): Promise<void> {
    if (this.refreshQueue && this.refreshQueueEvents) {
      await this.refreshViaQueue(integration, 'reactive_401');
      return;
    }
    await this.refreshAccessToken(integration);
  }

  /**
   * 외부 호출자 (MCP `MakeshopMcpToolProvider`, Phase 4) 가 큐 경유 refresh 를
   * 명시적으로 트리거할 수 있도록 노출한 public entry. proactive / reactive
   * 401 retry 와 같은 단일 경로 (jobId dedup) 를 강제한다.
   */
  async refreshTokenViaQueue(
    integration: Integration,
    source: 'proactive' | 'background' = 'background',
  ): Promise<void> {
    if (this.refreshQueue && this.refreshQueueEvents) {
      await this.refreshViaQueue(integration, source);
      return;
    }
    this.logger.warn(
      `makeshop refreshQueue not bound — falling back to in-process refresh (integrationId=${integration.id}, source=${source})`,
    );
    await this.refreshAccessToken(integration);
  }

  /**
   * Exchange the refresh_token for a fresh access_token via MakeShop's OAuth
   * token endpoint. spec §4 step 6 / §9.1.
   *
   * Wire differences vs cafe24:
   * - Endpoint is the single host `https://auth.makeshop.com/oauth/token`
   *   (not a per-shop subdomain).
   * - Basic auth `client_id:client_secret` — confidential client, credentials
   *   always live on the Integration row (no public-app env fallback).
   * - **Rotation**: the response returns a NEW refresh_token which is persisted
   *   atomically (access_token + refresh_token + expires_at + tokenExpiresAt)
   *   inside a pessimistic_write row lock (same rotation hazard as cafe24).
   */
  async refreshAccessToken(integration: Integration): Promise<void> {
    const creds = (integration.credentials ?? {}) as MakeshopCredentials;
    if (!creds.shop_uid || !creds.refresh_token) {
      throw new MakeshopIncompleteCredentialsError(
        'shop_uid and refresh_token are required for refresh',
      );
    }
    if (!creds.client_id || !creds.client_secret) {
      throw new MakeshopIncompleteCredentialsError(
        'client_id/client_secret missing for refresh (confidential client)',
      );
    }

    this.logger.log(
      `MakeShop token refresh starting (integrationId=${integration.id} shop_uid=${creds.shop_uid})`,
    );

    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refresh_token,
    });

    let response: Response;
    try {
      response = await this.fetchImpl(MAKESHOP_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(
            `${creds.client_id}:${creds.client_secret}`,
          ).toString('base64')}`,
        },
        body: form.toString(),
      });
    } catch (err) {
      await this.recordNetworkFailure(integration, err);
      throw new MakeshopTransportFailedError(err);
    }

    if (response.status === 401 || response.status === 403) {
      const body = await safeReadJson(response);
      const bodyForLog = sanitizeLastErrorMessage(
        typeof body === 'string'
          ? body.slice(0, 500)
          : JSON.stringify(body).slice(0, 500),
      );
      this.logger.warn(
        `MakeShop token refresh ${response.status} (integrationId=${integration.id} shop_uid=${creds.shop_uid}): ${bodyForLog}`,
      );
      await this.markAuthFailed(integration);
      throw new MakeshopAuthFailedError(response.status, creds.shop_uid, body);
    }
    if (!response.ok) {
      const body = await safeReadJson(response);
      throw new Error(
        `MakeShop token refresh failed (${response.status}): ${sanitizeLastErrorMessage(JSON.stringify(body))}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const accessToken = readString(data, 'access_token');
    const refreshToken = readString(data, 'refresh_token');
    if (!accessToken) {
      throw new Error('MakeShop token refresh response missing access_token');
    }
    // 만료 시각 SoT (spec §4 step 6). MakeShop access_token 은 JWT 보장이 없으므로
    // expires_in (token TTL ~1h) 을 1차 출처로 사용. JWT exp 는 토큰이 우연히
    // JWT 일 때만 보조 폴백으로 guard 적용 — hard-depend 하지 않는다.
    const expiresIn = readNumber(data, 'expires_in');
    const expiresAtStr = readString(data, 'expires_at');
    const jwtExpMs = parseJwtExp(accessToken);
    const expiresAtParsed = expiresAtStr
      ? Date.parse(expiresAtStr)
      : Number.NaN;
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : Number.isFinite(expiresAtParsed)
        ? new Date(expiresAtParsed)
        : jwtExpMs !== null
          ? new Date(jwtExpMs)
          : new Date(Date.now() + 60 * 60 * 1000); // MakeShop access_token TTL 1h

    // Atomic UPDATE under a pessimistic_write row lock — refresh_token rotation
    // means two concurrent refreshes could otherwise leave an orphan token.
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Integration);
      const fresh = await repo.findOne({
        where: { id: integration.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!fresh) throw new Error('Integration vanished during refresh');
      const updatedCreds: MakeshopCredentials = {
        ...((fresh.credentials ?? {}) as MakeshopCredentials),
        access_token: accessToken,
        // Rotation — persist the NEW refresh_token (spec §4 step 6).
        refresh_token:
          refreshToken ??
          (fresh.credentials as MakeshopCredentials)?.refresh_token,
        expires_at: expiresAt.toISOString(),
      };
      fresh.credentials = updatedCreds as unknown as Record<string, unknown>;
      fresh.tokenExpiresAt = expiresAt;
      fresh.status = 'connected';
      fresh.statusReason = null;
      fresh.lastRotatedAt = new Date();
      await repo.save(fresh);
      integration.credentials = updatedCreds as unknown as Record<
        string,
        unknown
      >;
      integration.tokenExpiresAt = expiresAt;
      integration.status = 'connected';
      integration.statusReason = null;
    });

    this.logger.log(
      `MakeShop token refresh succeeded (integrationId=${integration.id} shop_uid=${creds.shop_uid} newExpiresAt=${expiresAt.toISOString()} refreshTokenRotated=${refreshToken !== null && refreshToken !== creds.refresh_token})`,
    );
  }

  /**
   * Atomically transition the Integration to `error(auth_failed)` and emit the
   * action-required notification on first entry into that bucket.
   */
  private async markAuthFailed(integration: Integration): Promise<void> {
    const reason = 'auth_failed';
    const transitioning =
      integration.status !== 'error' || integration.statusReason !== reason;
    try {
      await this.integrationRepository.update(integration.id, {
        status: 'error',
        statusReason: reason,
        lastError: {
          code: 'MAKESHOP_AUTH_FAILED',
          message: 'MakeShop returned 401/403',
          at: new Date().toISOString(),
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
   * `connected → error(network) | 3회 연속 실패` 전이 (spec §6, cafe24 동형).
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
            code: 'MAKESHOP_TRANSPORT_FAILED',
            message: extractErrorMessage(cause).slice(0, 200),
            at: new Date().toISOString(),
          },
        });
        integration.status = 'error';
        integration.statusReason = 'network';
        integration.consecutiveNetworkFailures = 0;
        this.logger.warn(
          `MakeShop integration ${integration.id} demoted to error(network) — 3 consecutive transport failures (spec §6)`,
        );
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

  private async executeWithRetry(
    integration: Integration,
    shopUid: string,
    accessToken: string,
    opts: MakeshopCallOptions,
    attempt: number,
    triedAuthRetry: boolean = false,
  ): Promise<MakeshopCallResult> {
    const url = this.buildUrl(shopUid, opts.path, opts.query);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    // **NO request envelope** (spec §9.4) — POST/PUT bodies are flat JSON.
    let bodyString: string | undefined;
    if (opts.body !== undefined && opts.method !== 'GET') {
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
      await this.recordNetworkFailure(integration, err);
      throw new MakeshopTransportFailedError(err);
    } finally {
      clearTimeout(timer);
    }

    const respHeaders = readHeaderMap(response.headers);

    await this.resetNetworkFailures(integration);

    // 429 — MakeShop has no documented rate-limit headers (spec §9.7). Honour
    // `Retry-After` (seconds) if present, else a fixed backoff; max 2 retries.
    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfterSec = parseRetryAfter(respHeaders['retry-after']);
      const baseMs =
        retryAfterSec !== null
          ? retryAfterSec * 1000
          : MAKESHOP_DEFAULT_BACKOFF_MS;
      const jitterMs = Math.floor(Math.random() * 500);
      const sleepMs = baseMs + jitterMs;
      this.logger.debug(
        `MakeShop 429 (attempt ${attempt + 1}) — sleeping ${baseMs}ms (+${jitterMs}ms jitter) for shop=${shopUid}`,
      );
      await this.sleepImpl(sleepMs);
      return this.executeWithRetry(
        integration,
        shopUid,
        accessToken,
        opts,
        attempt + 1,
        triedAuthRetry,
      );
    }
    if (response.status === 429) {
      const retryAfterSec = parseRetryAfter(respHeaders['retry-after']);
      throw new MakeshopRateLimitedError(attempt, retryAfterSec ?? 0, shopUid);
    }

    if (response.status === 401 || response.status === 403) {
      const errBody = await safeReadJson(response);
      const bodyForLog = sanitizeLastErrorMessage(
        typeof errBody === 'string'
          ? errBody.slice(0, 500)
          : JSON.stringify(errBody).slice(0, 500),
      );
      this.logger.warn(
        `MakeShop API ${response.status} shop=${shopUid} ${opts.method} ${opts.path}: ${bodyForLog}`,
      );

      // 401 자가 회복 — refresh + 1회 재시도. 403 은 즉시 격하 (spec §6.1).
      if (response.status === 401 && !triedAuthRetry) {
        this.logger.log(
          `MakeShop 401 detected — performAuthRefresh + retry (integrationId=${integration.id} shop_uid=${shopUid} ${opts.method} ${opts.path} source=reactive_401)`,
        );
        await this.performAuthRefresh(integration);
        const refreshedToken =
          (integration.credentials as MakeshopCredentials | null)
            ?.access_token ?? accessToken;
        return this.executeWithRetry(
          integration,
          shopUid,
          refreshedToken,
          opts,
          0,
          true,
        );
      }

      await this.markAuthFailed(integration);
      throw new MakeshopAuthFailedError(response.status, shopUid, errBody);
    }

    const body = await safeReadJson(response);

    return {
      status: response.status,
      body,
      headers: respHeaders,
      retries: attempt,
    };
  }

  /**
   * Build `https://connect.makeshop.co.kr/api/v1/{shop_uid}/{path}` with an
   * SSRF guard. The `shop_uid` is injected as a path segment (spec §9.3) —
   * the handler validates its format before reaching here, and this guard is
   * a defense-in-depth backstop confirming the resolved host is MakeShop's.
   */
  private buildUrl(
    shopUid: string,
    path: string,
    query?: Record<string, unknown>,
  ): string {
    const cleanPath = path.replace(/^\//, '');
    const url = new URL(
      `https://${MAKESHOP_API_HOST}/api/v1/${encodeURIComponent(shopUid)}/${cleanPath}`,
    );
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.append(k, stringifyQueryValue(v));
      }
    }
    if (url.protocol !== 'https:' || url.hostname !== MAKESHOP_API_HOST) {
      throw new Error(
        `MakeshopApiClient: refusing to call non-MakeShop host ${url.hostname} (SSRF guard)`,
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

const defaultFetch: typeof fetch = fetch;

/**
 * Parse an HTTP `Retry-After` header expressed in seconds. Returns null for
 * absent / malformed / HTTP-date forms (MakeShop is undocumented here — we
 * only honour the integer-seconds form and fall back to a fixed backoff
 * otherwise).
 */
function parseRetryAfter(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.trim());
  if (Number.isFinite(n) && n >= 0) return n;
  return null;
}

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
 * Precedence (spec §4 step 6 — `Integration.tokenExpiresAt` is SoT):
 * `Integration.tokenExpiresAt` (canonical column) → `credentials.expires_at`
 * (JSONB mirror) → JWT `exp` (only if the token happens to be a JWT — guarded,
 * NOT a hard dependency since MakeShop access_token is not guaranteed JWT).
 * Returns null when no source is available or all parse as invalid.
 *
 * Exported because the BullMQ refresh worker re-evaluates expiry on pickup.
 */
export function resolveMakeshopTokenExpiry(integration: {
  tokenExpiresAt?: Date | null;
  credentials?: Record<string, unknown> | null;
}): number | null {
  const col = integration.tokenExpiresAt;
  if (col instanceof Date && Number.isFinite(col.getTime())) {
    return col.getTime();
  }
  if (typeof col === 'string' && col) {
    const parsed = Date.parse(col);
    if (Number.isFinite(parsed)) return parsed;
  }
  const creds = (integration.credentials ?? {}) as MakeshopCredentials;
  if (creds.expires_at) {
    const parsed = Date.parse(creds.expires_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  // Guarded JWT fallback — only meaningful if MakeShop happens to issue a JWT.
  const jwtExp = parseJwtExp(
    typeof creds.access_token === 'string' ? creds.access_token : null,
  );
  if (jwtExp !== null) return jwtExp;
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

/** Test seam — clears the in-process mutex map between cases. */
export function __resetMakeshopLocksForTesting(): void {
  integrationLocks.clear();
}
