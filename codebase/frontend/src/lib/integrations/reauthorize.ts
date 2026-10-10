import type { IntegrationDto } from "@/lib/api/integrations";

/**
 * `status_reason` value used when a `pending_install` Cafe24 Private row
 * times out after the install TTL (see backend integration-expiry scanner).
 * Shared so FE branches don't drift from the snake_case value the backend
 * writes.
 */
export const INSTALL_TIMEOUT_REASON = "install_timeout";

/** Why the Reauthorize action is unavailable — selects the hint copy. */
export type ReauthorizeDisabledReason =
  | "pending_install"
  | "install_timeout"
  | "no_app_url"
  | "makeshop";

/** Why "Request scopes" is unavailable — selects the hint copy. */
export type RequestScopesDisabledReason = "makeshop" | "no_app_url";

/** Cafe24 Private app integration (`meta.appType === "private"`). */
export function isCafe24Private(integration: IntegrationDto): boolean {
  return (
    integration.serviceType === "cafe24" &&
    integration.meta?.appType === "private"
  );
}

/**
 * A Cafe24 Private row with no App URL. The server derives `appUrl` from the
 * row's `install_token` and the token is cleared when the install times out,
 * so "no `appUrl`" here means "no install_token" on the server
 * (`hasInstallToken` in `integrations.service.ts`). If that server condition
 * changes, change this one with it. Without an App URL the user cannot finish
 * a reinstall in Cafe24 Developers, so reauthorize and request-scopes are
 * unavailable and the only recovery is delete and re-register.
 */
function isCafe24PrivateWithoutAppUrl(integration: IntegrationDto): boolean {
  return isCafe24Private(integration) && !integration.appUrl;
}

/**
 * Why the Reauthorize action is unavailable, or `null` when it is available.
 *
 * - `pending_install` rows (any provider) must finish the install first.
 * - `expired` rows with `install_timeout` can only be deleted and re-registered.
 * - Cafe24 Private rows without an App URL (`no_app_url`, install_token gone)
 *   can only be deleted and re-registered too. They are not always timed out —
 *   a `connected` row can lack the App URL as well — so the reason is separate.
 * - MakeShop integrations cannot be reauthorized at all — reinstalling the app
 *   from ShopStore does not restore an existing row, so recovery is delete and
 *   re-register.
 *
 * Cafe24 Private with an App URL is available: the server records a reinstall
 * request and the user finishes it with "테스트 실행" in Cafe24 Developers.
 * NERV CLE-INT-MANAGE · CLE-INT-OAUTH, Task CLE-T-NNENG8.
 */
export function reauthorizeDisabledReason(
  integration: IntegrationDto,
): ReauthorizeDisabledReason | null {
  if (integration.status === "pending_install") return "pending_install";
  if (
    integration.status === "expired" &&
    integration.statusReason === INSTALL_TIMEOUT_REASON
  ) {
    return "install_timeout";
  }
  if (integration.serviceType === "makeshop") return "makeshop";
  if (isCafe24PrivateWithoutAppUrl(integration)) return "no_app_url";
  return null;
}

/**
 * Whether the Reauthorize action is disabled for this integration — see
 * {@link reauthorizeDisabledReason}. Lives in `lib/integrations` rather than
 * the badge UI module so other surfaces (detail page, list ⋮ menu) can reuse
 * without depending on a presentational component.
 */
export function isReauthorizeDisabled(integration: IntegrationDto): boolean {
  return reauthorizeDisabledReason(integration) !== null;
}

/**
 * Why "Request scopes" is unavailable, or `null` when it is available.
 * MakeShop has no scope request path (delete and re-register with the scopes
 * you need), and a Cafe24 Private row without an App URL (`no_app_url`) cannot
 * finish one. NERV CLE-INT-OAUTH, Task CLE-T-NNENG8.
 */
export function requestScopesDisabledReason(
  integration: IntegrationDto,
): RequestScopesDisabledReason | null {
  if (integration.serviceType === "makeshop") return "makeshop";
  if (isCafe24PrivateWithoutAppUrl(integration)) return "no_app_url";
  return null;
}

/** Whether "Request scopes" is disabled — see {@link requestScopesDisabledReason}. */
export function isRequestScopesDisabled(integration: IntegrationDto): boolean {
  return requestScopesDisabledReason(integration) !== null;
}

/**
 * Prefer the human-readable `lastError.message` for surface-level
 * diagnostics; fall back to the machine-readable `status_reason`.
 */
export function pickErrorMessage(
  integration: IntegrationDto,
): string | undefined {
  const lastError = integration.lastError as
    | { message?: string }
    | null
    | undefined;
  if (lastError && typeof lastError.message === "string" && lastError.message) {
    return lastError.message;
  }
  return integration.statusReason ?? undefined;
}
