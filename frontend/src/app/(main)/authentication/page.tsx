"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SlideDrawer } from "@/components/ui/slide-drawer";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { Plus, Loader2, Inbox, Trash2, X, RefreshCw, Copy } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";

interface AuthConfig {
  id: string;
  name: string;
  type: "api_key" | "bearer_token" | "basic_auth";
  active: boolean;
  lastUsedAt?: string;
  key?: string;
}

interface UsageRecentCall {
  id: string;
  triggerName: string;
  status: string;
  startedAt: string;
}

interface AuthConfigUsage {
  totalCalls: number;
  lastUsedAt: string | null;
  recentCalls: UsageRecentCall[];
}

const AUTH_TYPES: { value: string; labelKey: TranslationKey }[] = [
  { value: "api_key", labelKey: "authentication.typeApiKey" },
  { value: "bearer_token", labelKey: "authentication.typeBearerToken" },
  { value: "basic_auth", labelKey: "authentication.typeBasicAuth" },
];

const TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  api_key: "authentication.typeApiKey",
  bearer_token: "authentication.typeBearerToken",
  basic_auth: "authentication.typeBasicAuth",
};

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline"> = {
  completed: "success",
  running: "warning",
  failed: "destructive",
  pending: "outline",
};

export default function AuthenticationPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<string | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

  const { data: configs = [], isLoading, isError } = useQuery<AuthConfig[]>({
    queryKey: ["auth-configs"],
    queryFn: async () => {
      const res = await apiClient.get("/auth-configs");
      return res.data.data ?? res.data;
    },
  });

  const selectedConfig = configs.find((c) => c.id === selectedConfigId) ?? null;

  const {
    data: usageData,
    isLoading: isUsageLoading,
    isError: isUsageError,
  } = useQuery<AuthConfigUsage>({
    queryKey: ["auth-config-usage", selectedConfigId],
    queryFn: async () => {
      const res = await apiClient.get(`/auth-configs/${selectedConfigId}/usage`);
      return res.data.data ?? res.data;
    },
    enabled: !!selectedConfigId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/auth-configs", {
        name: formName,
        type: formType,
      });
      return res.data.data ?? res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success(t("authentication.configCreated"));
      setGeneratedKey(data?.key ?? data?.token ?? null);
      if (!data?.key && !data?.token) {
        resetForm();
      }
    },
    onError: () => {
      toast.error(t("authentication.configCreateFailed"));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await apiClient.patch(`/auth-configs/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success(t("authentication.configUpdated"));
    },
    onError: () => {
      toast.error(t("authentication.configUpdateFailed"));
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/auth-configs/${id}/regenerate`);
      return res.data.data ?? res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success(t("authentication.keyRegenerated"));
      if (data?.key || data?.token) {
        setGeneratedKey(data.key ?? data.token);
      }
      setRegenerateTarget(null);
    },
    onError: () => {
      toast.error(t("authentication.keyRegenerateFailed"));
      setRegenerateTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/auth-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success(t("authentication.configDeleted"));
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error(t("authentication.configDeleteFailed"));
    },
  });

  function resetForm() {
    setFormName("");
    setFormType("");
    setGeneratedKey(null);
    setShowDialog(false);
  }

  function handleCreate() {
    if (!formName.trim() || !formType) {
      toast.error(t("authentication.fillRequired"));
      return;
    }
    createMutation.mutate();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(t("authentication.copiedClipboard")),
      () => toast.error(t("authentication.copyFailed")),
    );
  }

  function handleRowClick(configId: string) {
    setSelectedConfigId(configId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("authentication.title")}</h1>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("authentication.addConfig")}
        </Button>
      </div>

      {/* Create Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("authentication.addConfigDialogTitle")}</h2>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {generatedKey ? (
              <div className="space-y-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t("authentication.saveKeyNotice")}
                </p>
                <div className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] p-3">
                  <code className="flex-1 break-all text-sm">
                    {generatedKey}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(generatedKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button onClick={resetForm}>{t("authentication.done")}</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="auth-name">{t("common.name")}</Label>
                  <Input
                    id="auth-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t("authentication.namePlaceholderConfig")}
                  />
                </div>
                <div>
                  <Label htmlFor="auth-type">{t("common.type")}</Label>
                  <select
                    id="auth-type"
                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                  >
                    <option value="">{t("authentication.selectType")}</option>
                    {AUTH_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t("common.create")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Regenerate Confirmation */}
      {regenerateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">{t("authentication.regenerateTitle")}</h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              {t("authentication.regenerateMessage")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRegenerateTarget(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                disabled={regenerateMutation.isPending}
                onClick={() => regenerateMutation.mutate(regenerateTarget)}
              >
                {regenerateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("authentication.regenerateButton")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">{t("authentication.deleteTitleConfig")}</h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              {t("authentication.deleteMessageConfig")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget)}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
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
          {t("authentication.loadFailed")}
        </p>
      )}

      {!isLoading && !isError && configs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">{t("authentication.noConfigsFound")}</p>
        </div>
      )}

      {!isLoading && !isError && configs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.type")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.status")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("authentication.lastUsed")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {configs.map((config) => (
                <tr
                  key={config.id}
                  className="cursor-pointer transition-colors hover:bg-[hsl(var(--muted)/0.5)]"
                  onClick={() => handleRowClick(config.id)}
                >
                  <td className="px-4 py-3 font-medium">{config.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs font-medium">
                      {TYPE_LABEL_KEYS[config.type] ? t(TYPE_LABEL_KEYS[config.type]) : config.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          config.active ? "bg-green-500" : "bg-gray-400",
                        )}
                      />
                      {config.active ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {config.lastUsedAt
                      ? new Date(config.lastUsedAt).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            id: config.id,
                            active: !config.active,
                          })
                        }
                      >
                        {config.active ? t("workflows.actions.deactivate") : t("workflows.actions.activate")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setRegenerateTarget(config.id)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[hsl(var(--destructive))]"
                        onClick={() => setDeleteTarget(config.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage Detail Drawer */}
      <SlideDrawer
        open={!!selectedConfigId}
        onClose={() => setSelectedConfigId(null)}
        title={selectedConfig ? `${t("authentication.usageTitlePrefix")} ${selectedConfig.name}` : t("authentication.usageTitle")}
      >
        {isUsageLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        )}

        {isUsageError && (
          <p className="text-sm text-[hsl(var(--destructive))]">
            {t("authentication.loadUsageFailed")}
          </p>
        )}

        {!isUsageLoading && !isUsageError && usageData && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[hsl(var(--border))] p-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t("authentication.totalCalls")}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {usageData.totalCalls.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border))] p-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t("authentication.lastUsedLabel")}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {usageData.lastUsedAt
                    ? new Date(usageData.lastUsedAt).toLocaleString()
                    : t("authentication.never")}
                </p>
              </div>
            </div>

            {/* Recent Calls Table */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("authentication.recentCalls")}</h3>
              {usageData.recentCalls.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t("authentication.noRecentCalls")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
                  <table className="w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          {t("authentication.trigger")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t("common.status")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t("authentication.startedAt")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {usageData.recentCalls.map((call) => (
                        <tr key={call.id}>
                          <td className="px-3 py-2 font-medium">
                            {call.triggerName}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                STATUS_BADGE_VARIANT[call.status] ?? "outline"
                              }
                            >
                              {call.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                            {new Date(call.startedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
