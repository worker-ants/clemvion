import { cn } from "@/lib/utils/cn";
import type { IntegrationDto } from "@/lib/api/integrations";
import {
  INSTALL_TIMEOUT_REASON,
  isReauthorizeDisabled,
  pickErrorMessage,
} from "@/lib/integrations/reauthorize";

// Re-export so existing `import { isReauthorizeDisabled } from "../_shared/status-badge"`
// keep working through the transition. New code should import directly from
// `@/lib/integrations/reauthorize`.
export { isReauthorizeDisabled };

export interface StatusView {
  label: string;
  dotClassName: string;
  tone: "ok" | "warn" | "err";
  detail?: string;
}

export function computeStatus(integration: IntegrationDto): StatusView {
  const expiresSoon = isExpiringSoon(integration.tokenExpiresAt);

  if (integration.credentialsStatus === "needs_reauth") {
    return {
      label: "Reconnection required",
      dotClassName: "bg-amber-500",
      tone: "warn",
    };
  }
  if (integration.status === "pending_install") {
    // If a callback failure was recorded, surface its diagnostic instead of
    // the generic "complete test run" hint — the user needs to fix the
    // reported error (e.g. invalid client_id) before re-running test in
    // Cafe24 Developers. spec/2-navigation/4-integration.md §10.4
    // lastError.message is human-friendlier when available; status_reason
    // is the snake_case fallback.
    const diagnostic = pickErrorMessage(integration);
    return {
      label: "Pending install",
      dotClassName: "bg-blue-400",
      tone: diagnostic ? "err" : "warn",
      detail: diagnostic ?? "Complete Cafe24 Test Run to activate",
    };
  }
  if (integration.status === "error") {
    return {
      label: "Error",
      dotClassName: "bg-red-500",
      tone: "err",
      detail: integration.statusReason ?? undefined,
    };
  }
  if (integration.status === "expired") {
    // install_timeout is Cafe24-private-specific: user must delete
    // and re-register since there's no reauthorize entry point.
    return {
      label: "Expired",
      dotClassName: "bg-yellow-500",
      tone: "warn",
      detail:
        integration.statusReason === INSTALL_TIMEOUT_REASON
          ? "Install timed out — delete and re-register"
          : undefined,
    };
  }
  if (expiresSoon) {
    const days = daysUntil(integration.tokenExpiresAt!);
    return {
      label: days <= 0 ? "Expires today" : `Expires in ${days}d`,
      dotClassName: "bg-yellow-500",
      tone: "warn",
    };
  }
  return { label: "Connected", dotClassName: "bg-green-500", tone: "ok" };
}

export function isExpiringSoon(at: string | null | undefined): boolean {
  if (!at) return false;
  const ms = new Date(at).getTime() - Date.now();
  return ms > 0 && ms <= 7 * 24 * 60 * 60 * 1000;
}

function daysUntil(at: string): number {
  const ms = new Date(at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function needsAttention(integration: IntegrationDto): boolean {
  if (integration.status === "connected") return isExpiringSoon(integration.tokenExpiresAt);
  if (integration.status === "pending_install") return false;
  return true;
}

export interface AttentionBreakdown {
  expired: number;
  expiring: number;
  error: number;
  total: number;
  /**
   * id of the single attention row when `total === 1`. Used by the banner's
   * single-row UX (direct jump to detail instead of filter). `null` when the
   * banner-as-filter UX applies. With multiple attention rows the field
   * surfaces the most urgent one (error > expired > expiring) — callers that
   * want strict single-row semantics must guard on `total === 1`.
   */
  mostUrgentId: string | null;
}

/**
 * Single source of truth for the "Need attention" set on the integrations
 * list page. Delegates to `needsAttention()` so the predicate stays
 * consistent between per-row badges, the banner aggregate count, and the
 * `?status=attention` server filter. spec §2.4.
 */
export function computeAttentionBreakdown(
  integrations: IntegrationDto[],
): AttentionBreakdown {
  let expired = 0;
  let expiring = 0;
  let error = 0;
  let mostUrgent: { id: string; rank: number } | null = null;

  for (const i of integrations) {
    if (!needsAttention(i)) continue;
    let rank: number;
    if (i.status === "error") {
      error += 1;
      rank = 3;
    } else if (i.status === "expired") {
      expired += 1;
      rank = 2;
    } else {
      // connected + expiring-soon — needsAttention guarantees this branch.
      expiring += 1;
      rank = 1;
    }
    if (!mostUrgent || rank > mostUrgent.rank) {
      mostUrgent = { id: i.id, rank };
    }
  }

  const total = expired + expiring + error;
  return {
    expired,
    expiring,
    error,
    total,
    mostUrgentId: mostUrgent?.id ?? null,
  };
}

interface StatusBadgeProps {
  integration: IntegrationDto;
  className?: string;
}

export function StatusBadge({ integration, className }: StatusBadgeProps) {
  const view = computeStatus(integration);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        view.tone === "err" && "text-red-600 dark:text-red-400",
        view.tone === "warn" && "text-yellow-700 dark:text-yellow-400",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          view.dotClassName,
        )}
      />
      {view.label}
      {view.detail ? (
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          ({view.detail})
        </span>
      ) : null}
    </span>
  );
}
