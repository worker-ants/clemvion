"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import { formatDate } from "@/lib/utils/date";
import {
  sessionsApi,
  type LoginHistoryEvent,
  type LoginHistoryPageDto,
} from "@/lib/api/sessions";

const EVENT_LABEL_KEYS: Record<LoginHistoryEvent, TranslationKey> = {
  login_success: "profile.sessions.eventLoginSuccess",
  login_failed: "profile.sessions.eventLoginFailed",
  totp_failed: "profile.sessions.eventTotpFailed",
  logout: "profile.sessions.eventLogout",
  session_revoked: "profile.sessions.eventSessionRevoked",
  token_reuse_detected: "profile.sessions.eventTokenReuseDetected",
};

const FAILURE_EVENTS = new Set<LoginHistoryEvent>([
  "login_failed",
  "totp_failed",
  "token_reuse_detected",
]);

export function LoginHistoryList() {
  const t = useT();
  const query = useInfiniteQuery<LoginHistoryPageDto>({
    queryKey: ["auth", "login-history"],
    queryFn: ({ pageParam }) =>
      sessionsApi.getLoginHistory({
        cursor: typeof pageParam === "string" ? pageParam : undefined,
        limit: 50,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-[hsl(var(--muted-foreground))]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="py-6 text-center text-sm text-[hsl(var(--destructive))]">
        {t("profile.sessions.historyLoadFailed")}
      </p>
    );
  }

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {t("profile.sessions.historyEmpty")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))]">
        {items.map((row) => {
          const isFailure = FAILURE_EVENTS.has(row.event);
          return (
            <li
              key={row.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    isFailure
                      ? "font-medium text-[hsl(var(--destructive))]"
                      : "font-medium"
                  }
                >
                  {t(EVENT_LABEL_KEYS[row.event])}
                </span>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {row.deviceLabel ?? t("profile.sessions.unknownDevice")}
                </span>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {row.ipAddress ?? t("profile.sessions.unknownIp")}
                </span>
                {row.failureReason && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    ({t("profile.sessions.failureReasonLabel")}:{" "}
                    {row.failureReason})
                  </span>
                )}
              </div>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {formatDate(row.createdAt, "datetime")}
              </span>
            </li>
          );
        })}
      </ul>

      {query.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("profile.sessions.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
