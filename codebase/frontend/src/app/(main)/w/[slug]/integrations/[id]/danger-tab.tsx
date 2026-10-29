"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  integrationsApi,
  type IntegrationDto,
  type IntegrationScope,
  type UsageWorkflow,
} from "@/lib/api/integrations";
import { type TFunction } from "@/lib/i18n";
import { useWorkspaceSlug } from "@/lib/workspace/use-workspace-slug";
import { buildWorkspaceHref } from "@/lib/workspace/href";
import { useIntegrationPermissions } from "../_shared/integration-permissions";
import { DeleteBlockedDialog } from "./delete-blocked-dialog";
import { ScopeToPersonalWarningDialog } from "./scope-to-personal-warning-dialog";

// ---------------- Danger zone ----------------

export function DangerTab({
  integration,
  onScopeChanged,
  t,
}: {
  integration: IntegrationDto;
  onScopeChanged: () => void;
  t: TFunction;
}) {
  const router = useRouter();
  const slug = useWorkspaceSlug();
  const queryClient = useQueryClient();
  // 공개 범위 전환과 삭제는 할 수 있는 사람에게만 보인다(CLE-INT-MANAGE 「권한」).
  const permissions = useIntegrationPermissions(integration);
  const [confirming, setConfirming] = useState(false);
  const [nextScope, setNextScope] = useState<IntegrationScope>(integration.scope);
  const [blockedUsages, setBlockedUsages] = useState<UsageWorkflow[] | null>(
    null,
  );
  const [authorMismatchUsages, setAuthorMismatchUsages] = useState<
    UsageWorkflow[] | null
  >(null);

  const scopeMutation = useMutation({
    mutationFn: () => integrationsApi.updateScope(integration.id, nextScope),
    onSuccess: () => {
      toast.success(t("integrations.scopeUpdated"));
      onScopeChanged();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? t("integrations.scopeUpdateFailedDefault"));
    },
  });

  // 조직 → 개인 전환 (REQ-INTMGMT-057): 전환 전에 사용처를 보고, 통합 소유자가 아닌 사람이 작성한 워크플로우가 있으면
  // 그 목록과 함께 확인받는다. 없으면 확인만 받는다. 사용처를 확인하지 못하면 바꾸지 않는다.
  const toPersonalPrecheckMutation = useMutation({
    mutationFn: () => integrationsApi.usages(integration.id),
    onSuccess: (usages) => {
      const affected = usages.filter((w) => !w.authorIsIntegrationOwner);
      if (affected.length > 0) {
        setAuthorMismatchUsages(affected);
      } else if (window.confirm(t("integrations.scopeToPersonalConfirm"))) {
        scopeMutation.mutate();
      }
    },
    onError: () => toast.error(t("integrations.scopeUsagesFailed")),
  });

  // 삭제 흐름 (§4.7):
  //  1) "통합 삭제" 버튼 클릭 → GET /usages 사전 조회.
  //  2) 사용처 ≥ 1건 → 삭제하지 않고 차단 다이얼로그 노출 (§7.2).
  //  3) 사용처 0건 → 인라인 확인 버튼 노출 → 확인 시 DELETE.
  const precheckMutation = useMutation({
    mutationFn: () => integrationsApi.usages(integration.id),
    onSuccess: (usages) => {
      if (usages.length > 0) {
        setBlockedUsages(usages);
      } else {
        setConfirming(true);
      }
    },
    onError: () => toast.error(t("integrations.deleteFailed")),
  });

  // 확인 후 실제 DELETE. 사전 조회와 DELETE 사이 race 로 409
  // INTEGRATION_IN_USE 가 오면 응답 body 의 usages 로 동일 차단 다이얼로그를
  // 띄운다 (body 없으면 기존 toast fallback).
  const deleteMutation = useMutation({
    mutationFn: () => integrationsApi.remove(integration.id),
    onSuccess: () => {
      toast.success(t("integrations.deleted"));
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
      router.push(buildWorkspaceHref(slug, "/integrations"));
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: {
          status?: number;
          data?: { code?: string; usages?: UsageWorkflow[] };
        };
      };
      if (e.response?.status === 409) {
        const usages = e.response.data?.usages;
        setConfirming(false);
        if (usages && usages.length > 0) {
          setBlockedUsages(usages);
        } else {
          toast.error(t("integrations.inUseError"));
        }
      } else {
        toast.error(t("integrations.deleteFailed"));
      }
    },
  });

  return (
    <div className="space-y-6">
      {permissions.changeScope && (
        <section className="rounded-lg border border-[hsl(var(--border))] p-6">
          <h3 className="text-sm font-semibold">{t("integrations.scopeChangeTitle")}</h3>
          <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
            {t("integrations.scopeChangeHint")}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={nextScope}
              onChange={(e) => setNextScope(e.target.value as IntegrationScope)}
              className="flex h-10 rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
            >
              <option value="personal">{t("integrations.scopePersonal")}</option>
              <option value="organization">{t("integrations.scopeOrganization")}</option>
            </select>
            <Button
              variant="outline"
              onClick={() => {
                if (nextScope === integration.scope) return;
                if (nextScope === "personal") {
                  toPersonalPrecheckMutation.mutate();
                } else if (window.confirm(t("integrations.scopeChangeConfirm"))) {
                  scopeMutation.mutate();
                }
              }}
              disabled={
                nextScope === integration.scope ||
                scopeMutation.isPending ||
                toPersonalPrecheckMutation.isPending
              }
            >
              {scopeMutation.isPending || toPersonalPrecheckMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("integrations.scopeApply")}
            </Button>
          </div>
        </section>
      )}

      {permissions.delete && (
        <section className="rounded-lg border border-red-300 p-6 dark:border-red-900">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">
            {t("integrations.dangerDeleteTitle")}
          </h3>
          <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
            {t("integrations.dangerDeleteHint")}
          </p>
          {!confirming ? (
            <Button
              variant="outline"
              className="text-red-600"
              onClick={() => precheckMutation.mutate()}
              disabled={precheckMutation.isPending}
            >
              {precheckMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t("integrations.dangerDeleteBtn")}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("integrations.confirmDeleteBtn")}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t("integrations.cancelBtn")}
              </Button>
            </div>
          )}
        </section>
      )}

      <DeleteBlockedDialog
        open={blockedUsages !== null}
        onOpenChange={(open) => {
          if (!open) setBlockedUsages(null);
        }}
        integrationName={integration.name}
        usages={blockedUsages ?? []}
        t={t}
      />

      <ScopeToPersonalWarningDialog
        open={authorMismatchUsages !== null}
        onOpenChange={(open) => {
          if (!open) setAuthorMismatchUsages(null);
        }}
        usages={authorMismatchUsages ?? []}
        onConfirm={() => {
          setAuthorMismatchUsages(null);
          scopeMutation.mutate();
        }}
        t={t}
      />
    </div>
  );
}
