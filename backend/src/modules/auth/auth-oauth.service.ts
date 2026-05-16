import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  AuthOAuthState,
  AuthOAuthMode,
} from './entities/auth-oauth-state.entity';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';

import { isOAuthStubModeAllowed } from '../../common/utils/oauth-stub-mode';

const STATE_TTL_MS = 10 * 60 * 1000;

/** OAUTH_STUB_MODE 가드 — dev/test 만 활성 (W-74 단일 헬퍼). */
function isOAuthStubEnabled(): boolean {
  return isOAuthStubModeAllowed();
}

export const AUTH_OAUTH_PROVIDERS = ['google', 'github'] as const;
export type AuthOAuthProvider = (typeof AUTH_OAUTH_PROVIDERS)[number];

const AUTHORIZE_URLS: Record<AuthOAuthProvider, string> = {
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
  github: 'https://github.com/login/oauth/authorize',
};

const TOKEN_URLS: Record<AuthOAuthProvider, string> = {
  google: 'https://oauth2.googleapis.com/token',
  github: 'https://github.com/login/oauth/access_token',
};

const SCOPES: Record<AuthOAuthProvider, string[]> = {
  google: ['openid', 'email', 'profile'],
  github: ['read:user', 'user:email'],
};

export interface OauthProfile {
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface BeginOauthParams {
  mode: AuthOAuthMode;
  rememberMe: boolean;
}

export interface BeginOauthResult {
  authUrl: string;
}

export interface OauthCallbackResult {
  accessToken: string;
  refreshToken: string;
  rememberMe: boolean;
}

@Injectable()
export class AuthOauthService {
  private readonly logger = new Logger(AuthOauthService.name);

  constructor(
    @InjectRepository(AuthOAuthState)
    private readonly stateRepository: Repository<AuthOAuthState>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly authService: AuthService,
  ) {}

  static isSupportedProvider(value: string): value is AuthOAuthProvider {
    return (AUTH_OAUTH_PROVIDERS as readonly string[]).includes(value);
  }

  // Providers are considered "enabled" when their CLIENT_ID is configured,
  // OR when stub mode is on (so local dev sees buttons without real creds).
  getEnabledProviders(): AuthOAuthProvider[] {
    const stub = isOAuthStubEnabled();
    return AUTH_OAUTH_PROVIDERS.filter((p) => {
      if (stub) return true;
      return Boolean(process.env[`${p.toUpperCase()}_CLIENT_ID`]);
    });
  }

  async beginAuth(
    provider: string,
    params: BeginOauthParams,
  ): Promise<BeginOauthResult> {
    this.assertProvider(provider);
    const clientId = this.requireEnv(`${provider.toUpperCase()}_CLIENT_ID`);

    void this.purgeExpired();

    const state = randomBytes(24).toString('hex');
    await this.stateRepository.save(
      this.stateRepository.create({
        state,
        provider,
        mode: params.mode,
        rememberMe: params.rememberMe,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      }),
    );

    const redirectUri = this.redirectUri(provider);
    const urlParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES[provider].join(' '),
      state,
      response_type: 'code',
    });
    return {
      authUrl: `${AUTHORIZE_URLS[provider]}?${urlParams.toString()}`,
    };
  }

  async handleCallback(
    provider: string,
    code: string,
    state: string,
    ctx: { ip?: string | null; userAgent?: string | null } = {},
  ): Promise<OauthCallbackResult> {
    this.assertProvider(provider);

    // Atomically consume the state row — only one concurrent callback wins.
    // Filtering on expires_at guarantees expired states are not consumable.
    const consumed = await this.dataSource.query<AuthOAuthState[]>(
      'DELETE FROM auth_oauth_state WHERE state = $1 AND expires_at > NOW() RETURNING *',
      [state],
    );
    if (consumed.length === 0) {
      throw new BadRequestException({
        code: 'OAUTH_STATE_MISMATCH',
        message: 'Invalid, expired, or already consumed OAuth state',
      });
    }
    const record = consumed[0];
    if (record.provider !== provider) {
      throw new BadRequestException({
        code: 'OAUTH_STATE_MISMATCH',
        message: 'Provider mismatch for OAuth state',
      });
    }

    const accessToken = await this.exchangeCodeForToken(provider, code);
    const profile = await this.fetchProfile(provider, accessToken);
    const user = await this.resolveUser(provider, profile);
    const tokens = await this.authService.issueTokensForOauthUser(
      user,
      record.rememberMe,
      ctx,
    );
    return { ...tokens, rememberMe: record.rememberMe };
  }

  private async exchangeCodeForToken(
    provider: AuthOAuthProvider,
    code: string,
  ): Promise<string> {
    if (isOAuthStubEnabled()) {
      return `stub-${provider}-${randomBytes(8).toString('hex')}`;
    }

    const clientId = this.requireEnv(`${provider.toUpperCase()}_CLIENT_ID`);
    const clientSecret = this.requireEnv(
      `${provider.toUpperCase()}_CLIENT_SECRET`,
    );
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: this.redirectUri(provider),
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
    if (typeof data.error === 'string') {
      throw new BadRequestException({
        code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
        message:
          typeof data.error_description === 'string'
            ? data.error_description
            : data.error,
      });
    }
    const token = data.access_token;
    if (typeof token !== 'string' || !token) {
      throw new BadRequestException({
        code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
        message: 'Provider did not return an access token',
      });
    }
    return token;
  }

  private async fetchProfile(
    provider: AuthOAuthProvider,
    accessToken: string,
  ): Promise<OauthProfile> {
    if (isOAuthStubEnabled()) {
      const suffix = randomBytes(4).toString('hex');
      return {
        providerId: `stub-${provider}-${suffix}`,
        email: `stub-${provider}-${suffix}@example.com`,
        name: `Stub ${provider} user`,
        avatarUrl: null,
      };
    }

    if (provider === 'google') {
      const res = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) {
        throw new BadRequestException({
          code: 'OAUTH_PROFILE_FAILED',
          message: 'Failed to fetch Google profile',
        });
      }
      const data = (await res.json()) as Record<string, unknown>;
      const email = typeof data.email === 'string' ? data.email : '';
      if (!email) {
        throw new BadRequestException({
          code: 'OAUTH_EMAIL_REQUIRED',
          message: 'Email not provided by Google account',
        });
      }
      const sub = data.sub;
      const providerId =
        typeof sub === 'string'
          ? sub
          : typeof sub === 'number'
            ? sub.toString()
            : '';
      return {
        providerId,
        email,
        name:
          typeof data.name === 'string' && data.name.length > 0
            ? data.name
            : email.split('@')[0],
        avatarUrl: typeof data.picture === 'string' ? data.picture : null,
      };
    }

    // GitHub
    const [userRes, emailsRes] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }),
      fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }),
    ]);
    if (!userRes.ok) {
      throw new BadRequestException({
        code: 'OAUTH_PROFILE_FAILED',
        message: 'Failed to fetch GitHub profile',
      });
    }
    const user = (await userRes.json()) as Record<string, unknown>;

    let email = typeof user.email === 'string' ? user.email : '';
    if (!email && emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      const verified = emails.find((e) => e.verified);
      email = primary?.email ?? verified?.email ?? '';
    }
    if (!email) {
      throw new BadRequestException({
        code: 'OAUTH_EMAIL_REQUIRED',
        message: 'No verified email returned by GitHub',
      });
    }
    const login = typeof user.login === 'string' ? user.login : '';
    const name =
      typeof user.name === 'string' && user.name.length > 0
        ? user.name
        : login || email.split('@')[0];
    const userId = user.id;
    const providerId =
      typeof userId === 'string'
        ? userId
        : typeof userId === 'number'
          ? userId.toString()
          : '';
    return {
      providerId,
      email,
      name,
      avatarUrl: typeof user.avatar_url === 'string' ? user.avatar_url : null,
    };
  }

  private async resolveUser(
    provider: AuthOAuthProvider,
    profile: OauthProfile,
  ): Promise<User> {
    const byOauth = await this.usersService.findByOauth(
      provider,
      profile.providerId,
    );
    if (byOauth) return byOauth;

    const byEmail = await this.usersService.findByEmail(profile.email);
    if (byEmail) {
      // Conditional link: only claim an account that is not yet bound to any
      // provider. If a different provider already owns the account, the update
      // is a no-op and we return the original record, preserving the binding.
      await this.dataSource
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({
          oauthProvider: provider,
          oauthProviderId: profile.providerId,
          emailVerified: true,
          avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? undefined,
        })
        .where('id = :id AND oauth_provider IS NULL', { id: byEmail.id })
        .execute();
      return (await this.usersService.findById(byEmail.id)) ?? byEmail;
    }

    // New user path — create user and personal workspace atomically.
    try {
      return await this.dataSource.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const created = await userRepo.save(
          userRepo.create({
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl ?? undefined,
            emailVerified: true,
            oauthProvider: provider,
            oauthProviderId: profile.providerId,
          }),
        );
        await this.workspacesService.createPersonalWorkspace(
          created.id,
          created.name,
          created.email,
          manager,
        );
        return created;
      });
    } catch (err) {
      // Concurrent first-time OAuth callbacks (same identity) collide on the
      // unique index — recover by returning the row the winning callback wrote.
      if (isUniqueViolation(err)) {
        const existing = await this.usersService.findByOauth(
          provider,
          profile.providerId,
        );
        if (existing) return existing;
      }
      throw err;
    }
  }

  private async purgeExpired(): Promise<void> {
    try {
      await this.stateRepository.delete({ expiresAt: LessThan(new Date()) });
    } catch (err) {
      this.logger.warn(
        `Failed to purge expired auth OAuth states: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private assertProvider(
    provider: string,
  ): asserts provider is AuthOAuthProvider {
    if (!AuthOauthService.isSupportedProvider(provider)) {
      throw new BadRequestException({
        code: 'OAUTH_PROVIDER_UNKNOWN',
        message: `Unsupported OAuth provider: ${provider}`,
      });
    }
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new InternalServerErrorException({
        code: 'OAUTH_CONFIG_MISSING',
        message: `${key} is not configured`,
      });
    }
    return value;
  }

  private redirectUri(provider: string): string {
    const appUrl =
      this.configService.get<string>('app.url') ??
      process.env.APP_URL ??
      'http://localhost:3011';
    return `${appUrl}/api/auth/oauth/${provider}/callback`;
  }
}

function isUniqueViolation(err: unknown): boolean {
  // Postgres SQLSTATE 23505 surfaced via TypeORM's QueryFailedError.
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
