"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rerankConfigsApi,
  type RerankConfigData,
  type RerankProvider,
} from "@/lib/api/rerank-configs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { RoleGate } from "@/components/auth/role-gate";
import { usePageParam } from "@/lib/hooks/use-page-param";
import { normalizePagedResponse } from "@/lib/api/paginated";
import { toast } from "sonner";
import { Plus, Loader2, Inbox, Trash2, X, Star, Pencil } from "lucide-react";
import { useT } from "@/lib/i18n";

const PAGE_SIZE = 20;

const PROVIDERS = [
  { value: "tei", label: "TEI (self-hosted)" },
  { value: "cohere", label: "Cohere" },
] as const;

const PROVIDER_LABELS: Record<string, string> = {
  tei: "TEI",
  cohere: "Cohere",
};

export default function RerankConfigsPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [formProvider, setFormProvider] = useState("");
  const [formName, setFormName] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formModel, setFormModel] = useState("");

  const { page, setPage } = usePageParam();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["rerank-configs", page],
    queryFn: async () => {
      const body = await rerankConfigsApi.getAll({ page, limit: PAGE_SIZE });
      return normalizePagedResponse<RerankConfigData>(body, page);
    },
    placeholderData: (prev) => prev,
  });
  const configs: RerankConfigData[] = data?.items ?? [];
  const totalPages: number = data?.totalPages ?? 1;

  const createMutation = useMutation({
    mutationFn: () =>
      rerankConfigsApi.create({
        provider: formProvider as RerankProvider,
        name: formName,
        apiKey: formApiKey || undefined,
        baseUrl: formBaseUrl || undefined,
        defaultModel: formModel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rerank-configs"] });
      toast.success(t("rerankConfigs.providerAdded"));
      resetForm();
    },
    onError: () => toast.error(t("rerankConfigs.providerAddFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      rerankConfigsApi.update(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rerank-configs"] });
      toast.success(t("rerankConfigs.providerUpdated"));
      resetForm();
    },
    onError: () => toast.error(t("rerankConfigs.providerUpdateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rerankConfigsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rerank-configs"] });
      toast.success(t("rerankConfigs.providerDeleted"));
      setDeleteTarget(null);
      if (configs.length === 1 && page > 1) {
        setPage(page - 1);
      }
    },
    onError: () => toast.error(t("rerankConfigs.providerDeleteFailed")),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => rerankConfigsApi.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rerank-configs"] });
      toast.success(t("rerankConfigs.providerDefaultUpdated"));
    },
    onError: () => toast.error(t("rerankConfigs.setDefaultFailed")),
  });

  function resetForm() {
    setShowDialog(false);
    setEditId(null);
    setFormProvider("");
    setFormName("");
    setFormApiKey("");
    setFormBaseUrl("");
    setFormModel("");
  }

  function openEdit(config: RerankConfigData) {
    setEditId(config.id);
    setFormProvider(config.provider);
    setFormName(config.name);
    setFormApiKey("");
    setFormBaseUrl(config.baseUrl || "");
    setFormModel(config.defaultModel);
    setShowDialog(true);
  }

  function handleSave() {
    if (!formName.trim() || !formProvider || !formModel.trim()) {
      toast.error(t("rerankConfigs.requiredFields"));
      return;
    }
    // cohere 는 API 키 필수(신규 생성 시). tei 는 베이스 URL 필수.
    if (formProvider === "cohere" && !editId && !formApiKey.trim()) {
      toast.error(t("rerankConfigs.apiKeyRequired"));
      return;
    }
    if (formProvider === "tei" && !formBaseUrl.trim()) {
      toast.error(t("rerankConfigs.baseUrlRequired"));
      return;
    }

    if (editId) {
      const payload: Record<string, unknown> = {
        provider: formProvider,
        name: formName,
        defaultModel: formModel,
        baseUrl: formBaseUrl || undefined,
      };
      if (formApiKey.trim()) payload.apiKey = formApiKey;
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate();
    }
  }

  const needsBaseUrl = formProvider === "tei";
  const needsApiKey = formProvider === "cohere";
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("rerankConfigs.title")}</h1>
        <RoleGate minRole="editor">
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("rerankConfigs.addProvider")}
          </Button>
        </RoleGate>
      </div>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editId
                  ? t("rerankConfigs.editProvider")
                  : t("rerankConfigs.addProvider")}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetForm}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>{t("rerankConfigs.provider")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value)}
                >
                  <option value="">{t("rerankConfigs.selectProvider")}</option>
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("common.name")}</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("rerankConfigs.namePlaceholder")}
                />
              </div>
              {needsApiKey && (
                <div>
                  <Label>{t("rerankConfigs.apiKey")}</Label>
                  <Input
                    type="password"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder={
                      editId
                        ? t("rerankConfigs.apiKeyPlaceholderEdit")
                        : t("rerankConfigs.apiKeyPlaceholderNew")
                    }
                  />
                </div>
              )}
              {needsBaseUrl && (
                <div>
                  <Label>{t("rerankConfigs.baseUrl")}</Label>
                  <Input
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder={t("rerankConfigs.baseUrlPlaceholderPlain")}
                  />
                </div>
              )}
              <div>
                <Label>{t("rerankConfigs.defaultModel")}</Label>
                <Input
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder={t("rerankConfigs.modelPlaceholder")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editId
                    ? t("rerankConfigs.updateBtn")
                    : t("common.create")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">
              {t("rerankConfigs.deleteTitle")}
            </h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              {t("rerankConfigs.deleteMessage")}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget)}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}
      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          {t("rerankConfigs.loadFailed")}
        </p>
      )}
      {!isLoading && !isError && configs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">{t("rerankConfigs.noConfigs")}</p>
        </div>
      )}
      {!isLoading && !isError && configs.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted))]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("rerankConfigs.columnName")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("rerankConfigs.columnProvider")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("rerankConfigs.columnModel")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("rerankConfigs.columnApiKey")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("rerankConfigs.columnActions")}
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
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
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
                      {config.apiKey ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
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
                              {t("rerankConfigs.defaultBtn")}
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
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
