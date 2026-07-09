"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Smartphone, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { formatDate, timeAgo } from "@/lib/utils/date";
import type { SessionDto } from "@/lib/api/sessions";

interface SessionRowProps {
  session: SessionDto;
  onRevoke: (familyId: string) => void;
  pending?: boolean;
}

export function SessionRow({ session, onRevoke, pending }: SessionRowProps) {
  const t = useT();
  const lastActivityIso = session.lastUsedAt ?? session.createdAt;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--border))] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Smartphone
          className="mt-0.5 h-5 w-5 text-[hsl(var(--muted-foreground))]"
          aria-hidden
        />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {session.deviceLabel ?? t("profile.sessions.unknownDevice")}
            </span>
            {session.isCurrent && (
              <Badge variant="default">
                {t("profile.sessions.currentBadge")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {session.ipAddress ?? t("profile.sessions.unknownIp")}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {t("profile.sessions.lastUsed")}: {timeAgo(lastActivityIso)}{" "}
            <span aria-hidden>· </span>
            {t("profile.sessions.expiresAt")}:{" "}
            {formatDate(session.expiresAt, "datetime")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:flex-shrink-0">
        {session.isCurrent ? (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {t("profile.sessions.revokeCurrentHint")}
          </span>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRevoke(session.familyId)}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {t("profile.sessions.revoke")}
          </Button>
        )}
      </div>
    </div>
  );
}
