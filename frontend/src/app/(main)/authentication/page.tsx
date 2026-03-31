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

const AUTH_TYPES = [
  { value: "api_key", label: "API Key" },
  { value: "bearer_token", label: "Bearer Token" },
  { value: "basic_auth", label: "Basic Auth" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  api_key: "API Key",
  bearer_token: "Bearer Token",
  basic_auth: "Basic Auth",
};

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline"> = {
  completed: "success",
  running: "warning",
  failed: "destructive",
  pending: "outline",
};

export default function AuthenticationPage() {
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
      toast.success("Auth config created");
      setGeneratedKey(data?.key ?? data?.token ?? null);
      if (!data?.key && !data?.token) {
        resetForm();
      }
    },
    onError: () => {
      toast.error("Failed to create auth config");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await apiClient.patch(`/auth-configs/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success("Auth config updated");
    },
    onError: () => {
      toast.error("Failed to update auth config");
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/auth-configs/${id}/regenerate`);
      return res.data.data ?? res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success("Key regenerated");
      if (data?.key || data?.token) {
        setGeneratedKey(data.key ?? data.token);
      }
      setRegenerateTarget(null);
    },
    onError: () => {
      toast.error("Failed to regenerate key");
      setRegenerateTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/auth-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-configs"] });
      toast.success("Auth config deleted");
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error("Failed to delete auth config");
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
      toast.error("Please fill in all required fields");
      return;
    }
    createMutation.mutate();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy"),
    );
  }

  function handleRowClick(configId: string) {
    setSelectedConfigId(configId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Authentication</h1>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Config
        </Button>
      </div>

      {/* Create Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Auth Config</h2>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {generatedKey ? (
              <div className="space-y-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Save this key now. It will not be shown again.
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
                  <Button onClick={resetForm}>Done</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="auth-name">Name</Label>
                  <Input
                    id="auth-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My API Key"
                  />
                </div>
                <div>
                  <Label htmlFor="auth-type">Type</Label>
                  <select
                    id="auth-type"
                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                  >
                    <option value="">Select type</option>
                    {AUTH_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Create
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
            <h2 className="mb-2 text-lg font-semibold">Regenerate Key</h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              This will invalidate the current key. Are you sure?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRegenerateTarget(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={regenerateMutation.isPending}
                onClick={() => regenerateMutation.mutate(regenerateTarget)}
              >
                {regenerateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Regenerate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Delete Auth Config</h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              Are you sure you want to delete this auth config? This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget)}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Delete
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
          Failed to load auth configs.
        </p>
      )}

      {!isLoading && !isError && configs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">No auth configs found.</p>
        </div>
      )}

      {!isLoading && !isError && configs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Last Used</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
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
                      {TYPE_LABELS[config.type] ?? config.type}
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
                      {config.active ? "Active" : "Inactive"}
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
                        {config.active ? "Deactivate" : "Activate"}
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
        title={selectedConfig ? `Usage: ${selectedConfig.name}` : "Usage Details"}
      >
        {isUsageLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        )}

        {isUsageError && (
          <p className="text-sm text-[hsl(var(--destructive))]">
            Failed to load usage data.
          </p>
        )}

        {!isUsageLoading && !isUsageError && usageData && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[hsl(var(--border))] p-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Total Calls
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {usageData.totalCalls.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border))] p-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Last Used
                </p>
                <p className="mt-1 text-sm font-medium">
                  {usageData.lastUsedAt
                    ? new Date(usageData.lastUsedAt).toLocaleString()
                    : "Never"}
                </p>
              </div>
            </div>

            {/* Recent Calls Table */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Recent Calls</h3>
              {usageData.recentCalls.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No recent calls.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
                  <table className="w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Trigger
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Started At
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
