"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  modelConfigsApi,
  type ModelConfigData,
  type ModelConfigKind,
} from "@/lib/api/model-configs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { RoleGate } from "@/components/auth/role-gate";
import { usePageParam } from "@/lib/hooks/use-page-param";
import { normalizePagedResponse } from "@/lib/api/paginated";
import { toast } from "sonner";
import { Plus, Loader2, Inbox, Trash2, Star, Plug, Pencil } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ModelConfigFormDialog } from "./model-config-form-dialog";
import { ModelConfigDeleteDialog } from "./model-config-delete-dialog";

const PAGE_SIZE = 20;

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI",
  azure: "Azure OpenAI",
  local: "Local",
  tei: "TEI",
  cohere: "Cohere",
};

/**
 * kind(chat/embedding/rerank) 별 ModelConfig CRUD 매니저. /models 페이지의 각 탭이
 * 동일 컴포넌트를 kind 만 달리해 렌더한다. chat/embedding 은 모델 select + 연결 테스트,
 * chat 은 추가로 파라미터(temperature/maxTokens), rerank 는 자유 입력 모델·테스트 미제공.
 * 생성/편집 폼은 ModelConfigFormDialog, 삭제 확인은 ModelConfigDeleteDialog 가 담당한다.
 */
export function ModelConfigManager({ kind }: { kind: ModelConfigKind }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<ModelConfigData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // rerank 는 연결 테스트 미제공.
  const showTest = kind !== "rerank";

  const { page, setPage } = usePageParam();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["model-configs", kind, page],
    queryFn: async () => {
      const body = await modelConfigsApi.getAll(kind, { page, limit: PAGE_SIZE });
      return normalizePagedResponse<ModelConfigData>(body, page);
    },
    placeholderData: (prev) => prev,
  });
  const configs: ModelConfigData[] = data?.items ?? [];
  const totalPages: number = data?.totalPages ?? 1;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["model-configs", kind] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => modelConfigsApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("models.providerDeleted"));
      setDeleteTarget(null);
      if (configs.length === 1 && page > 1) setPage(page - 1);
    },
    onError: () => toast.error(t("models.providerDeleteFailed")),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => modelConfigsApi.setDefault(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("models.providerDefaultUpdated"));
    },
    onError: () => toast.error(t("models.setDefaultFailed")),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => modelConfigsApi.testConnection(id),
    onSuccess: (result) => {
      if (result.success) toast.success(t("models.connectionSucceeded"));
      else
        toast.error(
          t("models.connectionFailed", { error: result.message ?? "" }),
        );
    },
    onError: () => toast.error(t("models.testFailedShort")),
  });

  function openCreate() {
    setEditConfig(null);
    setDialogOpen(true);
  }

  function openEdit(config: ModelConfigData) {
    setEditConfig(config);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <RoleGate minRole="editor">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("models.addModel")}
          </Button>
        </RoleGate>
      </div>

      <ModelConfigFormDialog
        kind={kind}
        editConfig={editConfig}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <ModelConfigDeleteDialog
        open={deleteTarget !== null}
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}
      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          {t("models.loadFailed")}
        </p>
      )}
      {!isLoading && !isError && configs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">{t("models.noConfigs")}</p>
        </div>
      )}
      {!isLoading && !isError && configs.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted))]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("models.columnName")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("models.columnProvider")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("models.columnModel")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("models.columnApiKey")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("models.columnActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {configs.map((config) => (
                  <tr
                    key={config.id}
                    className="transition-colors hover:bg-[hsl(var(--muted)/0.5)]"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {config.isDefault && (
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        )}
                        {config.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {PROVIDER_LABELS[config.provider] ?? config.provider}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {config.defaultModel}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                      {config.apiKey ? "••••••••" : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {showTest && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={testMutation.isPending}
                            onClick={() => testMutation.mutate(config.id)}
                          >
                            <Plug className="mr-1 h-3 w-3" />
                            {t("models.testBtn")}
                          </Button>
                        )}
                        <RoleGate minRole="editor">
                          {!config.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                setDefaultMutation.mutate(config.id)
                              }
                            >
                              <Star className="mr-1 h-3 w-3" />
                              {t("models.defaultBtn")}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(config)}
                            aria-label={t("common.edit")}
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[hsl(var(--destructive))]"
                            onClick={() => setDeleteTarget(config.id)}
                            aria-label={t("common.delete")}
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </RoleGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
