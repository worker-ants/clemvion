"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  integrationsApi,
  type IntegrationDto,
  type ServiceDefinition,
} from "@/lib/api/integrations";
import { type TFunction } from "@/lib/i18n";
import { openOAuthPopup } from "./open-oauth-popup";
import {
  ApprovalRequiredBadge,
  RestrictedScopeNotice,
} from "@/components/integrations/approval-required-badge";

function readRequiresApproval(
  lastError: IntegrationDto["lastError"],
): string[] {
  if (!lastError || typeof lastError !== "object") return [];
  const details = (lastError as { details?: unknown }).details;
  if (!details || typeof details !== "object") return [];
  const arr = (details as { requiresCafe24Approval?: unknown })
    .requiresCafe24Approval;
  if (!Array.isArray(arr)) return [];
  return arr.filter((s): s is string => typeof s === "string");
}

export function ScopeTab({
  integration,
  service,
  onChanged,
  t,
}: {
  integration: IntegrationDto;
  service: ServiceDefinition | undefined;
  onChanged: () => void;
  t: TFunction;
}) {
  const currentScopes = Array.isArray(integration.credentials.scopes)
    ? (integration.credentials.scopes as string[])
    : [];

  const allOptions = service?.scopes ?? [];
  const missingScopes =
    integration.statusReason === "insufficient_scope" &&
    allOptions.length > 0
      ? allOptions.filter((s) => !currentScopes.includes(s.value))
      : [];
  const approvalLookup = new Map(
    allOptions.map((s) => [s.value, s.requiresApproval === true] as const),
  );
  // last_error.details.requiresCafe24Approval — backend (`markAuthFailed` 또는
  // `markIntegrationCallbackError`) 가 별도 승인 명단 ∩ 누락 scope 교집합을 채움.
  // spec/2-navigation/4-integration.md §9.4 / cafe24-restricted-scopes.md §4.3.
  // `IntegrationDto.lastError` 의 union 분기를 안전하게 좁히기 위해 type guard
  // 함수 사용 — 백엔드가 details 를 omit 한 케이스도 깨끗히 처리.
  const requiresApprovalFromError = readRequiresApproval(integration.lastError);

  const [selected, setSelected] = useState<string[]>([]);
  const [cafe24Pending, setCafe24Pending] = useState<{
    scopesAdded: string[];
  } | null>(null);

  const requestMutation = useMutation({
    mutationFn: () => integrationsApi.requestScopes(integration.id, selected),
    onMutate: () => {
      setCafe24Pending(null);
    },
    onSuccess: (res) => {
      if ("authUrl" in res && res.authUrl) {
        openOAuthPopup(res.authUrl);
        toast.success(t("integrations.scopeRequestOpened"));
        onChanged();
      } else if ("mode" in res && res.mode === "cafe24_private_pending") {
        setCafe24Pending({ scopesAdded: res.scopesAdded });
        toast.info(t("integrations.cafe24PrivateScopeRequestTitle"));
        // pending 상태는 cafe24 측 후속 작업이 끝나야 token 이 갱신되므로
        // 지금 onChanged() 로 refetch 해도 변화 없음 — 의도적으로 생략.
      } else {
        toast.error(t("integrations.requestScopesFailed"));
      }
    },
    onError: () => toast.error(t("integrations.requestScopesFailed")),
  });

  if (integration.authType !== "oauth2") {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
        {t("integrations.scopeOnlyOauth")}
      </div>
    );
  }

  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  return (
    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
      <section>
        <h3 className="text-sm font-semibold">{t("integrations.currentScopes")}</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {currentScopes.length === 0 && (
            <li className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("integrations.noScopes")}
            </li>
          )}
          {currentScopes.map((s) => (
            <li
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs"
            >
              {s}
              {approvalLookup.get(s) && <ApprovalRequiredBadge t={t} />}
            </li>
          ))}
        </ul>
      </section>

      {missingScopes.length > 0 && (
        <section className="rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950">
          <div className="font-medium text-red-700 dark:text-red-300">
            {t("integrations.missingScopesDetected")}
          </div>
          <ul className="mt-1 flex flex-wrap gap-2">
            {missingScopes.map((s) => (
              <li
                key={s.value}
                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-200"
              >
                {s.value}
                {s.requiresApproval && <ApprovalRequiredBadge t={t} />}
              </li>
            ))}
          </ul>
          {requiresApprovalFromError.length > 0 && (
            <p className="mt-2 text-xs text-red-900 dark:text-red-200">
              {t("integrations.cafe24RestrictedApprovalApiError", {
                scopes: requiresApprovalFromError.join(", "),
              })}
            </p>
          )}
        </section>
      )}

      {cafe24Pending && (
        <section
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
        >
          <div className="font-medium text-amber-900 dark:text-amber-200">
            {t("integrations.cafe24PrivateScopeRequestTitle")}
          </div>
          <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
            {t("integrations.cafe24PrivateScopeRequestDesc")}
          </p>
          {cafe24Pending.scopesAdded.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                {t("integrations.cafe24PrivateScopeRequestScopesAdded")}:
              </span>
              <ul className="mt-1 flex flex-wrap gap-2">
                {cafe24Pending.scopesAdded.map((s) => (
                  <li
                    key={s}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("integrations.requestScopesTitle")}</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("integrations.requestScopesHint")}
        </p>
        <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3">
          {allOptions.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("integrations.noScopeOptionsAvailable")}
            </p>
          ) : (
            allOptions.map((s) => {
              const isGranted = currentScopes.includes(s.value);
              return (
                <label
                  key={s.value}
                  className="flex cursor-pointer items-start gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s.value)}
                    onChange={() => toggle(s.value)}
                    className="mt-0.5"
                    disabled={isGranted}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      <span>{s.label}</span>
                      {s.requiresApproval && <ApprovalRequiredBadge t={t} />}
                      {isGranted && (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {t("integrations.alreadyGranted")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {s.value}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
        <RestrictedScopeNotice
          count={
            allOptions.filter(
              (s) => s.requiresApproval && selected.includes(s.value),
            ).length
          }
          t={t}
        />
        <div className="flex justify-end">
          <Button
            onClick={() => requestMutation.mutate()}
            disabled={selected.length === 0 || requestMutation.isPending}
          >
            {requestMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("integrations.requestScopesBtn")}
          </Button>
        </div>
      </section>
    </div>
  );
}
