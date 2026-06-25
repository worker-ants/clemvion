"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useMakeshopPendingPolling } from "@/lib/integrations/use-makeshop-pending-polling";
import type { TFunction } from "@/lib/i18n";

/**
 * MakeShop install-first pending step — mirror of `Cafe24PrivatePendingStep`.
 * Shows the App URL (register in MakeShop Partner Center as the ShopStore app's
 * App URL) + Redirect URI, and polls the integration row until the ShopStore
 * install drives the callback to `connected`. spec/2-navigation/4-integration.md §5.9.
 */
export function MakeshopPendingStep({
  appUrl,
  callbackUrl,
  integrationId,
  t,
}: {
  appUrl: string;
  callbackUrl: string;
  integrationId: string;
  t: TFunction;
}) {
  const router = useRouter();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = (value: string, field: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const { poll, timedOut, lastErrorMessage } =
    useMakeshopPendingPolling(integrationId);

  return (
    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t("integrations.makeshopPendingTitle")}
        </h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t("integrations.makeshopPendingDesc")}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t("integrations.makeshopAppUrlLabel")}
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-[hsl(var(--muted))] px-3 py-2 text-xs">
              {appUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(appUrl, "appUrl")}
              className="shrink-0"
            >
              <Copy className="mr-1 h-3 w-3" />
              {copiedField === "appUrl" ? t("integrations.copied") : "Copy"}
            </Button>
          </div>
        </div>

        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t("integrations.makeshopCallbackUrlLabel")}
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-[hsl(var(--muted))] px-3 py-2 text-xs">
              {callbackUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(callbackUrl, "callbackUrl")}
              className="shrink-0"
            >
              <Copy className="mr-1 h-3 w-3" />
              {copiedField === "callbackUrl"
                ? t("integrations.copied")
                : "Copy"}
            </Button>
          </div>
        </div>
      </div>

      {lastErrorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          <strong>{t("integrations.makeshopPendingLastErrorLabel")}:</strong>{" "}
          {lastErrorMessage}
        </div>
      ) : (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          {t("integrations.makeshopPendingSteps")}
        </div>
      )}

      {poll?.status === "pending_install" && !timedOut && (
        <p className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("integrations.makeshopPendingWaiting")}
        </p>
      )}
      {timedOut && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {t("integrations.makeshopPendingTimedOut")}
        </p>
      )}
      {poll &&
        poll.status !== "pending_install" &&
        poll.status !== "connected" && (
          <p
            role="status"
            className="text-xs text-amber-700 dark:text-amber-300"
          >
            {poll.status === "expired" &&
            poll.statusReason === "install_timeout"
              ? t("integrations.makeshopPendingExpired")
              : t("integrations.makeshopPendingTerminal")}
          </p>
        )}

      <div className="flex justify-end">
        <Button onClick={() => router.push(`/integrations/${integrationId}`)}>
          {t("integrations.makeshopPendingViewList")}
        </Button>
      </div>
    </div>
  );
}
