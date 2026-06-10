"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  modelConfigsApi,
  type ModelConfigData,
  type ModelConfigKind,
} from "@/lib/api/model-configs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ModelCombobox } from "@/components/llm-config/model-combobox";
import { Pagination } from "@/components/ui/pagination";
import { RoleGate } from "@/components/auth/role-gate";
import { usePageParam } from "@/lib/hooks/use-page-param";
import { normalizePagedResponse } from "@/lib/api/paginated";
import { toast } from "sonner";
import { Plus, Loader2, Inbox, Trash2, X, Star, Plug, Pencil } from "lucide-react";
import { useT } from "@/lib/i18n";

const PAGE_SIZE = 20;

const PROVIDERS_BY_KIND: Record<
  ModelConfigKind,
  { value: string; label: string }[]
> = {
  chat: [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "google", label: "Google AI" },
    { value: "azure", label: "Azure OpenAI" },
    { value: "local", label: "Local (Ollama/vLLM)" },
  ],
  embedding: [
    { value: "openai", label: "OpenAI" },
    { value: "azure", label: "Azure OpenAI" },
    { value: "google", label: "Google AI" },
    { value: "local", label: "Local (Ollama/vLLM/TEI)" },
  ],
  rerank: [
    { value: "tei", label: "TEI (self-hosted)" },
    { value: "cohere", label: "Cohere" },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI",
  azure: "Azure OpenAI",
  local: "Local",
  tei: "TEI",
  cohere: "Cohere",
};

/** baseUrl 입력이 필요한 (kind, provider) — azure/local/tei. */
function needsBaseUrl(provider: string): boolean {
  return ["azure", "local", "tei"].includes(provider);
}

/** apiKey 가 생성 시 필수인가 — 자가호스팅(local/tei)만 선택. */
function apiKeyRequiredOnCreate(provider: string): boolean {
  return provider !== "" && !["local", "tei"].includes(provider);
}

/**
 * kind(chat/embedding/rerank) 별 ModelConfig CRUD 매니저. /models 페이지의 각 탭이
 * 동일 컴포넌트를 kind 만 달리해 렌더한다. chat/embedding 은 모델 select + 연결 테스트,
 * chat 은 추가로 파라미터(temperature/maxTokens), rerank 는 자유 입력 모델·테스트 미제공.
 */
export function ModelConfigManager({ kind }: { kind: ModelConfigKind }) {
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
  const [formTemperature, setFormTemperature] = useState("0.7");
  const [formMaxTokens, setFormMaxTokens] = useState("4096");

  const showParams = kind === "chat";
  const showTest = kind !== "rerank";
  const freeInputModel = kind === "rerank";
  const providers = PROVIDERS_BY_KIND[kind];

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

  const createMutation = useMutation({
    mutationFn: () =>
      modelConfigsApi.create({
        kind,
        provider: formProvider,
        name: formName,
        apiKey: formApiKey || undefined,
        baseUrl: formBaseUrl || undefined,
        defaultModel: formModel,
        defaultParams: showParams
          ? {
              temperature: parseFloat(formTemperature) || 0.7,
              max_tokens: parseInt(formMaxTokens) || 4096,
            }
          : undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t("models.providerAdded"));
      resetForm();
    },
    onError: () => toast.error(t("models.providerAddFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      modelConfigsApi.update(payload.id, payload.data),
    onSuccess: () => {
      invalidate();
      toast.success(t("models.providerUpdated"));
      resetForm();
    },
    onError: () => toast.error(t("models.providerUpdateFailed")),
  });

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
          t("models.connectionFailed", { error: result.error ?? "" }),
        );
    },
    onError: () => toast.error(t("models.testFailedShort")),
  });

  function resetForm() {
    setShowDialog(false);
    setEditId(null);
    setFormProvider("");
    setFormName("");
    setFormApiKey("");
    setFormBaseUrl("");
    setFormModel("");
    setFormTemperature("0.7");
    setFormMaxTokens("4096");
  }

  function openEdit(config: ModelConfigData) {
    setEditId(config.id);
    setFormProvider(config.provider);
    setFormName(config.name);
    setFormApiKey("");
    setFormBaseUrl(config.baseUrl || "");
    setFormModel(config.defaultModel);
    setFormTemperature(
      String((config.defaultParams?.temperature as number) ?? 0.7),
    );
    setFormMaxTokens(
      String((config.defaultParams?.max_tokens as number) ?? 4096),
    );
    setShowDialog(true);
  }

  function handleSave() {
    if (!formName.trim() || !formProvider || !formModel.trim()) {
      toast.error(t("models.requiredFields"));
      return;
    }
    if (!editId && apiKeyRequiredOnCreate(formProvider) && !formApiKey.trim()) {
      toast.error(t("models.apiKeyRequired"));
      return;
    }
    if (needsBaseUrl(formProvider) && !formBaseUrl.trim()) {
      toast.error(t("models.baseUrlRequired"));
      return;
    }

    if (editId) {
      const payload: Record<string, unknown> = {
        provider: formProvider,
        name: formName,
        defaultModel: formModel,
        baseUrl: formBaseUrl || undefined,
      };
      if (showParams) {
        payload.defaultParams = {
          temperature: parseFloat(formTemperature) || 0.7,
          max_tokens: parseInt(formMaxTokens) || 4096,
        };
      }
      if (formApiKey.trim()) payload.apiKey = formApiKey;
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate();
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <RoleGate minRole="editor">
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("models.addModel")}
          </Button>
        </RoleGate>
      </div>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editId ? t("models.editModel") : t("models.addModel")}
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
                <Label>{t("models.provider")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value)}
                >
                  <option value="">{t("models.selectProvider")}</option>
                  {providers.map((p) => (
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
                  placeholder={t("models.namePlaceholder")}
                />
              </div>
              <div>
                <Label>{t("models.apiKey")}</Label>
                <Input
                  type="password"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder={
                    editId
                      ? t("models.apiKeyPlaceholderEdit")
                      : t("models.apiKeyPlaceholderNew")
                  }
                />
              </div>
              {needsBaseUrl(formProvider) && (
                <div>
                  <Label>{t("models.baseUrl")}</Label>
                  <Input
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder={t("models.baseUrlPlaceholder")}
                  />
                </div>
              )}
              <div>
                <Label>{t("models.defaultModel")}</Label>
                {freeInputModel ? (
                  <Input
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder={t("models.rerankModelPlaceholder")}
                  />
                ) : (
                  <ModelCombobox
                    value={formModel}
                    onChange={setFormModel}
                    provider={formProvider}
                    apiKey={formApiKey}
                    baseUrl={formBaseUrl}
                    configId={editId ?? undefined}
                    api={modelConfigsApi}
                    modelType={kind === "embedding" ? "embedding" : "chat"}
                    placeholder={t("models.modelPlaceholder")}
                  />
                )}
              </div>
              {showParams && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("models.temperature")}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={formTemperature}
                      onChange={(e) => setFormTemperature(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t("models.maxTokens")}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formMaxTokens}
                      onChange={(e) => setFormMaxTokens(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editId ? t("models.updateBtn") : t("common.create")}
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
              {t("models.deleteTitle")}
            </h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              {t("models.deleteMessage")}
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
                      {config.apiKey ?? "—"}
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
