/**
 * OAuth provider strategy registry (refactor M-2).
 *
 * Resolves the stateless per-provider strategy singleton. Cafe24 sub-dispatches
 * on `appType` (public = env creds, private = state-body creds); response
 * parsing (expiry / metadata / stub) is identical across the two cafe24
 * variants, so callers that only parse a response may omit `appType` (defaults
 * to public).
 */
import {
  type Cafe24AppType,
  type OAuthProvider,
  type OAuthProviderStrategy,
} from './oauth-provider-strategy';
import { googleOAuthStrategy } from './google.strategy';
import { githubOAuthStrategy } from './github.strategy';
import { cafe24PublicOAuthStrategy } from './cafe24-public.strategy';
import { cafe24PrivateOAuthStrategy } from './cafe24-private.strategy';
import { makeshopOAuthStrategy } from './makeshop.strategy';

export * from './oauth-provider-strategy';

export function resolveOAuthStrategy(
  provider: OAuthProvider,
  appType?: Cafe24AppType,
): OAuthProviderStrategy {
  switch (provider) {
    case 'google':
      return googleOAuthStrategy;
    case 'github':
      return githubOAuthStrategy;
    case 'makeshop':
      return makeshopOAuthStrategy;
    case 'cafe24':
      return appType === 'private'
        ? cafe24PrivateOAuthStrategy
        : cafe24PublicOAuthStrategy;
  }
}
