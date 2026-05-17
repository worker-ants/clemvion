import type { IntegrationDto } from "@/lib/api/integrations";

/**
 * `status_reason` value used when a `pending_install` Cafe24 Private row
 * times out after the install TTL (see backend integration-expiry scanner).
 * Shared so FE branches don't drift from the snake_case value the backend
 * writes.
 */
export const INSTALL_TIMEOUT_REASON = "install_timeout";

/**
 * Whether the Reauthorize action is disabled for this integration.
 *
 * Cafe24 Private apps have no reauthorize entry point — re-auth must come
 * from Cafe24 Developers "테스트 실행". `pending_install` rows (any provider)
 * and `expired` rows with `install_timeout` cannot be reauthorized either.
 *
 * Mirrors spec/2-navigation/4-integration.md §4.2 Reauthorize 비활성 조건.
 * Lives in `lib/integrations` rather than the badge UI module so other
 * surfaces (detail page, list ⋮ menu) can reuse without depending on a
 * presentational component.
 */
export function isReauthorizeDisabled(integration: IntegrationDto): boolean {
  if (integration.status === "pending_install") return true;
  if (
    integration.status === "expired" &&
    integration.statusReason === INSTALL_TIMEOUT_REASON
  ) {
    return true;
  }
  if (
    integration.serviceType === "cafe24" &&
    integration.meta?.appType === "private"
  ) {
    return true;
  }
  return false;
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
