import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Integration } from './entities/integration.entity';
import {
  IntegrationOAuthState,
  OAuthStateMode,
} from './entities/integration-oauth-state.entity';
import { IntegrationOAuthPreview } from './entities/integration-oauth-preview.entity';
import { findService } from './services/service-registry';
import { decryptJson } from './services/credentials-transformer';

const STATE_TTL_MS = 10 * 60 * 1000;
const PREVIEW_TTL_MS = 10 * 60 * 1000;

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

export interface BeginResult {
  authUrl: string;
  state: string;
}

export interface CallbackResult {
  mode: OAuthStateMode;
  provider: string;
  integrationId?: string;
  previewToken?: string;
}

interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  tokenExpiresAt: Date | null;
  providerMeta: Record<string, unknown>;
}

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
        clientId = meta.client_id;
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
      }
      providerMeta = {
        mall_id: meta.mall_id,
        app_type: meta.app_type,
        ...(meta.app_type === 'private'
          ? {
              client_id: meta.client_id,
              client_secret: meta.client_secret,
            }
          : {}),
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
    const redirectUri = `${appUrl}/api/integrations/oauth/callback/${service.oauthProvider}`;
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
    const consumed = await this.dataSource.query<IntegrationOAuthState[]>(
      'DELETE FROM integration_oauth_state WHERE state = $1 RETURNING *',
      [query.state],
    );
    if (consumed.length === 0) {
      throw new BadRequestException({
        code: 'OAUTH_STATE_MISMATCH',
        message: 'Invalid or already consumed OAuth state',
      });
    }
    const record = consumed[0];

    // Column transformers (`encryptedJsonTransformer`) only run for entity
    // round-trips, not for `dataSource.query` raw SQL. Run the same
    // decrypt step manually so `record.providerMeta` is a plain object
    // (or null) — otherwise cafe24 callbacks would receive an
    // `"enc:v1:…"` envelope string and silently misinterpret it. We also
    // normalise `requested_scopes` (snake_case from raw SQL) onto the
    // entity field so the rest of the method can read it uniformly.
    if (record.providerMeta !== null && record.providerMeta !== undefined) {
      const decrypted = decryptJson<Record<string, unknown>>(
        record.providerMeta,
      );
      record.providerMeta = decrypted ?? null;
    }
    const rawRow = record as unknown as Record<string, unknown>;
    if (
      Array.isArray(rawRow.requested_scopes) &&
      !Array.isArray(record.requestedScopes)
    ) {
      record.requestedScopes = rawRow.requested_scopes as string[];
    }
    if (record.provider !== provider) {
      throw new BadRequestException({
        code: 'OAUTH_STATE_MISMATCH',
        message: 'Provider mismatch for OAuth state',
      });
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'OAUTH_STATE_EXPIRED',
        message: 'OAuth state has expired',
      });
    }

    const exchange = await this.exchangeCodeForToken(
      provider,
      query.code,
      record.requestedScopes,
      record.providerMeta ?? null,
    );

    const credentials: Record<string, unknown> = {
      access_token: exchange.accessToken,
      refresh_token: exchange.refreshToken,
      scopes: exchange.scopes,
      provider,
      ...exchange.providerMeta,
    };

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
      throw new BadRequestException({
        code: 'OAUTH_STATE_INVALID',
        message: 'OAuth state has no associated integration',
      });
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Integration);
      const integration = await repo.findOne({
        where: { id: record.integrationId!, workspaceId: record.workspaceId },
      });
      if (!integration) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Integration not found',
        });
      }
      if (record.mode === 'reauthorize') {
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
      await repo.save(integration);
    });

    return {
      mode: record.mode,
      provider,
      integrationId: record.integrationId,
    };
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
    const consumed = await this.dataSource.query<IntegrationOAuthPreview[]>(
      'DELETE FROM integration_oauth_preview WHERE preview_token = $1 RETURNING *',
      [previewToken],
    );
    if (consumed.length === 0) {
      throw new BadRequestException({
        code: 'OAUTH_PREVIEW_INVALID',
        message: 'OAuth preview token is invalid or already used',
      });
    }
    const preview = consumed[0];
    if (preview.workspaceId !== workspaceId || preview.userId !== userId) {
      throw new BadRequestException({
        code: 'OAUTH_PREVIEW_OWNERSHIP',
        message: 'OAuth preview token does not belong to the current session',
      });
    }
    if (new Date(preview.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'OAUTH_PREVIEW_EXPIRED',
        message: 'OAuth preview token has expired',
      });
    }

    // Row was stored with the encrypted transformer; raw SQL bypasses it, so
    // credentials come back as a string. Normalize via the transformer.
    // Corrupted rows (manual DB edits, partial decryption) could throw from
    // JSON.parse — surface as 400 rather than unhandled 500.
    let creds: Record<string, unknown>;
    if (typeof preview.credentials === 'string') {
      try {
        creds = JSON.parse(preview.credentials) as Record<string, unknown>;
      } catch {
        throw new BadRequestException({
          code: 'INTEGRATION_CREDENTIALS_INVALID',
          message: 'OAuth preview credentials are corrupted',
        });
      }
    } else {
      creds = preview.credentials;
    }
    return {
      credentials: creds,
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
    if (
      process.env.OAUTH_STUB_MODE === 'true' &&
      process.env.NODE_ENV !== 'production'
    ) {
      return stubTokenResult(provider, requestedScopes, providerMeta);
    }
    if (
      process.env.OAUTH_STUB_MODE === 'true' &&
      process.env.NODE_ENV === 'production'
    ) {
      this.logger.error(
        'OAUTH_STUB_MODE is set in production — ignoring. Stub mode must never run with real users; fix the deployment configuration.',
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
    const redirectUri = `${appUrl}/api/integrations/oauth/callback/${provider}`;
    const form = new URLSearchParams({
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
    // Cafe24 accepts client credentials via HTTP Basic in addition to the
    // form body — using both keeps us robust against header-only or
    // body-only enforcement on the provider side.
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

    return normalizeTokenResponse(provider, data, requestedScopes);
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

  const scopeString = readString(data, 'scope');
  const returnedScopes = scopeString
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
