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
  /** Main status label rendered next to the colored dot. */
  label: string;
  dotClassName: string;
  tone: "ok" | "warn" | "err";
  /**
   * Short diagnostic shown in parentheses next to the label — meant for
   * error/attention reasons (e.g. `auth_failed`, `oauth_token_exchange_failed`
   * snippet). Implies an actionable problem.
   */
  detail?: string;
  /**
   * Auxiliary informational caption rendered in a muted tone after the
   * label, used to convey background-OK signals such as auto-refresh
   * countdowns. Distinct from `detail` — `subLabel` is *not* an error
   * indicator. spec/2-navigation/4-integration.md §4.1 헤더 정책 +
   * Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)".
   */
  subLabel?: string;
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
  // expiresSoon 분기는 autoRefresh=false 통합에만 적용 — 짧은-수명 OAuth
  // 토큰(cafe24 access_token 2h 등) 이 항상 노란 'Expires today' 로
  // 표시되는 거짓 양성을 막기 위함. autoRefresh=true 통합은 만료 임박
  // 해도 'Connected' 메인 라벨 유지 + 보조 라벨로만 안내.
  // spec/2-navigation/4-integration.md §2.4 / §4.1 + Rationale.
  if (expiresSoon && !integration.autoRefresh) {
    const days = daysUntil(integration.tokenExpiresAt!);
    return {
      label: days <= 0 ? "Expires today" : `Expires in ${days}d`,
      dotClassName: "bg-yellow-500",
      tone: "warn",
    };
  }
  // Connected 분기. autoRefresh=true + tokenExpiresAt 가 있는 경우 보조
  // 라벨로 "Auto-renews · in <duration>" 안내.
  const subLabel =
    integration.autoRefresh && integration.tokenExpiresAt
      ? `Auto-renews · in ${humanizeUntil(integration.tokenExpiresAt)}`
      : undefined;
  return {
    label: "Connected",
    dotClassName: "bg-green-500",
    tone: "ok",
    subLabel,
  };
}

// EXPIRING_SOON_DAYS — kept in sync with backend `EXPIRING_SOON_INTERVAL`
// (integrations.service.ts) and spec §2.3/§2.4/§11.4. Change both layers
// together; the parity tests in __tests__ guard the literal value.
export const EXPIRING_SOON_DAYS = 7;
const EXPIRING_SOON_MS = EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;

export function isExpiringSoon(at: string | null | undefined): boolean {
  if (!at) return false;
  const ms = new Date(at).getTime() - Date.now();
  return ms > 0 && ms <= EXPIRING_SOON_MS;
}

function daysUntil(at: string): number {
  const ms = new Date(at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Human-friendly remaining time until the given ISO timestamp, used by the
 * "Auto-renews · in <X>" subLabel (header status badge) and the Overview
 * Token Expires row friendly value. Short (< 1h): minutes only. Medium
 * (< 24h): hours + minutes. Long: days.
 *
 * @param at - ISO 8601 timestamp string (UTC). Invalid or already-past
 *             values return `""` so callers can guard with a truthy check
 *             without rendering misleading "0m" countdowns.
 * @returns Localized-agnostic short form (e.g. `"1h 24m"`, `"45m"`, `"3d"`)
 *          or `""` for past / invalid input.
 *
 * spec/2-navigation/4-integration.md §4.1 헤더 메타 라인 규약.
 */
export function humanizeUntil(at: string): string {
  const ms = new Date(at).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) {
    return remMinutes === 0 ? `${hours}h` : `${hours}h ${remMinutes}m`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function needsAttention(integration: IntegrationDto): boolean {
  // TODO(autoRefresh 가드): spec/2-navigation/4-integration.md §2.4·§11.4
  // (PR #139) 가 attention 술어에서 `autoRefresh=true` 통합을 제외하도록
  // 정의했으나, 본 가드의 frontend 반영과 backend `EXPIRING_SOON_INTERVAL`
  // 쿼리 변경(`integrations.service.ts:248~275`) 은 같은 PR 에서 동기되어야
  // 사이드바 카운트·목록 attention 카드와 일관된다. 후속 PR
  // (`plan/in-progress/integration-token-ui-autorefresh.md` 의 "본 PR 범위
  // 밖" + `20260516-full-review/SUMMARY.md` W-32 와 병합 처리) 에서 처리.
  // 그 PR 전까지는 spec PR #139 의 attention 술어와 frontend 구현 사이에
  // 일시적 불일치 (cafe24 가 사이드바 카운트에 포함) 가 잔존한다.
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
  // Priority order for `mostUrgentId` when multiple categories coexist.
  // Used by the banner's single-row → detail-jump UX (total === 1 case) and
  // surfaces the most actionable row when callers want a deterministic pick.
  const ATTENTION_RANK = { error: 3, expired: 2, expiring: 1 } as const;
  let expired = 0;
  let expiring = 0;
  let error = 0;
  let mostUrgent: { id: string; rank: number } | null = null;

  for (const i of integrations) {
    if (!needsAttention(i)) continue;
    let rank: number;
    if (i.status === "error") {
      error += 1;
      rank = ATTENTION_RANK.error;
    } else if (i.status === "expired") {
      expired += 1;
      rank = ATTENTION_RANK.expired;
    } else {
      // connected + expiring-soon — needsAttention guarantees this branch.
      expiring += 1;
      rank = ATTENTION_RANK.expiring;
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
      {view.subLabel ? (
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          · {view.subLabel}
        </span>
      ) : null}
    </span>
  );
}
