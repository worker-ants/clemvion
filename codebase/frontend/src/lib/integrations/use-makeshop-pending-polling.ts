import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { integrationsApi, type IntegrationDto } from "@/lib/api/integrations";
import { useT } from "@/lib/i18n";

/** Polling cadence while the row is still `pending_install`. */
export const MAKESHOP_PENDING_POLL_MS = 3000;
/** Soft timeout — UI stops auto-refreshing and surfaces a "still pending"
 * notice after this. The row continues to exist on the backend and the
 * polling resumes on next navigation / window focus. */
export const MAKESHOP_PENDING_TIMEOUT_MS = 10 * 60 * 1000;

export interface MakeshopPendingPollResult {
  /** Latest fetched integration row (or `undefined` until first poll). */
  poll: IntegrationDto | undefined;
  /** `true` once the 10-minute soft timeout has elapsed. */
  timedOut: boolean;
  /**
   * Human-readable diagnostic when the row is still pending_install AND a
   * callback failure has been recorded. `null` otherwise.
   */
  lastErrorMessage: string | null;
}

/**
 * Map a backend `statusReason` string to a user-safe i18n key.
 *
 * Known reasons are mapped to explicit i18n keys so raw internal error text
 * (HMAC detail, token exchange trace) is never surfaced to users (W7).
 * Unknown reasons fall back to a generic safe message.
 */
const STATUS_REASON_I18N_KEY: Record<string, string> = {
  oauth_token_exchange_failed:
    "integrations.makeshopErrorOauthTokenExchangeFailed",
  oauth_state_mismatch: "integrations.makeshopErrorOauthStateMismatch",
  oauth_state_expired: "integrations.makeshopErrorOauthStateExpired",
  oauth_invalid_scope: "integrations.makeshopErrorOauthInvalidScope",
  hmac_verification_failed: "integrations.makeshopErrorHmacVerificationFailed",
};

const GENERIC_CALLBACK_ERROR_KEY = "integrations.makeshopErrorGenericCallback";

/**
 * Polling state machine for MakeShop install-first pending_install rows.
 *
 * Mirror of `useCafe24PendingPolling`. MakeShop's ShopStore install opens its
 * own flow whose `window.opener` is the MakeShop tab — our oauth_callback
 * postMessage listener never fires. This hook polls the integration row at 3s
 * cadence, transitions on `connected` by toasting + invalidating + routing to
 * the detail page, surfaces backend-recorded callback failures (mapped to safe
 * i18n messages — W7), and times out after 10m.
 *
 * spec/2-navigation/4-integration.md §5.9 + ## Rationale.
 */
export function useMakeshopPendingPolling(
  integrationId: string,
): MakeshopPendingPollResult {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useT();
  const transitionedRef = useRef(false);
  const [timedOut, setTimedOut] = useState(false);

  const { data: poll } = useQuery({
    queryKey: ["integrations", "get", integrationId],
    queryFn: () => integrationsApi.get(integrationId),
    refetchInterval: (q) => {
      const row = q.state.data as { status?: string } | undefined;
      if (!row) return MAKESHOP_PENDING_POLL_MS;
      if (row.status !== "pending_install") return false; // stop on terminal
      return MAKESHOP_PENDING_POLL_MS;
    },
    refetchOnWindowFocus: true,
    enabled: !timedOut,
  });

  // 10-minute soft timeout. Effect-driven so Date.now() never runs in render
  // (react-hooks/purity rule).
  useEffect(() => {
    const handle = setTimeout(
      () => setTimedOut(true),
      MAKESHOP_PENDING_TIMEOUT_MS,
    );
    return () => clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (transitionedRef.current) return;
    if (!poll) return;
    if (poll.status === "connected") {
      transitionedRef.current = true;
      toast.success(t("integrations.oauthCompletedToast"));
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
      // encodeURIComponent guards against path-traversal in integrationId
      // (INFO4 — UUID format expected; encode as an additional belt-and-suspenders).
      router.replace(`/integrations/${encodeURIComponent(integrationId)}`);
    }
  }, [poll, router, queryClient, integrationId, t]);

  // Map statusReason to a safe i18n message. Raw backend error text (HMAC
  // trace, token exchange detail) is never passed through to the UI (W7).
  const lastErrorMessage = (() => {
    if (poll?.status !== "pending_install") return null;
    const reason = poll.statusReason ?? null;
    if (!reason) return null;
    const i18nKey =
      STATUS_REASON_I18N_KEY[reason] ?? GENERIC_CALLBACK_ERROR_KEY;
    return t(i18nKey as Parameters<typeof t>[0]);
  })();

  return { poll, timedOut, lastErrorMessage };
}
