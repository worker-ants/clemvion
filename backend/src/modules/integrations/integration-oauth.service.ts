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

const STATE_TTL_MS = 10 * 60 * 1000;
const PREVIEW_TTL_MS = 10 * 60 * 1000;

export const ALLOWED_OAUTH_PROVIDERS = ['google', 'github'] as const;
export type OAuthProvider = (typeof ALLOWED_OAUTH_PROVIDERS)[number];

const AUTHORIZE_URLS: Record<OAuthProvider, string> = {
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
  github: 'https://github.com/login/oauth/authorize',
};

const TOKEN_URLS: Record<OAuthProvider, string> = {
  google: 'https://oauth2.googleapis.com/token',
  github: 'https://github.com/login/oauth/access_token',
};

export interface BeginParams {
  workspaceId: string;
  userId: string;
  service: string;
  scopes: string[];
  mode: OAuthStateMode;
  integrationId?: string;
  integrationName?: string;
  scope?: 'personal' | 'organization';
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

    const clientIdKey = `${service.oauthProvider.toUpperCase()}_CLIENT_ID`;
    const clientId = process.env[clientIdKey];
    if (!clientId) {
      throw new InternalServerErrorException({
        code: 'OAUTH_CONFIG_MISSING',
        message: `OAuth client ID (${clientIdKey}) is not configured`,
      });
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
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    });
    await this.stateRepository.save(record);

    const appUrl = process.env.APP_URL || 'http://localhost:3011';
    const redirectUri = `${appUrl}/api/integrations/oauth/callback/${service.oauthProvider}`;
    const urlParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: params.scopes.join(' '),
      state,
      response_type: 'code',
    });

    return {
      authUrl: `${AUTHORIZE_URLS[service.oauthProvider]}?${urlParams.toString()}`,
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
    );

    const credentials = {
      access_token: exchange.accessToken,
      refresh_token: exchange.refreshToken,
      scopes: exchange.scopes,
      provider,
      ...exchange.providerMeta,
    };

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
    const creds =
      typeof preview.credentials === 'string'
        ? (JSON.parse(preview.credentials) as Record<string, unknown>)
        : preview.credentials;
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
  ): Promise<TokenExchangeResult> {
    if (process.env.OAUTH_STUB_MODE === 'true') {
      return stubTokenResult(provider, requestedScopes);
    }

    const clientIdKey = `${provider.toUpperCase()}_CLIENT_ID`;
    const clientSecretKey = `${provider.toUpperCase()}_CLIENT_SECRET`;
    const clientId = process.env[clientIdKey];
    const clientSecret = process.env[clientSecretKey];
    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException({
        code: 'OAUTH_CONFIG_MISSING',
        message: `OAuth credentials (${clientIdKey}, ${clientSecretKey}) are not configured`,
      });
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

    const response = await fetch(TOKEN_URLS[provider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
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
): TokenExchangeResult {
  return {
    accessToken: `stub-${provider}-${randomBytes(8).toString('hex')}`,
    refreshToken: `stub-refresh-${randomBytes(8).toString('hex')}`,
    scopes: requestedScopes,
    tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    providerMeta: { stub: true },
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
