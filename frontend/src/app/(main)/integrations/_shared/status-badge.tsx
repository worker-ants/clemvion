import { cn } from "@/lib/utils/cn";
import type { IntegrationDto } from "@/lib/api/integrations";

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
    return {
      label: "Pending install",
      dotClassName: "bg-blue-400",
      tone: "warn",
      detail: "Complete Cafe24 Test Run to activate",
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
    return {
      label: "Expired",
      dotClassName: "bg-yellow-500",
      tone: "warn",
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
