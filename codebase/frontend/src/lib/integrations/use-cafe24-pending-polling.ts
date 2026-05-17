import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { integrationsApi, type IntegrationDto } from "@/lib/api/integrations";
import { useT } from "@/lib/i18n";

/** Polling cadence while the row is still `pending_install`. */
export const PRIVATE_PENDING_POLL_MS = 3000;
/** Soft timeout — UI stops auto-refreshing and surfaces a "still pending"
 * notice after this. The row continues to exist on the backend and the
 * polling resumes on next navigation / window focus. */
export const PRIVATE_PENDING_TIMEOUT_MS = 10 * 60 * 1000;

export interface Cafe24PendingPollResult {
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
 * Polling state machine for Cafe24 Private pending_install rows.
 *
 * Cafe24 Developers' "테스트 실행" opens its own popup whose `window.opener`
 * is the Cafe24 tab — our oauth_callback postMessage listener never fires.
 * This hook polls the integration row at 3s cadence, transitions on
 * `connected` by toasting + invalidating + routing to the detail page,
 * surfaces backend-recorded callback failures, and times out after 10m.
 *
 * Extracted from `Cafe24PrivatePendingStep` so the polling logic can be
 * unit-tested with `renderHook` without the heavy component shell.
 *
 * spec/2-navigation/4-integration.md ## Rationale.
 */
export function useCafe24PendingPolling(
  integrationId: string,
): Cafe24PendingPollResult {
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
      if (!row) return PRIVATE_PENDING_POLL_MS;
      if (row.status !== "pending_install") return false; // stop on terminal
      return PRIVATE_PENDING_POLL_MS;
    },
    refetchOnWindowFocus: true,
    enabled: !timedOut,
  });

  // 10-minute soft timeout. Effect-driven so Date.now() never runs in render
  // (react-hooks/purity rule).
  useEffect(() => {
    const handle = setTimeout(
      () => setTimedOut(true),
      PRIVATE_PENDING_TIMEOUT_MS,
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
      router.replace(`/integrations/${integrationId}`);
    }
  }, [poll, router, queryClient, integrationId, t]);

  const lastErrorMessage =
    poll?.status === "pending_install"
      ? ((poll.lastError as { message?: string } | null)?.message ??
        poll.statusReason ??
        null)
      : null;

  return { poll, timedOut, lastErrorMessage };
}
