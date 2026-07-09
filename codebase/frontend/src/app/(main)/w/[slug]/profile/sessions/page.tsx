"use client";

import { useT } from "@/lib/i18n";
import { SessionsPanel } from "./sessions-panel";

export default function SessionsPage() {
  const t = useT();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("profile.sessions.pageTitle")}
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("profile.sessions.pageDescription")}
        </p>
      </header>
      <SessionsPanel />
    </div>
  );
}
