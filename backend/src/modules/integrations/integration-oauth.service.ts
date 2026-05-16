import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, Repository } from 'typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  INSTALL_TOKEN_BYTES,
  buildCafe24InstallUrl,
  buildOauthCallbackUrl,
} from './third-party-oauth.constants';
import { Integration } from './entities/integration.entity';
import {
  IntegrationOAuthState,
  OAuthStateMode,
} from './entities/integration-oauth-state.entity';
import { IntegrationOAuthPreview } from './entities/integration-oauth-preview.entity';
import { findService } from './services/service-registry';
import { decryptJson } from './services/credentials-transformer';
import { isPostgresUniqueViolation } from '../../common/db/pg-error';

const STATE_TTL_MS = 10 * 60 * 1000;
const PREVIEW_TTL_MS = 10 * 60 * 1000;

/**
 * SEC H-2: Cafe24 install_token mismatch 회복 흐름 (`tryRecoverByMallId`)
 * 의 HMAC trial 후보 수 상한. 정상 운영에서 같은 mall_id 의 cafe24 row 는
 * 보통 1~2 개 (V046 partial UNIQUE 가 workspace+mall 단위 dedup). 5 이상이면
 * 의도적 DoS amplification 가능성이 있어 회복 자체를 포기 (404 반환).
 */
const RECOVERY_CANDIDATE_LIMIT = 5;

export const ALLOWED_OAUTH_PROVIDERS = ['google', 'github', 'cafe24'] as const;
export type OAuthProvider = (typeof ALLOWED_OAUTH_PROVIDERS)[number];

/**
 * Static authorize URLs for providers that have a single global authorize
 * endpoint. Cafe24 is mall_id-dependent — `cafe24AuthorizeUrl(mallId)`.
 */
const STATIC_AUTHORIZE_URLS: Record<'google' | 'github', string> = {
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
  github: 'https://github.com/login/oauth/authorize',
};

const STATIC_TOKEN_URLS: Record<'google' | 'github', string> = {
  google: 'https://oauth2.googleapis.com/token',
  github: 'https://github.com/login/oauth/access_token',
};

const CAFE24_MALL_ID_PATTERN = /^[a-z0-9-]{3,50}$/;

/**
 * Integration OAUTH_STUB_MODE 는 dev/test 환경에서만 활성화 가능. staging
 * 또는 production 으로 잘못 배포되면 stub 토큰이 실제 사용자 통합에 발급되어
 * 인증 우회를 허용할 위험이 있어 NODE_ENV 화이트리스트로 강제 제한한다.
 */
function isIntegrationOAuthStubEnabled(): boolean {
  if (process.env.OAUTH_STUB_MODE !== 'true') return false;
  const env = process.env.NODE_ENV;
  return env === 'test' || env === 'development';
}

function cafe24AuthorizeUrl(mallId: string): string {
  return `https://${mallId}.cafe24api.com/api/v2/oauth/authorize`;
}

function cafe24TokenUrl(mallId: string): string {
  return `https://${mallId}.cafe24api.com/api/v2/oauth/token`;
}

/**
 * Begin-time metadata for cafe24 OAuth (also persisted on the state row's
 * `provider_meta` JSONB column until callback consumption). Public apps may
 * omit `client_id`/`client_secret` (env-provided); private apps must supply
 * both — the values exist on the wire only for the state TTL (10 min).
 */
export interface Cafe24BeginMeta {
  mall_id: string;
  app_type: 'public' | 'private';
  client_id?: string;
  client_secret?: string;
}

export interface BeginParams {
  workspaceId: string;
  userId: string;
  service: string;
  scopes: string[];
  mode: OAuthStateMode;
  integrationId?: string;
  integrationName?: string;
  scope?: 'personal' | 'organization';
  /** Provider-specific begin-time metadata. Currently used by cafe24. */
  providerMeta?: Cafe24BeginMeta | Record<string, unknown>;
}

export type BeginResult =
  | { authUrl: string; state: string }
  | {
      mode: 'cafe24_private_pending';
      integrationId: string;
      appUrl: string;
      callbackUrl: string;
      /** scopes 가 변경된 경우 (request-scopes 진입점에서 채워짐) */
      scopesAdded?: string[];
    };

/** Cafe24 App URL 호출 파라미터 (테스트 실행 시 Cafe24가 전송) */
export interface Cafe24InstallQuery {
  mall_id: string;
  timestamp: string;
  hmac: string;
  shop_no?: string;
  user_id?: string;
  user_name?: string;
  user_type?: string;
  lang?: string;
  nation?: string;
  is_multi_shop?: string;
  auth_config?: string;
  /** Raw query string (HMAC 검증에 사용) */
  rawQuery: string;
}

export interface CallbackResult {
  mode: OAuthStateMode;
  provider: string;
  integrationId?: string;
  previewToken?: string;
}

/**
 * Diagnostic context attached to exceptions thrown from `handleCallback` after
 * the OAuth state row has been consumed (i.e. once we know which Integration
 * row this callback belongs to). The controller reads this back from the
 * caught error and writes `last_error` / `status_reason` onto the row via
 * `markIntegrationCallbackError`, so the user can see why their callback
 * failed without DB / log access. Pre-consumption errors (state mismatch)
 * have no integrationId to attach.
 */
export interface CallbackContext {
  integrationId: string;
  workspaceId: string;
  mode: OAuthStateMode;
}

export function attachCallbackContext<E extends Error>(
  err: E,
  context: CallbackContext,
): E {
  (err as E & { context?: CallbackContext }).context = context;
  return err;
}

/**
 * Read the diagnostic context off a thrown error, if present. Internal —
 * the only consumer is `handleCallbackWithErrorCapture` below; callers
 * outside the service should use that wrapper instead of reaching into
 * error internals.
 */
function callbackContextOf(err: unknown): CallbackContext | undefined {
  if (err && typeof err === 'object' && 'context' in err) {
    return (err as { context?: CallbackContext }).context;
  }
  return undefined;
}

function readErrorCode(err: unknown): string {
  const code = (err as { response?: { code?: string } })?.response?.code;
  return typeof code === 'string' ? code : OAUTH_CALLBACK_FAILED;
}

function readErrorMessage(err: unknown): string {
  const r =
    (err as { response?: { message?: string }; message?: string }) ?? {};
  return r.response?.message ?? r.message ?? 'OAuth failed';
}

/** Generic fallback code used when a thrown error has no NestJS response.code. */
export const OAUTH_CALLBACK_FAILED = 'OAUTH_CALLBACK_FAILED';

/** Hard cap on lastError.message length to keep the JSONB column bounded
 * and prevent ballooning from malicious / runaway provider responses. */
export const LAST_ERROR_MESSAGE_MAX_LEN = 200;

/** Patterns we mask before persisting lastError.message — provider errors
 * occasionally echo back tokens or partial secrets, and we never want those
 * to land in the DB even briefly. The match is conservative: regex hits
 * replace the entire matched run with `***`.
 *
 * 2026-05-16 (SEC-C2) — Cafe24 가 token endpoint 에러 응답에 `client-secret`
 * (하이픈) 또는 `secret: ...` 단독 키워드를 echo 하는 사례가 운영 로그에서
 * 확인되어 패턴을 확장. 이 sanitizer 는 더 이상 OAuth 흐름 전용이 아니며
 * cafe24-api.client.ts 의 raw error 로그·throw 경로도 동일 패턴을
 * 거쳐야 한다 (export 되어 cross-module 재사용). */
export const SECRET_LEAK_PATTERNS: ReadonlyArray<RegExp> = [
  // OAuth-style bearer tokens
  /\bBearer\s+[A-Za-z0-9._\-+/=]+/gi,
  // Cafe24 token endpoints frequently include the secret in body / URL.
  // 하이픈 변형 (`client-secret`) + JSON 따옴표 변형 (`"client_secret":"..."`)
  // 까지 함께 매칭한다. value 분기 두 가지:
  //   (a) `="abc"` / `:"abc"` — quoted (JSON or URL-encoded body)
  //   (b) `=abc` / `:abc` — bare token (URL query or shell echo)
  /"?\b(client[_-]secret|access[_-]token|refresh[_-]token|id[_-]token|api[_-]key|password|passwd|pwd)"?\s*[=:]\s*(?:"[^"]*"|[^\s&'"]+)/gi,
  // 단독 `secret` 키워드 (JSON `"secret":"..."` 또는 query `secret=...`)
  /"?\bsecret"?\s*[=:]\s*(?:"[^"]*"|[^\s&'"]+)/gi,
  // Authorization header values
  /\bAuthorization:\s*\S+/gi,
];

export function sanitizeLastErrorMessage(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return raw;
  let masked = raw;
  for (const pattern of SECRET_LEAK_PATTERNS) {
    masked = masked.replace(pattern, '***');
  }
  return masked.length > LAST_ERROR_MESSAGE_MAX_LEN
    ? masked.slice(0, LAST_ERROR_MESSAGE_MAX_LEN) + '…'
    : masked;
}

interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  tokenExpiresAt: Date | null;
  providerMeta: Record<string, unknown>;
}

/**
 * TypeORM `dataSource.query()` 는 raw SQL 결과를 column 이름 그대로 반환한다.
 * snake_case 로 정의된 column 은 그 이름으로 노출되어 entity property
 * (camelCase) 와 불일치하고, `encryptedJsonTransformer` 같은 column
 * transformer 도 raw query 경로에서는 실행되지 않는다.
 *
 * DELETE…RETURNING 의 raw row 를 entity 형태에 가까운 camelCase 객체로
 * 정규화해 단일 진실 지점을 만든다 — 호출자는 이 함수의 반환값만 다루므로
 * snake_case ↔ camelCase 혼선을 컴파일러로 잡을 수 있다.
 */
function normalizeRawStateRow(
  raw: Record<string, unknown>,
): IntegrationOAuthState {
  // Already-entity-shape input (test mocks, ORM-loaded rows) lacks snake_case
  // marker columns. Passthrough so callers don't have to know which path
  // produced the row.
  if (!('workspace_id' in raw)) {
    return raw as unknown as IntegrationOAuthState;
  }
  const providerMetaRaw = raw.provider_meta;
  const providerMeta =
    providerMetaRaw !== null && providerMetaRaw !== undefined
      ? (decryptJson<Record<string, unknown>>(providerMetaRaw as string) ??
        null)
      : null;
  return {
    id: raw.id as string,
    state: raw.state as string,
    workspaceId: raw.workspace_id as string,
    userId: raw.user_id as string,
    provider: raw.provider as string,
    serviceType: raw.service_type as string,
    mode: raw.mode as OAuthStateMode,
    integrationId: (raw.integration_id ?? null) as string | null,
    requestedScopes: (raw.requested_scopes ?? []) as string[],
    integrationName: (raw.integration_name ?? null) as string | null,
    scope: (raw.scope ?? null) as string | null,
    providerMeta,
    expiresAt: raw.expires_at as Date,
    createdAt: raw.created_at as Date,
  } as IntegrationOAuthState;
}

/**
 * preview row 의 raw → entity 정규화. credentials JSONB 도 `decryptJson`
 * 으로 복호화한다 (state row 와 동일 transformer 패턴).
 */
function normalizeRawPreviewRow(
  raw: Record<string, unknown>,
): IntegrationOAuthPreview {
  // 이미 entity-shape 면 그대로 통과 (test mocks, ORM-loaded rows).
  if (!('workspace_id' in raw)) {
    return raw as unknown as IntegrationOAuthPreview;
  }
  // credentials 는 always encrypted JSONB. transformer 가 raw query 에서
  // bypass 되므로 명시 복호화. 손상 시 decryptJson 이 null 반환 →
  // 호출자의 corrupted-row 분기로 처리됨.
  const credentialsRaw = raw.credentials;
  let credentials: Record<string, unknown>;
  if (typeof credentialsRaw === 'string' && credentialsRaw.startsWith('enc:')) {
    credentials = decryptJson<Record<string, unknown>>(credentialsRaw) ?? {};
  } else if (typeof credentialsRaw === 'string') {
    // SEC-C1/H-5: `enc:` prefix 가 없는 plaintext 문자열은 transformer 가
    // 의도적으로 우회된 흔적이다 (직접 DB 쓰기 또는 마이그레이션 누락).
    // 옛 코드는 "legacy 방어" 명목으로 조용히 JSON.parse 했으나, 이는
    // 암호화 invariant 를 우회하는 경로를 열어둔다. 명시적으로 invalid 로
    // 마크해 호출자가 `OAUTH_PREVIEW_INVALID` 분기로 처리하게 한다.
    // 운영 진단을 위해 warn 로그도 함께 남긴다.
    console.warn(
      `[security] preview row credentials is plaintext (no 'enc:' prefix) — refusing to consume. previewToken=${typeof raw.preview_token === 'string' ? raw.preview_token.slice(0, 8) : 'unknown'}…`,
    );
    credentials = { __invalid: true };
  } else {
    credentials = (credentialsRaw ?? {}) as Record<string, unknown>;
  }
  return {
    previewToken: raw.preview_token as string,
    workspaceId: raw.workspace_id as string,
    userId: raw.user_id as string,
    serviceType: raw.service_type as string,
    credentials,
    tokenExpiresAt: (raw.token_expires_at ?? null) as Date | null,
    expiresAt: raw.expires_at as Date,
    createdAt: raw.created_at as Date,
  } as IntegrationOAuthPreview;
}

/**
 * `precheckCafe24Mall` 의 conflict 분기 우선순위 — 가장 제한적인 상태부터.
 * `connected` 는 진짜 중복(완료된 통합), `pending_install` 은 install 중(재사용
 * 가능), `error` 는 재인증 가능, `expired` 는 정리 후 재등록 가능.
 * frontend 의 i18n 메시지 분기와 동일한 순서 (`integration-response.dto.ts` 의
 * `Cafe24PrecheckResultDto.status` enum 주석 참조).
 */
const CAFE24_PRECHECK_STATUS_PRIORITY = [
  'connected',
  'pending_install',
  'error',
  'expired',
] as const;
type Cafe24PrecheckStatus = (typeof CAFE24_PRECHECK_STATUS_PRIORITY)[number];

@Injectable()
export class IntegrationOAuthService {
  private readonly logger = new Logger(IntegrationOAuthService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationOAuthState)
    private readonly stateRepository: Repository<IntegrationOAuthState>,
    @InjectRepository(IntegrationOAuthPreview)
    private readonly previewRepository: Repository<IntegrationOAuthPreview>,
    private readonly dataSource: DataSource,
  ) {}

  static isAllowedProvider(value: string): value is OAuthProvider {
    return (ALLOWED_OAUTH_PROVIDERS as readonly string[]).includes(value);
  }

  async begin(params: BeginParams): Promise<BeginResult> {
    const service = findService(params.service);
    if (!service?.oauthProvider) {
      throw new BadRequestException({
        code: 'INTEGRATION_OAUTH_UNSUPPORTED',
        message: `Service does not support OAuth: ${params.service}`,
      });
    }

    // Resolve client_id + cafe24-specific begin metadata up front. Cafe24
    // private apps supply client_id/secret via body; public apps and all
    // other providers read from env. mall_id validation is enforced here so
    // an invalid value never reaches the state row.
    let clientId: string;
    let providerMeta: Record<string, unknown> | null = null;
    let authorizeBaseUrl: string;
    if (service.oauthProvider === 'cafe24') {
      const meta = (params.providerMeta ?? {}) as Partial<Cafe24BeginMeta>;
      if (!meta.mall_id || !CAFE24_MALL_ID_PATTERN.test(meta.mall_id)) {
        throw new BadRequestException({
          code: 'CAFE24_INVALID_MALL_ID',
          message:
            'mall_id is required and must match /^[a-z0-9-]{3,50}$/ — Cafe24 mall identifier format',
        });
      }
      if (meta.app_type !== 'public' && meta.app_type !== 'private') {
        throw new BadRequestException({
          code: 'CAFE24_INVALID_APP_TYPE',
          message: "app_type must be 'public' or 'private' for cafe24",
        });
      }
      if (meta.app_type === 'private') {
        if (!meta.client_id || !meta.client_secret) {
          throw new BadRequestException({
            code: 'CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED',
            message:
              'app_type=private requires client_id and client_secret in the begin body',
          });
        }
        // Private app: Cafe24 OAuth cannot be initiated by us — the flow
        // starts from Cafe24 Developers' "테스트 실행". Only create a new
        // pending_install Integration when mode='new'. reauthorize and
        // request_scopes paths must go through the handleInstall flow instead.
        if (params.mode !== 'new') {
          throw new BadRequestException({
            code: 'CAFE24_PRIVATE_APP_USE_TEST_RUN',
            message:
              'Private Cafe24 apps cannot be reauthorized via this endpoint — trigger "테스트 실행" on Cafe24 Developers to restart the install flow',
          });
        }
        return this.createPrivatePendingIntegration(
          params,
          meta as Required<
            Pick<Cafe24BeginMeta, 'mall_id' | 'client_id' | 'client_secret'>
          > &
            Cafe24BeginMeta,
        );
      } else {
        const envClientId = process.env.CAFE24_CLIENT_ID;
        if (!envClientId) {
          throw new InternalServerErrorException({
            code: 'OAUTH_CONFIG_MISSING',
            message:
              'CAFE24_CLIENT_ID env is not configured — required for public-app OAuth flow',
          });
        }
        clientId = envClientId;
        // Public-flow begin pre-check (2026-05-16): block before any OAuth
        // round-trip if `(workspaceId, mall_id)` already has a `connected`
        // cafe24 Integration. Without this, the user would only learn of
        // the conflict at finalize (`POST /api/integrations`) — *after*
        // completing the consent flow — where V045 partial UNIQUE rejects
        // the INSERT. spec/2-navigation/4-integration.md §9.2 Rationale
        // "Cafe24 Public 흐름의 begin-time 사전 가드 추가". 코드 재사용:
        // private 흐름과 동일한 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` —
        // spec line 725 가 이미 "app_type 무관" 으로 정의해 의미상 정합.
        const existingConnected = await this.findConnectedCafe24MallIntegration(
          params.workspaceId,
          meta.mall_id,
        );
        if (existingConnected) {
          throw new ConflictException({
            code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
            message: `A Cafe24 integration for mall_id "${meta.mall_id}" already exists and is connected. Use the existing integration or delete it first.`,
            integrationId: existingConnected.id,
          });
        }
      }
      providerMeta = {
        mall_id: meta.mall_id,
        app_type: meta.app_type,
      };
      authorizeBaseUrl = cafe24AuthorizeUrl(meta.mall_id);
    } else {
      const clientIdKey = `${service.oauthProvider.toUpperCase()}_CLIENT_ID`;
      const envClientId = process.env[clientIdKey];
      if (!envClientId) {
        throw new InternalServerErrorException({
          code: 'OAUTH_CONFIG_MISSING',
          message: `OAuth client ID (${clientIdKey}) is not configured`,
        });
      }
      clientId = envClientId;
      authorizeBaseUrl = STATIC_AUTHORIZE_URLS[service.oauthProvider];
    }

    // Fire-and-forget purge of expired records.
    void this.purgeExpired();

    const state = randomBytes(24).toString('hex');
    const record = this.stateRepository.create({
      state,
      workspaceId: params.workspaceId,
      userId: params.userId,
      provider: service.oauthProvider,
      serviceType: params.service,
      mode: params.mode,
      integrationId: params.integrationId ?? null,
      requestedScopes: params.scopes,
      integrationName: params.integrationName ?? null,
      scope: params.scope ?? null,
      providerMeta,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    });
    await this.stateRepository.save(record);

    const appUrl = process.env.APP_URL || 'http://localhost:3011';
    const redirectUri = buildOauthCallbackUrl(appUrl, service.oauthProvider);
    // Cafe24 deviates from RFC 6749 §3.3 (space-delimited) and requires
    // comma-delimited scopes on /oauth/authorize. Sending space-delimited
    // scopes is rejected with `invalid_scope` even for a single valid
    // scope, because Cafe24's parser treats the whole string as one token.
    // Sources: developers.cafe24.com /docs/...oauth/oauthcode examples and
    // the official cafe24_app_sample StoreToken.java getCodeRedirectUrl.
    const scopeSeparator = service.oauthProvider === 'cafe24' ? ',' : ' ';
    const urlParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: params.scopes.join(scopeSeparator),
      state,
      response_type: 'code',
    });

    return {
      authUrl: `${authorizeBaseUrl}?${urlParams.toString()}`,
      state,
    };
  }

  async handleCallback(
    provider: string,
    query: { code?: string; state?: string; error?: string },
  ): Promise<CallbackResult> {
    if (!IntegrationOAuthService.isAllowedProvider(provider)) {
      throw new BadRequestException({
        code: 'OAUTH_PROVIDER_UNKNOWN',
        message: 'Unsupported OAuth provider',
      });
    }
    if (query.error) {
      throw new BadRequestException({
        code: 'OAUTH_DENIED',
        message: 'Authorization was denied',
      });
    }
    if (!query.state) {
      throw new BadRequestException({
        code: 'OAUTH_STATE_MISSING',
        message: 'Missing state parameter',
      });
    }
    if (!query.code) {
      throw new BadRequestException({
        code: 'OAUTH_CODE_MISSING',
        message: 'Missing authorization code',
      });
    }

    // Atomically consume the state row. DELETE … RETURNING guarantees a single
    // winner across concurrent callbacks.
    //
    // TypeORM 0.3.x 의 PostgresQueryRunner 는 **DELETE/UPDATE** 명령에 한해
    // `[rowsArray, rowCount]` 튜플로 raw 결과를 반환하고, 그 외 명령은
    // 단순 rows array 를 반환한다 (PostgresQueryRunner.query 의 switch
    // 분기 참조). 따라서 DELETE … RETURNING 의 결과는 `result[0]` 으로
    // rows array 를 꺼내 사용한다.
    const queryResult = await this.dataSource.query<
      [IntegrationOAuthState[], number]
    >('DELETE FROM integration_oauth_state WHERE state = $1 RETURNING *', [
      query.state,
    ]);
    const consumed = queryResult[0];
    if (!consumed || consumed.length === 0) {
      throw new BadRequestException({
        code: 'OAUTH_STATE_MISMATCH',
        message: 'Invalid or already consumed OAuth state',
      });
    }
    // Raw SQL DELETE…RETURNING 의 컬럼은 snake_case 이고 transformer 도
    // bypass 된다. `normalizeRawStateRow` 로 entity-shape (camelCase +
    // decrypted providerMeta) 단일 진실 객체로 변환해 이하 코드가 entity
    // property 만 다루도록 한다.
    const record = normalizeRawStateRow(
      consumed[0] as unknown as Record<string, unknown>,
    );
    // Build the diagnostic context once — every post-state-consumption throw
    // attaches this so the controller can surface the failure on the row
    // (see `markIntegrationCallbackError`). Pre-consumption throws (state
    // mismatch above) have no integrationId yet and intentionally omit it.
    const context: CallbackContext | undefined = record.integrationId
      ? {
          integrationId: record.integrationId,
          workspaceId: record.workspaceId,
          mode: record.mode,
        }
      : undefined;
    const withContext = <E extends Error>(err: E): E =>
      context ? attachCallbackContext(err, context) : err;

    if (record.provider !== provider) {
      throw withContext(
        new BadRequestException({
          code: 'OAUTH_STATE_MISMATCH',
          message: 'Provider mismatch for OAuth state',
        }),
      );
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      throw withContext(
        new BadRequestException({
          code: 'OAUTH_STATE_EXPIRED',
          message: 'OAuth state has expired',
        }),
      );
    }

    let exchange: TokenExchangeResult;
    try {
      exchange = await this.exchangeCodeForToken(
        provider,
        query.code,
        record.requestedScopes,
        record.providerMeta ?? null,
      );
    } catch (err) {
      throw withContext(err as Error);
    }

    const credentials: Record<string, unknown> = {
      access_token: exchange.accessToken,
      refresh_token: exchange.refreshToken,
      scopes: exchange.scopes,
      provider,
      ...exchange.providerMeta,
    };
    // Mirror tokenExpiresAt into the credentials JSONB so the shape produced
    // by the initial callback matches the one produced by Cafe24ApiClient's
    // atomic refresh path (spec §10.5). Without this mirror, freshly-
    // connected Cafe24 integrations carried a NULL `credentials.expires_at`
    // and the legacy proactive-refresh gate (which read only the JSONB) was
    // skipping them silently — surfacing 401 (`access_token time expired`)
    // on the first call after Cafe24's 2h TTL.
    if (exchange.tokenExpiresAt) {
      credentials.expires_at = exchange.tokenExpiresAt.toISOString();
    }

    // Cafe24-specific: persist mall_id / app_type (+ private-app credentials)
    // into the integration credentials so subsequent token refresh and API
    // calls can rebuild the mall_id-dependent endpoints without ever
    // re-asking the user. The state row's provider_meta is consumed here
    // and never written back to the DB beyond this credential payload.
    if (provider === 'cafe24' && record.providerMeta) {
      const pm = record.providerMeta as Partial<Cafe24BeginMeta>;
      if (pm.mall_id) credentials.mall_id = pm.mall_id;
      if (pm.app_type) credentials.app_type = pm.app_type;
      if (pm.app_type === 'private') {
        if (pm.client_id) credentials.client_id = pm.client_id;
        if (pm.client_secret) credentials.client_secret = pm.client_secret;
      }
    }

    if (record.mode === 'new') {
      const previewToken = `tmp_${randomBytes(16).toString('hex')}`;
      await this.previewRepository.save(
        this.previewRepository.create({
          previewToken,
          workspaceId: record.workspaceId,
          userId: record.userId,
          serviceType: record.serviceType,
          credentials,
          tokenExpiresAt: exchange.tokenExpiresAt,
          expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
        }),
      );
      return { mode: 'new', provider, previewToken };
    }

    if (!record.integrationId) {
      throw withContext(
        new BadRequestException({
          code: 'OAUTH_STATE_INVALID',
          message: 'OAuth state has no associated integration',
        }),
      );
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Integration);
        // CONC H-3 (2026-05-16): `SELECT ... FOR UPDATE` 로 row lock 을 잡아
        // 동시 reauthorize callback 의 lost update 를 차단. PostgreSQL READ
        // COMMITTED 에서 두 트랜잭션이 같은 row 를 동시 read → save 하면
        // last-write-wins 로 한쪽 토큰이 사라지고, Cafe24 의 refresh_token
        // rotation 정책 상 살아남은 토큰도 무효일 수 있다. pessimistic_write
        // lock 이 두 번째 트랜잭션을 첫 commit 까지 대기시켜 serial 보장.
        const integration = await repo.findOne({
          where: { id: record.integrationId!, workspaceId: record.workspaceId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!integration) {
          throw new NotFoundException({
            code: 'RESOURCE_NOT_FOUND',
            message: 'Integration not found',
          });
        }
        if (
          record.mode === 'reauthorize' ||
          integration.status === 'pending_install'
        ) {
          integration.credentials = credentials;
        } else {
          integration.credentials = {
            ...integration.credentials,
            ...credentials,
            scopes: exchange.scopes,
          };
        }
        integration.status = 'connected';
        integration.statusReason = null;
        integration.lastError = null;
        integration.tokenExpiresAt = exchange.tokenExpiresAt;
        integration.lastRotatedAt = new Date();
        // install_token 은 callback 성공 시 **보존** — Cafe24 의 "앱으로
        // 가기" 등 post-install navigation 이 같은 App URL 을 재호출하므로
        // 통합 lifetime 동안 유효한 persistent 식별자로 유지한다.
        // NULL 처리는 24h TTL 만료 (status='expired', status_reason=
        // 'install_timeout') 와 통합 삭제(row 자체 소멸) 두 경로에서만 발생.
        // 자세한 근거는 spec/2-navigation/4-integration.md ## Rationale
        // "Cafe24 App URL 재호출 흐름 — install_token persistent 격상" 항.
        // Backfill plain `mall_id` column for cafe24 rows if it's still
        // NULL — pre-V045 rows pass through this connected path on next
        // re-auth and get the plain projection set. New rows already have
        // it set by createPrivatePendingIntegration / public-flow begin.
        if (
          provider === 'cafe24' &&
          !integration.mallId &&
          typeof credentials.mall_id === 'string'
        ) {
          integration.mallId = credentials.mall_id;
        }
        await repo.save(integration);
      });
    } catch (err) {
      throw withContext(err as Error);
    }

    return {
      mode: record.mode,
      provider,
      integrationId: record.integrationId,
    };
  }

  /**
   * Public callback entry point — wraps `handleCallback` and, when it
   * throws after the state row has been consumed, records the diagnostic
   * onto the Integration row before re-throwing. The controller only needs
   * to catch and render error HTML; it does not need to know about the
   * callback context plumbing.
   *
   * spec/2-navigation/4-integration.md §10.4.
   */
  async handleCallbackWithErrorCapture(
    provider: string,
    query: { code?: string; state?: string; error?: string },
  ): Promise<CallbackResult> {
    try {
      return await this.handleCallback(provider, query);
    } catch (err) {
      const ctx = callbackContextOf(err);
      if (ctx?.integrationId && ctx.workspaceId) {
        const errorCode = readErrorCode(err);
        const message = readErrorMessage(err);
        // Best-effort — markIntegrationCallbackError already has its own
        // try/catch internally, the .catch here is defence-in-depth so a
        // future refactor cannot block the caller from re-throwing.
        await this.markIntegrationCallbackError(
          ctx.integrationId,
          ctx.workspaceId,
          errorCode,
          message,
        ).catch(() => {
          /* swallow — never block the original error from propagating */
        });
      }
      throw err;
    }
  }

  /**
   * Record a callback failure on the Integration row so the user can see the
   * diagnostic in the UI without log / DB access. Best-effort — never throws,
   * since this is itself an error-handling path. See spec/2-navigation/4-integration.md
   * §10.4 for the status preservation rules.
   *
   * - `pending_install` rows keep their status; the caller can retry "테스트
   *   실행" on Cafe24 after fixing credentials.
   * - `connected` rows with code-exchange failure (OAUTH_TOKEN_EXCHANGE_FAILED)
   *   transition to `error(auth_failed)` per the existing §10.4 policy.
   * - All other `connected` failures (state mismatch / expired / not found)
   *   leave status alone and only update `last_error`.
   * - A vanished row (resource_not_found) is silently skipped.
   */
  async markIntegrationCallbackError(
    integrationId: string,
    workspaceId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const integration = await this.integrationRepository.findOne({
        where: { id: integrationId, workspaceId },
      });
      if (!integration) {
        // Row was deleted or workspace mismatch — nothing to update.
        return;
      }
      const lastError = {
        code: errorCode,
        message: sanitizeLastErrorMessage(errorMessage),
        at: new Date().toISOString(),
      };
      integration.lastError = lastError;
      if (integration.status === 'pending_install') {
        // status preserved — user can retry via cafe24 "테스트 실행"
        integration.statusReason = errorCode.toLowerCase();
      } else if (
        integration.status === 'connected' &&
        errorCode === 'OAUTH_TOKEN_EXCHANGE_FAILED'
      ) {
        // §10.4: reauthorize code-exchange failure on a connected row
        integration.status = 'error';
        integration.statusReason = 'auth_failed';
      }
      // Otherwise (connected + non-token error): last_error only.
      await this.integrationRepository.save(integration);
    } catch (err) {
      this.logger.warn(
        `markIntegrationCallbackError(${integrationId}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async consumePreviewToken(
    previewToken: string,
    workspaceId: string,
    userId: string,
  ): Promise<{
    credentials: Record<string, unknown>;
    serviceType: string;
    tokenExpiresAt: Date | null;
  }> {
    // DELETE … RETURNING for atomicity — only one consumer can win.
    // Ownership (workspace_id + user_id) 을 WHERE 절에서 직접 매칭하여,
    // 토큰 값을 알아낸 비소유자가 DELETE 만 수행해 DoS 시키는 시나리오를
    // 차단한다. 비소유자의 시도는 0 rows 로 반환되어 OAUTH_PREVIEW_INVALID
    // 와 동일한 메시지로 fallthrough — 토큰 존재/소유 여부를 노출하지 않음.
    // TypeORM 0.3.x 의 PostgresQueryRunner 는 DELETE 결과를
    // `[rowsArray, rowCount]` 튜플로 반환하므로 `result[0]` 으로
    // rows array 를 꺼낸다 (handleCallback 의 state 소비와 동일 패턴).
    const queryResult = await this.dataSource.query<
      [IntegrationOAuthPreview[], number]
    >(
      'DELETE FROM integration_oauth_preview WHERE preview_token = $1 AND workspace_id = $2 AND user_id = $3 RETURNING *',
      [previewToken, workspaceId, userId],
    );
    const consumed = queryResult[0];
    if (!consumed || consumed.length === 0) {
      throw new BadRequestException({
        code: 'OAUTH_PREVIEW_INVALID',
        message: 'OAuth preview token is invalid or already used',
      });
    }
    // Raw SQL DELETE…RETURNING 의 컬럼은 snake_case + credentials transformer
    // bypass. `normalizeRawPreviewRow` 가 entity-shape (camelCase + decrypted
    // credentials) 단일 진실 객체로 변환한다.
    const preview = normalizeRawPreviewRow(
      consumed[0] as unknown as Record<string, unknown>,
    );
    if (new Date(preview.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'OAUTH_PREVIEW_EXPIRED',
        message: 'OAuth preview token has expired',
      });
    }
    if (
      preview.credentials &&
      (preview.credentials as { __invalid?: boolean }).__invalid
    ) {
      throw new BadRequestException({
        code: 'INTEGRATION_CREDENTIALS_INVALID',
        message: 'OAuth preview credentials are corrupted',
      });
    }
    return {
      credentials: preview.credentials,
      serviceType: preview.serviceType,
      tokenExpiresAt: preview.tokenExpiresAt
        ? new Date(preview.tokenExpiresAt)
        : null,
    };
  }

  // ---------------------------------------------------------------------
  // Token exchange
  // ---------------------------------------------------------------------

  private async exchangeCodeForToken(
    provider: OAuthProvider,
    code: string,
    requestedScopes: string[],
    providerMeta: Record<string, unknown> | null,
  ): Promise<TokenExchangeResult> {
    if (isIntegrationOAuthStubEnabled()) {
      return stubTokenResult(provider, requestedScopes, providerMeta);
    }
    if (
      process.env.OAUTH_STUB_MODE === 'true' &&
      !isIntegrationOAuthStubEnabled()
    ) {
      this.logger.error(
        `OAUTH_STUB_MODE is set in NODE_ENV=${process.env.NODE_ENV ?? '(unset)'} — ignoring. Stub mode is only honored in NODE_ENV=test or development; fix the deployment configuration.`,
      );
    }

    // Resolve client_id / client_secret / token URL with provider-specific
    // rules. Cafe24: mall_id-dependent URL + per-mall private-app creds may
    // come from the state row's provider_meta (private) or env (public).
    let clientId: string;
    let clientSecret: string;
    let tokenUrl: string;
    let isCafe24 = false;
    if (provider === 'cafe24') {
      isCafe24 = true;
      const pm = (providerMeta ?? {}) as Partial<Cafe24BeginMeta>;
      if (!pm.mall_id) {
        throw new BadRequestException({
          code: 'CAFE24_INVALID_MALL_ID',
          message: 'mall_id missing on OAuth state — cannot build token URL',
        });
      }
      if (pm.app_type === 'private') {
        if (!pm.client_id || !pm.client_secret) {
          throw new BadRequestException({
            code: 'CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED',
            message:
              'private app credentials missing on OAuth state — cannot exchange code',
          });
        }
        clientId = pm.client_id;
        clientSecret = pm.client_secret;
      } else {
        const envId = process.env.CAFE24_CLIENT_ID;
        const envSecret = process.env.CAFE24_CLIENT_SECRET;
        if (!envId || !envSecret) {
          throw new InternalServerErrorException({
            code: 'OAUTH_CONFIG_MISSING',
            message:
              'CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET env not configured',
          });
        }
        clientId = envId;
        clientSecret = envSecret;
      }
      tokenUrl = cafe24TokenUrl(pm.mall_id);
    } else {
      const clientIdKey = `${provider.toUpperCase()}_CLIENT_ID`;
      const clientSecretKey = `${provider.toUpperCase()}_CLIENT_SECRET`;
      const envId = process.env[clientIdKey];
      const envSecret = process.env[clientSecretKey];
      if (!envId || !envSecret) {
        throw new InternalServerErrorException({
          code: 'OAUTH_CONFIG_MISSING',
          message: `OAuth credentials (${clientIdKey}, ${clientSecretKey}) are not configured`,
        });
      }
      clientId = envId;
      clientSecret = envSecret;
      tokenUrl = STATIC_TOKEN_URLS[provider];
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3011';
    const redirectUri = buildOauthCallbackUrl(appUrl, provider);

    // Cafe24 의 token endpoint 는 **Basic auth only** 요구. body 에
    // client_id/client_secret 을 같이 넣으면 `invalid_request: The request
    // is invalid. check the request parameters.` 로 거부된다 (2026-05-15
    // 운영 보고). 다른 provider (google/github) 는 RFC 6749 §2.3.1 의 권장
    // 대로 body 에 넣는다 — 일부 provider 는 양쪽 다 받지만 우리 옛 코드의
    // "Basic + body 동시 전송" 은 cafe24 가 reject 한다.
    //
    // 출처: spec/2-navigation/4-integration.md §3.2 "토큰 교환 endpoint:
    // POST .../oauth/token (Basic auth: client_id:client_secret)".
    // 공식 샘플 `cafe24_app_sample` 도 Authorization 헤더만 사용.
    const form = isCafe24
      ? new URLSearchParams({
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        })
      : new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };
    if (isCafe24) {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: form.toString(),
    });

    if (!response.ok) {
      const body = await safeReadBody(response);
      this.logger.warn(
        `OAuth token exchange failed for ${provider}: HTTP ${response.status} ${body.slice(0, 200)}`,
      );
      throw new BadRequestException({
        code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
        message: 'Failed to exchange authorization code for access token',
      });
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (data.error) {
      const description =
        typeof data.error_description === 'string'
          ? data.error_description
          : typeof data.error === 'string'
            ? data.error
            : 'Token exchange failed';
      throw new BadRequestException({
        code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
        message: description,
      });
    }

    const result = normalizeTokenResponse(provider, data, requestedScopes);

    // Diagnostic — record what scope/mall the provider *actually* granted vs
    // what we asked for. Helps catch the silent-mismatch case where
    // Cafe24's app-level permissions are narrower than our requested scopes
    // (token issued but every API call 403s on the missing scope) or where
    // the user authorized into a different mall than we redirected to.
    if (isCafe24) {
      const pm = (providerMeta ?? {}) as Partial<Cafe24BeginMeta>;
      const echoMallId =
        typeof result.providerMeta?.cafe24_response_mall_id === 'string'
          ? result.providerMeta.cafe24_response_mall_id
          : null;
      if (echoMallId && pm.mall_id && echoMallId !== pm.mall_id) {
        this.logger.warn(
          `Cafe24 token mall_id mismatch: requested=${pm.mall_id} echoed=${echoMallId} — subsequent API calls against ${pm.mall_id} will 403`,
        );
      }
      const missingScopes = requestedScopes.filter(
        (s) => !result.scopes.includes(s),
      );
      if (missingScopes.length > 0) {
        this.logger.warn(
          `Cafe24 granted fewer scopes than requested for mall=${pm.mall_id ?? echoMallId ?? 'unknown'}: requested=${requestedScopes.join(',')} granted=${result.scopes.join(',')} missing=${missingScopes.join(',')}`,
        );
      }
      this.logger.log(
        `Cafe24 token exchange succeeded: mall_id=${echoMallId ?? pm.mall_id ?? 'unknown'} granted_scopes=${result.scopes.join(',')} expires_at=${result.tokenExpiresAt?.toISOString() ?? 'none'}`,
      );
    }

    return result;
  }

  // ---------------------------------------------------------------------
  // Cafe24 Private App — pending_install flow
  // ---------------------------------------------------------------------

  private async createPrivatePendingIntegration(
    params: BeginParams,
    meta: Required<
      Pick<Cafe24BeginMeta, 'mall_id' | 'client_id' | 'client_secret'>
    > &
      Cafe24BeginMeta,
  ): Promise<BeginResult> {
    const appUrl = process.env.APP_URL || 'http://localhost:3011';

    // Duplicate-prevention — shared helper (also used by public-flow begin
    // and the precheck endpoint). 동일 (workspaceId, mall_id) 의 `connected`
    // cafe24 row 가 있으면 즉시 409 로 거부. spec §9.2 "app_type 무관".
    const allSameMall = await this.findAllCafe24RowsForMall(
      params.workspaceId,
      meta.mall_id,
    );
    const alreadyConnected = allSameMall.find(
      (row) => row.status === 'connected',
    );
    if (alreadyConnected) {
      throw new ConflictException({
        code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
        message: `A Cafe24 integration for mall_id "${meta.mall_id}" already exists and is connected. Use the existing integration or delete it first.`,
        integrationId: alreadyConnected.id,
      });
    }
    // 기존 pending_install 재사용은 private app 끼리만 의미가 있다.
    // (public app 의 pending 행은 OAuth 흐름 자체가 다름.)
    const existingPending = allSameMall.find(
      (row) =>
        row.status === 'pending_install' &&
        row.credentials?.app_type === 'private',
    );

    // 16바이트 base64url (22자, 128-bit) — INSTALL_TOKEN_BYTES 상수에서
    // 길이 정의. spec/2-navigation/4-integration.md §9.2 Rationale "Cafe24
    // App URL 100자 한도 대응" 참조.
    const installToken = randomBytes(INSTALL_TOKEN_BYTES).toString('base64url');
    const installTokenIssuedAt = new Date();
    let saved: Integration;
    try {
      if (existingPending) {
        // Reuse the existing row instead of accumulating duplicate pending
        // rows for the same mall. **install_token 보존 (idempotent begin)**:
        // 같은 mall_id 에 대해 begin 을 여러 번 호출해도 사용자가 처음
        // Cafe24 Developers 에 등록한 URL 이 계속 유효하도록 기존 토큰을
        // 유지한다. 토큰이 없거나 (legacy / null) credentials 가 변경된
        // 경우에만 새 토큰을 발급. installTokenIssuedAt 도 토큰을 새로
        // 발급할 때만 갱신 — 보존 시 기존 TTL 그대로.
        //
        // 옛 동작 (매 호출 토큰 재발급) 은 "Connect 버튼 두 번 누르면 첫 번째
        // URL 이 갑자기 무효화" UX 버그를 일으켰다 (2026-05-15 운영 보고).
        const credsChanged =
          existingPending.credentials?.mall_id !== meta.mall_id ||
          existingPending.credentials?.client_id !== meta.client_id ||
          existingPending.credentials?.client_secret !== meta.client_secret;
        const needNewToken = !existingPending.installToken || credsChanged;
        if (needNewToken) {
          existingPending.installToken = installToken;
          existingPending.installTokenIssuedAt = installTokenIssuedAt;
        }
        existingPending.mallId = meta.mall_id; // backfill plain column if still NULL
        existingPending.credentials = {
          ...existingPending.credentials,
          mall_id: meta.mall_id,
          app_type: 'private',
          client_id: meta.client_id,
          client_secret: meta.client_secret,
          scopes: params.scopes,
        };
        existingPending.statusReason = null;
        existingPending.lastError = null;
        saved = await this.integrationRepository.save(existingPending);
      } else {
        const integration = this.integrationRepository.create({
          workspaceId: params.workspaceId,
          createdBy: params.userId,
          serviceType: 'cafe24',
          authType: 'oauth2',
          name: params.integrationName || `${meta.mall_id} (Cafe24 Private)`,
          scope: params.scope ?? 'personal',
          status: 'pending_install',
          installToken,
          installTokenIssuedAt,
          mallId: meta.mall_id,
          credentials: {
            mall_id: meta.mall_id,
            app_type: 'private',
            client_id: meta.client_id,
            client_secret: meta.client_secret,
            scopes: params.scopes,
          },
        });
        saved = await this.integrationRepository.save(integration);
      }
    } catch (err) {
      // Concurrent INSERT race: another request inserted the same
      // (workspace_id, mall_id) just now. V045 partial UNIQUE caught it.
      // Translate to the same 409 the in-memory check would have raised.
      const constraint =
        (err as { constraint?: string; driverError?: { constraint?: string } })
          ?.constraint ??
        (err as { driverError?: { constraint?: string } })?.driverError
          ?.constraint;
      if (
        isPostgresUniqueViolation(err) &&
        constraint === 'idx_integration_cafe24_workspace_mall'
      ) {
        throw new ConflictException({
          code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
          message: `A Cafe24 integration for mall_id "${meta.mall_id}" already exists in this workspace.`,
        });
      }
      throw err;
    }
    // install_token 이 path segment 로 들어가 cafe24 Developers "테스트
    // 실행" 시 단일 row 조회를 가능하게 한다. spec/2-navigation/4-integration.md
    // §9.2 + Rationale "install_token 을 App URL path 식별 키로 승격".
    //
    // existingPending 재사용 분기에서는 기존 token 을 보존할 수 있으므로
    // DB 에 실제 저장된 `saved.installToken` 을 반환해야 한다 (방금 발급한
    // installToken 변수가 아니라).
    const finalToken = saved.installToken ?? installToken;
    return {
      mode: 'cafe24_private_pending',
      integrationId: saved.id,
      appUrl: buildCafe24InstallUrl(appUrl, finalToken),
      callbackUrl: buildOauthCallbackUrl(appUrl, 'cafe24'),
    };
  }

  /**
   * Handles Cafe24 App URL calls from "테스트 실행".
   *
   * Identification: path segment `:installToken` indexes a single
   * pending_install Integration row (V043 partial unique index). That row's
   * `client_secret` then verifies the HMAC once — eliminating the old
   * mall_id O(N) scan + trial HMAC pattern which was non-deterministic when
   * the same mall had duplicate pending rows. spec/4-nodes/4-integration/4-cafe24.md §9.8.
   *
   * Order: ① timestamp window (cheap, DoS-resistant) → ② install_token
   * single-row lookup → ③ HMAC verification (timing-safe).
   */
  async handleInstall(
    installToken: string,
    query: Cafe24InstallQuery,
  ): Promise<string> {
    const timestampSec = parseInt(query.timestamp, 10);
    if (
      isNaN(timestampSec) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestampSec) > 5 * 60
    ) {
      throw new BadRequestException({
        code: 'CAFE24_INSTALL_REPLAY',
        message: 'Request timestamp is outside the acceptable window (±5 min)',
      });
    }

    if (!installToken) {
      throw new NotFoundException({
        code: 'CAFE24_INSTALL_INVALID_TOKEN',
        message: 'install_token is required',
      });
    }

    // status 무관 단일 row 조회 — App URL 은 초기 install (pending_install)
    // 외에 post-install navigation (connected/error/expired) 에서도 호출됨.
    // V045 partial UNIQUE `(install_token) WHERE install_token IS NOT NULL` 가
    // 결과를 단일 row 로 강제. spec/2-navigation/4-integration.md ## Rationale
    // "Cafe24 App URL 재호출 흐름 — install_token persistent 격상".
    let target = await this.integrationRepository.findOne({
      where: {
        installToken,
        serviceType: 'cafe24',
      },
    });

    if (!target) {
      // 회복 흐름 — install_token 직접 매칭이 실패한 경우, 사용자가
      // Cafe24 Developers 에 등록한 App URL 이 stale (옛 token) 일 가능성.
      // 같은 mall_id 의 cafe24 row 들을 모아 HMAC trial 검증으로 정확히
      // 1개가 매칭되면 그 row 로 진행한다. 새 URL 을 만들었지만 사용자가
      // Cafe24 Developers 갱신을 잊은 시나리오를 자동 보정.
      //
      // 비용: O(N) HMAC verify (N = 같은 mall_id 의 cafe24 row 수). per-workspace
      // 분리 + V046 partial UNIQUE 로 N 은 보통 1~2.
      //
      // 보안: HMAC 위조에는 client_secret 이 필요. client_secret 을 가진 자는
      // 정상 흐름으로도 동일 행위 가능 → 회복 흐름이 추가 권한을 부여하지 않음.
      // spec/2-navigation/4-integration.md ## Rationale
      // "Cafe24 install_token mismatch 회복 흐름" 참조.
      const recovered = await this.tryRecoverByMallId({
        urlToken: installToken,
        query,
      });
      if (recovered) {
        target = recovered;
      } else {
        throw new NotFoundException({
          code: 'CAFE24_INSTALL_INVALID_TOKEN',
          message:
            'install_token is not associated with any integration (deleted, TTL-expired, or stale URL). Update the App URL in Cafe24 Developers to match the current value shown in your integration detail page.',
        });
      }
    }

    const creds = target.credentials;
    if (creds.mall_id !== query.mall_id || creds.app_type !== 'private') {
      // Defensive: should not happen given the install_token uniqueness
      // and the begin-time validation, but a token used against a different
      // mall_id is treated like a bad HMAC (no info leak).
      this.logHmacFailure({
        reason: 'mall_id_mismatch',
        urlMallId: query.mall_id,
        target,
      });
      throw new ForbiddenException({
        code: 'CAFE24_INSTALL_INVALID_HMAC',
        message: 'HMAC verification failed',
      });
    }
    const secret = creds.client_secret;
    if (typeof secret !== 'string') {
      this.logHmacFailure({
        reason: 'no_client_secret',
        urlMallId: query.mall_id,
        target,
      });
      throw new ForbiddenException({
        code: 'CAFE24_INSTALL_INVALID_HMAC',
        message: 'HMAC verification failed',
      });
    }
    const hmacMessage = buildHmacMessage(query.rawQuery);
    if (!verifyHmacWithMessage(hmacMessage, secret, query.hmac)) {
      this.logHmacFailure({
        reason: 'hmac_verify_failed',
        urlMallId: query.mall_id,
        target,
      });
      throw new ForbiddenException({
        code: 'CAFE24_INSTALL_INVALID_HMAC',
        message: 'HMAC verification failed',
      });
    }

    // status 분기 — pending_install 만 OAuth authorize 로 진입.
    // connected/error/expired 는 post-install navigation 으로 간주 (카페24
    // 쇼핑몰 관리자의 "앱으로 가기" 버튼 등). HMAC 이 통과했다는 건
    // Cafe24 가 호출한 정당한 요청임을 의미하므로 우리 frontend 의 통합
    // 상세 페이지로 안내. 자세한 근거는 spec/2-navigation/4-integration.md
    // ## Rationale "Cafe24 App URL 재호출 흐름" 항.
    if (target.status !== 'pending_install') {
      const frontendBaseUrl =
        process.env.FRONTEND_URL ||
        process.env.APP_URL ||
        'http://localhost:3000';
      const trimmed = frontendBaseUrl.replace(/\/$/, '');
      this.logger.log(
        `Cafe24 post-install navigation: mall=${query.mall_id} integration=${target.id} status=${target.status} → redirect to ${trimmed}/integrations/${target.id}`,
      );
      return `${trimmed}/integrations/${target.id}`;
    }

    const clientId = creds.client_id as string;
    const scopes = Array.isArray(creds.scopes)
      ? (creds.scopes as string[])
      : [];
    const appUrl = process.env.APP_URL || 'http://localhost:3011';
    const redirectUri = buildOauthCallbackUrl(appUrl, 'cafe24');

    const state = randomBytes(24).toString('hex');
    const providerMeta = {
      mall_id: query.mall_id,
      app_type: 'private',
      client_id: clientId,
      client_secret: creds.client_secret,
    };
    const stateRecord = this.stateRepository.create({
      state,
      workspaceId: target.workspaceId,
      userId: target.createdBy,
      provider: 'cafe24',
      serviceType: 'cafe24',
      mode: 'reauthorize',
      integrationId: target.id,
      requestedScopes: scopes,
      integrationName: target.name,
      scope: target.scope as 'personal' | 'organization',
      providerMeta: providerMeta as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    });
    await this.stateRepository.save(stateRecord);

    const urlParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      state,
      response_type: 'code',
    });
    return `${cafe24AuthorizeUrl(query.mall_id)}?${urlParams.toString()}`;
  }

  /**
   * Recovery path for `handleInstall` — direct install_token lookup miss.
   *
   * 사용자가 Cafe24 Developers 에 등록한 App URL 이 stale (옛 token) 인 경우,
   * 같은 mall_id 의 cafe24 row 들을 모아 HMAC trial 검증으로 회복 가능한지
   * 확인. 정확히 하나의 row 가 HMAC 매칭하면 그 row 를 반환 — handleInstall
   * 의 정상 흐름으로 fall-through.
   *
   * - 0 매칭: stale URL 이 아니라 정말 모르는 token (삭제·만료). 회복 불가.
   * - 1 매칭: 안전 — 그 row 로 진행.
   * - 2+ 매칭: 여러 workspace 가 같은 mall + 같은 client_secret 을 보유 (드문
   *   케이스). 어떤 row 로 진행할지 결정 불가 — 회복 포기.
   *
   * 보안 분석: HMAC 위조에는 client_secret 이 필요. 회복 흐름은 client_secret
   * 보유자에게 추가 권한을 부여하지 않는다 (정상 흐름으로도 동일 행위 가능).
   *
   * spec/2-navigation/4-integration.md ## Rationale
   * "Cafe24 install_token mismatch 회복 흐름" 항.
   */
  private async tryRecoverByMallId(params: {
    /**
     * Caller-side documentation only — the URL `:installToken` that
     * triggered this recovery attempt. Kept on the signature so callers
     * read self-documenting context at the call site, but the recovery
     * logic itself depends solely on `query.mall_id` + the candidate
     * row's `client_secret` (HMAC re-verification re-derives the token).
     */
    urlToken: string;
    query: Cafe24InstallQuery;
  }): Promise<Integration | null> {
    const { query } = params;
    if (!query.mall_id) return null;

    // SEC H-2 (2026-05-16) — 옛 동작은 mall_id 매칭되는 모든 workspace 의 row
    // 를 가져온 뒤 in-memory HMAC trial 을 N번 수행했다. 공격자가 인기 mall_id
    // (예: `test`) 로 무효 install_token 을 분산 IP 로 반복 요청하면 DB
    // full-scan + HMAC 연산 amplification 가능. `take: RECOVERY_CANDIDATE_LIMIT`
    // 로 후보 상한을 둬 amplification 을 차단. 정상 운영에서는 per-mall 행
    // 수가 보통 1~2 이므로 영향 없음. 한도 초과 시 회복 포기 (404).
    const sameMall = await this.integrationRepository.find({
      where: {
        mallId: query.mall_id,
        serviceType: 'cafe24',
      },
      take: RECOVERY_CANDIDATE_LIMIT + 1, // +1 to detect overflow
    });

    if (sameMall.length > RECOVERY_CANDIDATE_LIMIT) {
      this.logger.warn(
        `[cafe24-install-recovery] candidate overflow for mall_id=${query.mall_id} (>${RECOVERY_CANDIDATE_LIMIT}) — refusing recovery to bound HMAC trial cost`,
      );
      return null;
    }

    // 진단 로그 — 회복 시도 자체는 항상 기록 (404 분석에 필수).
    // SEC H-2: Integration UUID + tokenPrefix 가 cross-tenant enumeration
    // 정보가 될 수 있어 로그에서 제거. status / statusReason 만 남겨
    // 운영 진단에는 충분.
    this.logger.warn(
      `[cafe24-install-recovery] mall_id=${JSON.stringify(query.mall_id)} candidates=${sameMall.length} statuses=${JSON.stringify(
        sameMall.map((r) => ({
          status: r.status,
          statusReason: r.statusReason,
          hasInstallToken: r.installToken !== null,
        })),
      )}`,
    );

    const hmacMessage = buildHmacMessage(query.rawQuery);
    const validated = sameMall.filter((row) => {
      const creds = row.credentials as Record<string, unknown> | null;
      const secret = creds?.client_secret;
      if (typeof secret !== 'string' || secret.length === 0) return false;
      return verifyHmacWithMessage(hmacMessage, secret, query.hmac);
    });

    if (validated.length === 1) {
      const row = validated[0];
      // SEC H-2: 회복 성공 로그도 UUID/tokenPrefix 제거. mall_id + status 만
      // 으로 운영 진단 충분.
      this.logger.log(
        `[cafe24-install-recovery] recovered: mall_id=${query.mall_id} status=${row.status} → falling through to ${row.status === 'pending_install' ? 'OAuth authorize' : 'post-install navigation'}`,
      );
      return row;
    }
    if (validated.length > 1) {
      this.logger.warn(
        `[cafe24-install-recovery] ambiguous: ${validated.length} rows passed HMAC for mall_id=${query.mall_id} — cannot auto-recover (multiple workspaces share the same client_secret?)`,
      );
    }
    return null;
  }

  /**
   * `CAFE24_INSTALL_INVALID_HMAC` 응답을 던지기 직전 호출하는 진단 로그
   * 헬퍼. 3 분기(mall_id_mismatch / no_client_secret / hmac_verify_failed)
   * 모두 동일 응답 코드를 반환하므로 (capability-token 가정 보호), 운영
   * 환경에서 원인 판별은 로그에 의존한다. spec/2-navigation/4-integration.md
   * Rationale "Cafe24 App URL 상세 페이지 표시" 의 "HMAC 검증 진단 로그
   * 보강" 단락.
   *
   * 절대 로깅 금지: `client_secret`, install_token 의 전체 값.
   * 로깅 허용: reason, urlMallId, dbMallId, dbAppType, status, statusReason,
   * tokenPreview (prefix 4자 + suffix 4자).
   */
  private logHmacFailure(params: {
    reason: 'mall_id_mismatch' | 'no_client_secret' | 'hmac_verify_failed';
    urlMallId: string;
    target: Integration;
  }): void {
    const { reason, urlMallId, target } = params;
    const creds = (target.credentials as Record<string, unknown> | null) ?? {};
    const dbMallId =
      typeof creds.mall_id === 'string' ? creds.mall_id : '(missing)';
    const dbAppType =
      typeof creds.app_type === 'string' ? creds.app_type : '(missing)';
    const tokenPreview = previewInstallToken(target.installToken);
    this.logger.warn(
      `[cafe24-install-hmac-fail] reason=${reason} urlMallId=${JSON.stringify(urlMallId)} dbMallId=${JSON.stringify(dbMallId)} dbAppType=${dbAppType} status=${target.status} statusReason=${target.statusReason ?? 'null'} token=${tokenPreview}`,
    );
  }

  // ---------------------------------------------------------------------
  // Cafe24 duplicate-detection — begin pre-check + precheck endpoint
  // ---------------------------------------------------------------------

  /**
   * Return all cafe24 Integration rows for `(workspaceId, mallId)`.
   *
   * Primary path: SQL filter on the V045 plain `mall_id` column (O(1) rows).
   * Legacy fallback: rows from before V045 still have `mall_id IS NULL` —
   * match them via the encrypted `credentials.mall_id` JSONB field.
   *
   * **Legacy fallback 제거 조건** (2026-05-16 기준): V045 backfill 마이그레이션
   * (마이그레이션 추적 plan `plan/in-progress/cafe24-mall-dup-ux.md` 참조) 이
   * 완료되어 모든 cafe24 row 의 `mall_id` plain 컬럼이 NOT NULL 임을 확인한
   * 뒤 legacy 쿼리 + filter 블록을 삭제. 동시에 V046 partial UNIQUE 의
   * `mall_id IS NOT NULL` 조건도 검토 (NOT NULL constraint 로 강화 가능).
   *
   * Shared by `createPrivatePendingIntegration` (begin private guard +
   * pending_install reuse), the public-flow begin guard, and
   * `precheckCafe24Mall` (frontend pre-detection endpoint).
   *
   * Performance — `Promise.all` 병렬 발행으로 평균 응답 latency 절반.
   * legacy 쿼리는 backfill 완료 후 제거 예정이며 그 시점에 단일 쿼리로 회귀.
   */
  private async findAllCafe24RowsForMall(
    workspaceId: string,
    mallId: string,
  ): Promise<Integration[]> {
    const [direct, legacyRaw] = await Promise.all([
      this.integrationRepository.find({
        where: { workspaceId, serviceType: 'cafe24', mallId },
      }),
      this.integrationRepository.find({
        where: { workspaceId, serviceType: 'cafe24', mallId: IsNull() },
      }),
    ]);
    const legacy = legacyRaw.filter(
      (row) => row.credentials?.mall_id === mallId,
    );
    return [...direct, ...legacy];
  }

  /**
   * Return the first `connected` cafe24 row for `(workspaceId, mallId)`,
   * or null if none exists. Used by both public-flow and private-flow
   * begin pre-checks to block duplicate adds before any OAuth round-trip.
   */
  private async findConnectedCafe24MallIntegration(
    workspaceId: string,
    mallId: string,
  ): Promise<Integration | null> {
    const all = await this.findAllCafe24RowsForMall(workspaceId, mallId);
    return all.find((row) => row.status === 'connected') ?? null;
  }

  /**
   * Read-only conflict snapshot for the frontend's mall_id input precheck.
   *
   * Returns the most-restrictive cafe24 row for `(workspaceId, mallId)` —
   * priority `connected > pending_install > error > expired` — so the UI
   * can render context-aware inline warnings *before* the user clicks
   * Connect. spec/2-navigation/4-integration.md §9.2 Rationale "precheck
   * endpoint — mall_id 입력 단계 사전 감지 UX".
   *
   * Never exposes credentials/tokens/timestamps — only the bare
   * (id, name, status) tuple needed for the inline alert + deep link.
   */
  async precheckCafe24Mall(
    workspaceId: string,
    mallId: string,
  ): Promise<{
    conflict: boolean;
    existingIntegrationId?: string;
    existingName?: string;
    status?: Cafe24PrecheckStatus;
  }> {
    const all = await this.findAllCafe24RowsForMall(workspaceId, mallId);
    if (all.length === 0) return { conflict: false };
    // Priority 순으로 가장 제한적인 상태부터 검사. 상수는 클래스 상단의
    // `CAFE24_PRECHECK_STATUS_PRIORITY` 에 정의 — DTO 주석 / 프론트 i18n 분기
    // 와 단일 진실 유지.
    for (const status of CAFE24_PRECHECK_STATUS_PRIORITY) {
      const hit = all.find((row) => row.status === status);
      if (hit) {
        return {
          conflict: true,
          existingIntegrationId: hit.id,
          existingName: hit.name,
          status,
        };
      }
    }
    // Fallback: priority 에 없는 transitional status (현재 DB enum 에는 없으나
    // 미래 추가 가능성 대비). 강제 캐스팅 대신 status 를 omit 해 클라이언트가
    // "알 수 없는 상태 — 일단 conflict" 로만 해석하도록 한다. spec/conventions
    // /swagger.md — enum 범위 밖 값은 frontend silent fallthrough 방지를
    // 위해 명시적으로 미반환.
    const fallback = all[0];
    return {
      conflict: true,
      existingIntegrationId: fallback.id,
      existingName: fallback.name,
    };
  }

  // ---------------------------------------------------------------------
  // Maintenance
  // ---------------------------------------------------------------------

  private async purgeExpired(): Promise<void> {
    const now = new Date();
    try {
      await Promise.all([
        this.stateRepository.delete({ expiresAt: LessThan(now) }),
        this.previewRepository.delete({ expiresAt: LessThan(now) }),
      ]);
    } catch (err) {
      this.logger.warn(
        `Failed to purge expired OAuth records: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

function normalizeTokenResponse(
  provider: OAuthProvider,
  data: Record<string, unknown>,
  requestedScopes: string[],
): TokenExchangeResult {
  const accessToken = readString(data, 'access_token');
  if (!accessToken) {
    throw new BadRequestException({
      code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
      message: 'Provider did not return an access token',
    });
  }
  const refreshToken = readString(data, 'refresh_token') ?? null;
  const expiresIn = readNumber(data, 'expires_in');
  const tokenExpiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000)
    : null;

  // Cafe24 returns `scopes` as an ARRAY (e.g. `["mall.read_product", ...]`).
  // OAuth standard providers (google/github) return `scope` as a space- or
  // comma-delimited string. Read both — array first, then string — so we
  // record what was *actually granted* rather than silently falling back
  // to `requestedScopes`. The fallback to requestedScopes is kept only for
  // providers that never echo scope back (legacy GitHub OAuth tokens).
  //
  // `scopes !== null` (even when the array is empty) is treated as
  // authoritative: an empty array means "the provider granted nothing",
  // not "the provider was silent". Silent fallback to requestedScopes
  // hides this case and would let us claim scopes we don't have.
  const scopesArray = Array.isArray(data.scopes)
    ? (data.scopes as unknown[]).filter(
        (s): s is string => typeof s === 'string' && s.length > 0,
      )
    : null;
  const scopeString = readString(data, 'scope');
  const returnedScopes =
    scopesArray !== null
      ? scopesArray
      : scopeString
        ? scopeString.split(/[,\s]+/).filter(Boolean)
        : requestedScopes;

  const providerMeta: Record<string, unknown> = {};
  if (provider === 'google') {
    providerMeta.account_email =
      readString(data, 'account_email') ?? readString(data, 'email');
  }
  if (provider === 'github') {
    providerMeta.login = readString(data, 'login');
  }
  if (provider === 'cafe24') {
    // Cafe24 token response carries `user_id` (operator account). We rename
    // it to `cafe24_operator_id` in stored credentials to avoid confusion
    // with internal `User.id` (UUID) — see spec/2-navigation/4-integration.md §5.8.
    const operator = readString(data, 'user_id');
    if (operator) providerMeta.cafe24_operator_id = operator;
    // Cafe24 echoes mall_id in the token response — capture as a sanity
    // check, even though credentials.mall_id is already populated from the
    // state's provider_meta in handleCallback.
    const mallId = readString(data, 'mall_id');
    if (mallId) providerMeta.cafe24_response_mall_id = mallId;
  }

  return {
    accessToken,
    refreshToken,
    scopes: returnedScopes,
    tokenExpiresAt,
    providerMeta,
  };
}

function stubTokenResult(
  provider: OAuthProvider,
  requestedScopes: string[],
  beginMeta: Record<string, unknown> | null,
): TokenExchangeResult {
  const providerMeta: Record<string, unknown> = { stub: true };
  if (provider === 'cafe24') {
    providerMeta.cafe24_operator_id = `stub-operator-${randomBytes(4).toString('hex')}`;
    const pmMall =
      beginMeta && typeof beginMeta.mall_id === 'string'
        ? beginMeta.mall_id
        : null;
    if (pmMall) providerMeta.cafe24_response_mall_id = pmMall;
  }
  return {
    accessToken: `stub-${provider}-${randomBytes(8).toString('hex')}`,
    refreshToken: `stub-refresh-${randomBytes(8).toString('hex')}`,
    scopes: requestedScopes,
    tokenExpiresAt: new Date(
      Date.now() +
        (provider === 'cafe24' ? 2 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000),
    ),
    providerMeta,
  };
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readNumber(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Install_token 의 안전 로깅 표시 — 토큰 자체 (또는 그 일부) 는 절대 노출하지
 * 않고 존재 여부만 알린다. capability token 의 brute-force surface 를 0 으로
 * 축소. 디버깅에 토큰을 식별할 필요가 있을 때는 `target.id` 로 row 를 특정.
 */
function previewInstallToken(token: string | null | undefined): string {
  if (typeof token !== 'string' || token.length === 0) return '(none)';
  if (token.length < 12) return '(short)';
  return '(present)';
}

/**
 * Builds the Cafe24 App URL HMAC verification message.
 *
 * Algorithm (official Cafe24 sample — Java `validationCheckHmac`):
 *   1. Split rawQuery on `&`, then split each part on first `=`. Drop the
 *      `hmac` entry. Sort the remaining entries by key (byte-lexicographic).
 *   2. **Preserve raw URL-encoded values** — concatenate the original
 *      `key=raw-value` strings as-is (no decode, no re-encode).
 *
 * The actual HMAC-SHA256 + Base64 + timing-safe compare happens in
 * {@link verifyHmacWithMessage}. Split so callers with multiple candidate
 * secrets compute the message once and reuse per candidate.
 *
 * **2026-05-16 재정정**: PR #67 SEC H-1 가 "Java `URLEncoder.encode` 호환
 * (공백 `+`)" 으로 정정했으나 그 가정이 오류였음 — 운영 사용자 보고 (신규
 * 통합 직후 즉시 HMAC 실패, PR #89 의 진단 로그가 `reason=hmac_verify_failed`
 * 식별). Cafe24 의 실제 알고리즘은 `request.getQueryString()` 의 byte 를
 * decode/re-encode 없이 그대로 사용한다 — URL 의 `%20` 이 메시지에서 `+` 로
 * 변환되면서 byte 불일치 발생. raw 보존이 인코더 invariant. 자세한 결정
 * 배경은 `spec/2-navigation/4-integration.md` Rationale "HMAC 검증 알고리즘
 * — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항 + `spec/4-nodes/4-integration/
 * 4-cafe24.md` §9.8 참조.
 */
function buildHmacMessage(rawQuery: string): string {
  return rawQuery
    .split('&')
    .map((part) => {
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      return { key, raw: part };
    })
    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((p) => p.raw)
    .join('&');
}

function verifyHmacWithMessage(
  message: string,
  clientSecret: string,
  receivedHmac: string,
): boolean {
  const computed = createHmac('sha256', clientSecret)
    .update(message, 'utf8')
    .digest('base64');
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac));
  } catch {
    return false;
  }
}
