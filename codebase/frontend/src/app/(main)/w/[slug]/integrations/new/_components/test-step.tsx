"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  integrationsApi,
  type ServiceDefinition,
} from "@/lib/api/integrations";
import type { TFunction } from "@/lib/i18n";

interface TestStepProps {
  service: ServiceDefinition;
  name: string;
  serviceType: string;
  authType: string;
  credentials: Record<string, unknown>;
  skipProbe: boolean;
  savedError: string | null;
  onTestError: (err: string | null) => void;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  t: TFunction;
}

export function TestStep({
  service,
  name,
  serviceType,
  authType,
  credentials,
  skipProbe,
  savedError,
  onTestError,
  saving,
  onBack,
  onSave,
  t,
}: TestStepProps) {
  const test = useQuery({
    queryKey: ["integrations", "preview-test", serviceType, authType],
    enabled: !skipProbe,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await integrationsApi.previewTest({
        serviceType,
        authType,
        credentials,
      });
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
  });

  useEffect(() => {
    if (!skipProbe && test.isError) {
      onTestError(
        (test.error as Error | undefined)?.message ??
          t("integrations.validationFailed"),
      );
    } else if (test.isSuccess) {
      onTestError(null);
    }
  }, [skipProbe, test.isError, test.isSuccess, test.error, onTestError, t]);

  const pending = !skipProbe && test.isPending;
  const failed = (!skipProbe && test.isError) || !!savedError;
  const message = savedError
    ? savedError
    : test.isError
      ? (test.error as Error | undefined)?.message
      : null;

  return (
    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
      <div className="flex items-center gap-3">
        {pending ? (
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        ) : failed ? (
          <XCircle className="h-8 w-8 text-red-500" />
        ) : (
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        )}
        <div>
          <h2 className="text-lg font-semibold">
            {pending
              ? t("integrations.testingCredentials")
              : failed
                ? t("integrations.validationFailed")
                : t("integrations.readyToSave")}
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {pending
              ? t("integrations.runningProbe")
              : failed
                ? (message ?? t("integrations.checkAuthRetry"))
                : t("integrations.readyMessage", {
                    service: service.name,
                    name,
                  })}
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          {t("integrations.backToAuth")}
        </Button>
        <Button onClick={onSave} disabled={saving || pending || failed}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("integrations.saveIntegration")}
        </Button>
      </div>
    </div>
  );
}
