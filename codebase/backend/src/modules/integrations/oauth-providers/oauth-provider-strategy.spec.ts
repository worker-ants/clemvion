import { InternalServerErrorException } from '@nestjs/common';
import { resolveOAuthStrategy } from './index';
import { GoogleOAuthStrategy, googleOAuthStrategy } from './google.strategy';
import { GitHubOAuthStrategy, githubOAuthStrategy } from './github.strategy';
import {
  Cafe24PublicOAuthStrategy,
  cafe24PublicOAuthStrategy,
} from './cafe24-public.strategy';
import {
  Cafe24PrivateOAuthStrategy,
  cafe24PrivateOAuthStrategy,
} from './cafe24-private.strategy';
import {
  MakeshopOAuthStrategy,
  makeshopOAuthStrategy,
} from './makeshop.strategy';
import { makeFakeJwt } from '../__test-utils__/make-fake-jwt';

/**
 * Unit tests for the M-2 OAuth provider strategies. These exercise the pure
 * protocol decisions directly — including the defensive exception paths the
 * facade normally guards before reaching the strategy (ai-review 2026-06-21
 * testing WARNINGs 1-6).
 */

/** Capture the NestJS exception `code` thrown by a synchronous strategy call. */
function thrownCode(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    const res = (e as { getResponse?: () => unknown }).getResponse?.();
    return (res as { code?: string })?.code ?? 'NO_CODE';
  }
  return 'DID_NOT_THROW';
}

const envCreds = { clientId: 'env-id', clientSecret: 'env-secret' };
const emptyEnvCreds = { clientId: '', clientSecret: '' };
const REDIRECT = 'https://app.example.com/api/3rd-party/x/callback';

describe('resolveOAuthStrategy registry', () => {
  it('maps each provider to its strategy', () => {
    expect(resolveOAuthStrategy('google')).toBeInstanceOf(GoogleOAuthStrategy);
    expect(resolveOAuthStrategy('github')).toBeInstanceOf(GitHubOAuthStrategy);
    expect(resolveOAuthStrategy('makeshop')).toBeInstanceOf(
      MakeshopOAuthStrategy,
    );
  });

  it('sub-dispatches cafe24 on appType (private vs public default)', () => {
    expect(resolveOAuthStrategy('cafe24', 'private')).toBeInstanceOf(
      Cafe24PrivateOAuthStrategy,
    );
    expect(resolveOAuthStrategy('cafe24', 'public')).toBeInstanceOf(
      Cafe24PublicOAuthStrategy,
    );
    // No appType → public default (parse/meta are identical across the two).
    expect(resolveOAuthStrategy('cafe24')).toBeInstanceOf(
      Cafe24PublicOAuthStrategy,
    );
  });
});

describe('Standard OAuth strategies (google / github)', () => {
  it('google buildAuthorizeUrl — space scopes, static host, code response', () => {
    const url = googleOAuthStrategy.buildAuthorizeUrl({
      clientId: 'cid',
      redirectUri: REDIRECT,
      scopes: ['openid', 'email'],
      state: 'st',
    });
    expect(
      url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'),
    ).toBe(true);
    expect(url).toContain('scope=openid+email'); // space → '+'
    expect(url).toContain('response_type=code');
    expect(url).toContain('state=st');
  });

  it('github buildAuthorizeUrl — github host', () => {
    const url = githubOAuthStrategy.buildAuthorizeUrl({
      clientId: 'cid',
      redirectUri: REDIRECT,
      scopes: ['repo'],
      state: 'st',
    });
    expect(url.startsWith('https://github.com/login/oauth/authorize?')).toBe(
      true,
    );
  });

  it('buildTokenRequest — creds in body, no Basic auth header', () => {
    const req = googleOAuthStrategy.buildTokenRequest({
      code: 'abc',
      redirectUri: REDIRECT,
      providerMeta: null,
      envCredentials: envCreds,
    });
    expect(req.tokenUrl).toBe('https://oauth2.googleapis.com/token');
    expect(req.headers.Authorization).toBeUndefined();
    expect(req.body.get('client_id')).toBe('env-id');
    expect(req.body.get('client_secret')).toBe('env-secret');
    expect(req.body.get('grant_type')).toBe('authorization_code');
    expect(req.body.get('code')).toBe('abc');
  });

  it('buildTokenRequest — missing env creds throws OAUTH_CONFIG_MISSING with provider key', () => {
    let caught: unknown;
    try {
      googleOAuthStrategy.buildTokenRequest({
        code: 'abc',
        redirectUri: REDIRECT,
        providerMeta: null,
        envCredentials: emptyEnvCreds,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InternalServerErrorException);
    const res = (caught as InternalServerErrorException).getResponse() as {
      code: string;
      message: string;
    };
    expect(res.code).toBe('OAUTH_CONFIG_MISSING');
    expect(res.message).toContain('GOOGLE_CLIENT_ID');
    expect(res.message).toContain('GOOGLE_CLIENT_SECRET');
  });

  it('parseTokenExpiresAt — expires_in only, null when absent', () => {
    const at = googleOAuthStrategy.parseTokenExpiresAt({ expires_in: 3600 });
    expect(at).not.toBeNull();
    expect((at as Date).getTime()).toBeGreaterThan(Date.now() + 3590_000);
    expect((at as Date).getTime()).toBeLessThan(Date.now() + 3610_000);
    expect(googleOAuthStrategy.parseTokenExpiresAt({})).toBeNull();
  });

  it('extractProviderMeta — google account_email (falls back to email, null when absent)', () => {
    expect(
      googleOAuthStrategy.extractProviderMeta({ account_email: 'a@b.com' }),
    ).toEqual({ account_email: 'a@b.com' });
    expect(
      googleOAuthStrategy.extractProviderMeta({ email: 'c@d.com' }),
    ).toEqual({ account_email: 'c@d.com' });
    expect(googleOAuthStrategy.extractProviderMeta({})).toEqual({
      account_email: null,
    });
  });

  it('extractProviderMeta — github login', () => {
    expect(
      githubOAuthStrategy.extractProviderMeta({ login: 'octocat' }),
    ).toEqual({ login: 'octocat' });
  });

  it('buildStubResult — provider-prefixed token, ~30d TTL', () => {
    const g = googleOAuthStrategy.buildStubResult(['openid'], null);
    expect(g.accessToken.startsWith('stub-google-')).toBe(true);
    expect(g.refreshToken?.startsWith('stub-refresh-')).toBe(true);
    expect(g.scopes).toEqual(['openid']);
    expect(g.providerMeta).toEqual({ stub: true });
    expect((g.tokenExpiresAt as Date).getTime()).toBeGreaterThan(
      Date.now() + 29 * 24 * 60 * 60 * 1000,
    );
    expect(
      githubOAuthStrategy
        .buildStubResult([], null)
        .accessToken.startsWith('stub-github-'),
    ).toBe(true);
  });
});

describe('Cafe24 OAuth strategies (public / private)', () => {
  it('buildAuthorizeUrl — comma scopes, mall_id host', () => {
    const url = cafe24PublicOAuthStrategy.buildAuthorizeUrl({
      clientId: 'cid',
      redirectUri: REDIRECT,
      scopes: ['mall.read_product', 'mall.write_product'],
      state: 'st',
      mallId: 'myshop',
    });
    expect(
      url.startsWith('https://myshop.cafe24api.com/api/v2/oauth/authorize?'),
    ).toBe(true);
    // comma-delimited → '%2C', not '+' / '%20'
    expect(url).toContain('scope=mall.read_product%2Cmall.write_product');
  });

  it('buildAuthorizeUrl — missing mallId throws CAFE24_INVALID_MALL_ID', () => {
    expect(
      thrownCode(() =>
        cafe24PublicOAuthStrategy.buildAuthorizeUrl({
          clientId: 'cid',
          redirectUri: REDIRECT,
          scopes: ['mall.read_product'],
          state: 'st',
        }),
      ),
    ).toBe('CAFE24_INVALID_MALL_ID');
  });

  it('public buildTokenRequest — Basic auth from env, bare body, mall token host', () => {
    const req = cafe24PublicOAuthStrategy.buildTokenRequest({
      code: 'abc',
      redirectUri: REDIRECT,
      providerMeta: { mall_id: 'myshop', app_type: 'public' },
      envCredentials: envCreds,
    });
    expect(req.tokenUrl).toBe(
      'https://myshop.cafe24api.com/api/v2/oauth/token',
    );
    expect(req.headers.Authorization).toBe(
      `Basic ${Buffer.from('env-id:env-secret').toString('base64')}`,
    );
    // Cafe24: client creds NOT in body.
    expect(req.body.get('client_id')).toBeNull();
    expect(req.body.get('client_secret')).toBeNull();
    expect(req.body.get('grant_type')).toBe('authorization_code');
  });

  it('public buildTokenRequest — missing env throws OAUTH_CONFIG_MISSING', () => {
    expect(
      thrownCode(() =>
        cafe24PublicOAuthStrategy.buildTokenRequest({
          code: 'abc',
          redirectUri: REDIRECT,
          providerMeta: { mall_id: 'myshop', app_type: 'public' },
          envCredentials: emptyEnvCreds,
        }),
      ),
    ).toBe('OAUTH_CONFIG_MISSING');
  });

  it('buildTokenRequest — missing mall_id throws CAFE24_INVALID_MALL_ID', () => {
    expect(
      thrownCode(() =>
        cafe24PublicOAuthStrategy.buildTokenRequest({
          code: 'abc',
          redirectUri: REDIRECT,
          providerMeta: {},
          envCredentials: envCreds,
        }),
      ),
    ).toBe('CAFE24_INVALID_MALL_ID');
  });

  it('private buildTokenRequest — creds from providerMeta, ignores envCredentials', () => {
    const req = cafe24PrivateOAuthStrategy.buildTokenRequest({
      code: 'abc',
      redirectUri: REDIRECT,
      providerMeta: {
        mall_id: 'myshop',
        app_type: 'private',
        client_id: 'priv-id',
        client_secret: 'priv-secret',
      },
      envCredentials: envCreds,
    });
    expect(req.headers.Authorization).toBe(
      `Basic ${Buffer.from('priv-id:priv-secret').toString('base64')}`,
    );
  });

  it('private buildTokenRequest — missing creds throws CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED', () => {
    expect(
      thrownCode(() =>
        cafe24PrivateOAuthStrategy.buildTokenRequest({
          code: 'abc',
          redirectUri: REDIRECT,
          providerMeta: { mall_id: 'myshop', app_type: 'private' },
          envCredentials: envCreds,
        }),
      ),
    ).toBe('CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED');
  });

  it('parseTokenExpiresAt — JWT exp wins over everything', () => {
    const expSec = Math.floor(Date.now() / 1000) + 7200;
    const jwt = makeFakeJwt({ exp: expSec });
    const at = cafe24PublicOAuthStrategy.parseTokenExpiresAt({
      access_token: jwt,
      expires_in: 60,
      expires_at: '2020-01-01T00:00:00Z',
    });
    expect((at as Date).getTime()).toBe(expSec * 1000);
  });

  it('parseTokenExpiresAt — expires_in next, TZ-less expires_at normalized to KST, else 2h default', () => {
    const byIn = cafe24PublicOAuthStrategy.parseTokenExpiresAt({
      access_token: 'opaque',
      expires_in: 3600,
    });
    expect((byIn as Date).getTime()).toBeGreaterThan(Date.now() + 3590_000);

    const byIso = cafe24PublicOAuthStrategy.parseTokenExpiresAt({
      access_token: 'opaque',
      expires_at: '2026-06-21T18:00:00',
    });
    expect((byIso as Date).getTime()).toBe(
      Date.parse('2026-06-21T18:00:00+09:00'),
    );

    const byDefault = cafe24PublicOAuthStrategy.parseTokenExpiresAt({
      access_token: 'opaque',
    });
    expect((byDefault as Date).getTime()).toBeGreaterThan(
      Date.now() + 2 * 60 * 60 * 1000 - 10_000,
    );
    expect((byDefault as Date).getTime()).toBeLessThan(
      Date.now() + 2 * 60 * 60 * 1000 + 10_000,
    );
  });

  it('extractProviderMeta — operator id + echoed mall_id, empty when absent', () => {
    expect(
      cafe24PublicOAuthStrategy.extractProviderMeta({
        user_id: 'op-1',
        mall_id: 'myshop',
      }),
    ).toEqual({
      cafe24_operator_id: 'op-1',
      cafe24_response_mall_id: 'myshop',
    });
    expect(cafe24PublicOAuthStrategy.extractProviderMeta({})).toEqual({});
  });

  it('buildStubResult — cafe24-prefixed token, ~2h TTL, operator id', () => {
    const r = cafe24PublicOAuthStrategy.buildStubResult(['mall.read_product'], {
      mall_id: 'myshop',
    });
    expect(r.accessToken.startsWith('stub-cafe24-')).toBe(true);
    expect(r.providerMeta.stub).toBe(true);
    expect(typeof r.providerMeta.cafe24_operator_id).toBe('string');
    expect(r.providerMeta.cafe24_response_mall_id).toBe('myshop');
    const ttl = (r.tokenExpiresAt as Date).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(2 * 60 * 60 * 1000 - 10_000);
    expect(ttl).toBeLessThan(2 * 60 * 60 * 1000 + 10_000);
  });

  it('describeExchange — mall_id mismatch + scope shortfall warnings + success info', () => {
    const diag = cafe24PublicOAuthStrategy.describeExchange(
      {
        accessToken: 'a',
        refreshToken: null,
        scopes: ['mall.read_product'],
        tokenExpiresAt: new Date(),
        providerMeta: { cafe24_response_mall_id: 'echoed-shop' },
      },
      ['mall.read_product', 'mall.write_product'],
      { mall_id: 'myshop' },
    );
    expect(diag.warnings.some((w) => w.includes('mall_id mismatch'))).toBe(
      true,
    );
    expect(diag.warnings.some((w) => w.includes('granted fewer scopes'))).toBe(
      true,
    );
    expect(diag.info.some((i) => i.includes('token exchange succeeded'))).toBe(
      true,
    );
  });

  it('describeExchange — no warnings when mall + scopes match', () => {
    const diag = cafe24PublicOAuthStrategy.describeExchange(
      {
        accessToken: 'a',
        refreshToken: null,
        scopes: ['mall.read_product'],
        tokenExpiresAt: new Date(),
        providerMeta: { cafe24_response_mall_id: 'myshop' },
      },
      ['mall.read_product'],
      { mall_id: 'myshop' },
    );
    expect(diag.warnings).toEqual([]);
    expect(diag.info).toHaveLength(1);
  });
});

describe('MakeShop OAuth strategy', () => {
  it('buildAuthorizeUrl — space scopes + PKCE S256', () => {
    const url = makeshopOAuthStrategy.buildAuthorizeUrl({
      clientId: 'cid',
      redirectUri: REDIRECT,
      scopes: ['read', 'write'],
      state: 'st',
      codeChallenge: 'chal',
    });
    expect(url.startsWith('https://auth.makeshop.com/oauth/authorize?')).toBe(
      true,
    );
    expect(url).toContain('scope=read+write');
    expect(url).toContain('code_challenge=chal');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('buildAuthorizeUrl — missing codeChallenge throws MAKESHOP_PKCE_REQUIRED', () => {
    expect(
      thrownCode(() =>
        makeshopOAuthStrategy.buildAuthorizeUrl({
          clientId: 'cid',
          redirectUri: REDIRECT,
          scopes: ['read'],
          state: 'st',
        }),
      ),
    ).toBe('MAKESHOP_PKCE_REQUIRED');
  });

  it('buildTokenRequest — Basic auth from providerMeta, code_verifier when present', () => {
    const req = makeshopOAuthStrategy.buildTokenRequest({
      code: 'abc',
      redirectUri: REDIRECT,
      providerMeta: {
        client_id: 'mk-id',
        client_secret: 'mk-secret',
        code_verifier: 'verif',
      },
      envCredentials: emptyEnvCreds,
    });
    expect(req.tokenUrl).toBe('https://auth.makeshop.com/oauth/token');
    expect(req.headers.Authorization).toBe(
      `Basic ${Buffer.from('mk-id:mk-secret').toString('base64')}`,
    );
    expect(req.body.get('code_verifier')).toBe('verif');
    expect(req.body.get('client_id')).toBeNull();
  });

  it('buildTokenRequest — code_verifier omitted when absent', () => {
    const req = makeshopOAuthStrategy.buildTokenRequest({
      code: 'abc',
      redirectUri: REDIRECT,
      providerMeta: { client_id: 'mk-id', client_secret: 'mk-secret' },
      envCredentials: emptyEnvCreds,
    });
    expect(req.body.get('code_verifier')).toBeNull();
  });

  it('buildTokenRequest — missing creds throws MAKESHOP_CREDENTIALS_REQUIRED', () => {
    expect(
      thrownCode(() =>
        makeshopOAuthStrategy.buildTokenRequest({
          code: 'abc',
          redirectUri: REDIRECT,
          providerMeta: { code_verifier: 'v' },
          envCredentials: envCreds,
        }),
      ),
    ).toBe('MAKESHOP_CREDENTIALS_REQUIRED');
  });

  it('parseTokenExpiresAt — expires_in → expires_at → JWT exp → 1h default', () => {
    expect(
      (
        makeshopOAuthStrategy.parseTokenExpiresAt({
          expires_in: 3600,
        }) as Date
      ).getTime(),
    ).toBeGreaterThan(Date.now() + 3590_000);

    const isoMs = Date.parse('2026-06-21T10:00:00Z');
    expect(
      (
        makeshopOAuthStrategy.parseTokenExpiresAt({
          expires_at: '2026-06-21T10:00:00Z',
        }) as Date
      ).getTime(),
    ).toBe(isoMs);

    const expSec = Math.floor(Date.now() / 1000) + 1800;
    expect(
      (
        makeshopOAuthStrategy.parseTokenExpiresAt({
          access_token: makeFakeJwt({ exp: expSec }),
        }) as Date
      ).getTime(),
    ).toBe(expSec * 1000);

    const def = makeshopOAuthStrategy.parseTokenExpiresAt({}) as Date;
    expect(def.getTime()).toBeGreaterThan(Date.now() + 60 * 60 * 1000 - 10_000);
    expect(def.getTime()).toBeLessThan(Date.now() + 60 * 60 * 1000 + 10_000);
  });

  it('extractProviderMeta — empty (no response metadata persisted)', () => {
    expect(makeshopOAuthStrategy.extractProviderMeta({ anything: 1 })).toEqual(
      {},
    );
  });

  it('buildStubResult — makeshop-prefixed token, ~1h TTL, shop_uid mirror', () => {
    const r = makeshopOAuthStrategy.buildStubResult(['read'], {
      shop_uid: 'shop-1',
    });
    expect(r.accessToken.startsWith('stub-makeshop-')).toBe(true);
    expect(r.providerMeta).toEqual({
      stub: true,
      makeshop_response_shop_uid: 'shop-1',
    });
    const ttl = (r.tokenExpiresAt as Date).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(60 * 60 * 1000 - 10_000);
    expect(ttl).toBeLessThan(60 * 60 * 1000 + 10_000);
  });
});
