"use client";

import { useT } from "@/lib/i18n";
import { NotificationSettingsPanel } from "./notification-settings-panel";

export default function NotificationSettingsPage() {
  const t = useT();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("profile.notifications.pageTitle")}
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("profile.notifications.pageDescription")}
        </p>
      </header>
      <NotificationSettingsPanel />
    </div>
  );
}
