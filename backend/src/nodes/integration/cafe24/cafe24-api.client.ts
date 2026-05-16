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
 *   `jobId = integrationId` dedup, spec §9.6 resolution).
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
    if (expiresAtMs === null) return;
    if (expiresAtMs - Date.now() > REFRESH_WINDOW_MS) return;

    if (this.refreshQueue && this.refreshQueueEvents) {
      await this.refreshViaQueue(integration, 'proactive');
      return;
    }
    await this.refreshAccessToken(integration);
  }

  /**
   * Cross-instance-safe refresh path.
   *
   * Enqueues a refresh job with `jobId = integration.id`. BullMQ rejects
   * duplicate jobIds while the existing job is in waiting/active state and
   * returns the existing job reference instead, so concurrent callers
   * (within the same pod or across pods) all wait on the same worker
   * execution. After the worker completes, we re-read the integration row
   * from the DB and mutate the caller's reference so the subsequent
   * `executeWithRateLimit` sees the refreshed bearer.
   *
   * If the worker called `markAuthFailed` (refresh_token invalid), the
   * fresh row carries `status='error'` — surface as Cafe24AuthFailedError
   * to keep call() error semantics consistent with the in-process path.
   */
  private async refreshViaQueue(
    integration: Integration,
    source: 'proactive' | 'background',
  ): Promise<void> {
    const queue = this.refreshQueue!;
    const events = this.refreshQueueEvents!;
    const job = await queue.add(
      CAFE24_REFRESH_JOB,
      { integrationId: integration.id, source },
      {
        // jobId dedup across the cluster — same id, same job reference.
        jobId: integration.id,
        // attempts:1 because refresh failures (invalid_grant) are terminal
        // — retrying replays the same 401 and just floods the alert path.
        attempts: 1,
        // Keep completed jobs briefly so concurrent `add()` from a slow
        // caller still resolves to a real job reference; the next refresh
        // round (≥1h later in normal use) will not collide.
        removeOnComplete: { age: 60 },
        removeOnFail: { age: 300 },
      },
    );

    try {
      await job.waitUntilFinished(events, REFRESH_JOB_WAIT_TIMEOUT_MS);
    } catch (err) {
      // waitUntilFinished resolves on completion and rejects on failure or
      // timeout. Re-fetch the integration to surface the actual auth state
      // — if the worker called markAuthFailed, the row already reflects it
      // and we throw the canonical error. If it was a timeout/other error,
      // bubble up as a transport-level failure.
      const fresh = await this.integrationRepository.findOne({
        where: { id: integration.id },
      });
      if (fresh?.status === 'error' && fresh.statusReason === 'auth_failed') {
        const mallId =
          (fresh.credentials as Cafe24Credentials | undefined)?.mall_id ??
          integration.id;
        throw new Cafe24AuthFailedError(401, mallId, fresh.lastError);
      }
      throw new Cafe24TransportFailedError(err);
    }

    // Worker succeeded. Re-fetch from DB and mutate the caller's reference
    // so the next stage of call() sees the refreshed bearer.
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

  async refreshAccessToken(integration: Integration): Promise<void> {
    const creds = (integration.credentials ?? {}) as Cafe24Credentials;
    if (!creds.mall_id || !creds.refresh_token) {
      throw new Cafe24IncompleteCredentialsError(
        'mall_id and refresh_token are required for refresh',
      );
    }

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
      throw new Cafe24TransportFailedError(err);
    }

    if (response.status === 401 || response.status === 403) {
      const body = await safeReadJson(response);
      const bodyForLog =
        typeof body === 'string'
          ? body.slice(0, 500)
          : JSON.stringify(body).slice(0, 500);
      this.logger.warn(
        `Cafe24 token refresh ${response.status} mall=${creds.mall_id}: ${bodyForLog}`,
      );
      await this.markAuthFailed(integration);
      throw new Cafe24AuthFailedError(response.status, creds.mall_id, body);
    }
    if (!response.ok) {
      const body = await safeReadJson(response);
      throw new Error(
        `Cafe24 token refresh failed (${response.status}): ${JSON.stringify(body)}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const accessToken = readString(data, 'access_token');
    const refreshToken = readString(data, 'refresh_token');
    const expiresIn = readNumber(data, 'expires_in');
    if (!accessToken) {
      throw new Error('Cafe24 token refresh response missing access_token');
    }
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 2 * 60 * 60 * 1000); // Cafe24 default 2h

    // Atomic 4-field UPDATE — spec §10.5. credentials + tokenExpiresAt are
    // co-located on the Integration row so a single save() is atomic.
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Integration);
      const fresh = await repo.findOne({ where: { id: integration.id } });
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

  private async markAuthFailed(integration: Integration): Promise<void> {
    try {
      await this.integrationRepository.update(integration.id, {
        status: 'error',
        statusReason: 'auth_failed',
        lastError: {
          code: 'CAFE24_AUTH_FAILED',
          message: 'Cafe24 returned 401/403',
          at: new Date().toISOString(),
        },
      });
      integration.status = 'error';
      integration.statusReason = 'auth_failed';
    } catch (err) {
      this.logger.warn(
        `Failed to mark Integration ${integration.id} as auth_failed: ${extractErrorMessage(err)}`,
      );
    }
  }

  private async executeWithRateLimit(
    integration: Integration,
    mallId: string,
    accessToken: string,
    opts: Cafe24CallOptions,
    attempt: number,
  ): Promise<Cafe24CallResult> {
    const url = this.buildUrl(mallId, opts.path, opts.query);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

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
      throw new Cafe24TransportFailedError(err);
    } finally {
      clearTimeout(timer);
    }

    const respHeaders = readHeaderMap(response.headers);
    const callMeta = parseRateLimitHeaders(respHeaders);

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
      // body cannot blow up the log line.
      const bodyForLog =
        typeof errBody === 'string'
          ? errBody.slice(0, 500)
          : JSON.stringify(errBody).slice(0, 500);
      this.logger.warn(
        `Cafe24 API ${response.status} mall=${mallId} ${opts.method} ${opts.path}: ${bodyForLog}`,
      );
      await this.markAuthFailed(integration);
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
 * Precedence: `Integration.tokenExpiresAt` (spec §10.5 canonical column) →
 * `credentials.expires_at` (JSONB mirror). Returns null when neither is set
 * or both parse as invalid. The entity column wins when both are present
 * because the atomic 4-field UPDATE in `refreshAccessToken` writes the
 * column last and the OAuth callback path historically only wrote the
 * column — trusting the column avoids a stale-mirror trap.
 *
 * Exported because the BullMQ refresh worker re-evaluates expiry on job
 * pickup (race protection: a refresh that completed milliseconds before
 * the worker started should short-circuit).
 */
export function resolveTokenExpiry(integration: {
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
  const creds = (integration.credentials ?? {}) as Cafe24Credentials;
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
