"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { llmConfigsApi, type LlmConfigData } from "@/lib/api/llm-configs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Inbox,
  Trash2,
  X,
  Star,
  Plug,
  Pencil,
} from "lucide-react";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google AI" },
  { value: "azure", label: "Azure OpenAI" },
  { value: "local", label: "Local (Ollama/vLLM)" },
] as const;

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI",
  azure: "Azure OpenAI",
  local: "Local",
};

export default function LlmConfigsPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [formProvider, setFormProvider] = useState("");
  const [formName, setFormName] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formTemperature, setFormTemperature] = useState("0.7");
  const [formMaxTokens, setFormMaxTokens] = useState("4096");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => llmConfigsApi.getAll(),
  });
  const configs: LlmConfigData[] = data?.data ?? data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      llmConfigsApi.create({
        provider: formProvider,
        name: formName,
        apiKey: formApiKey,
        baseUrl: formBaseUrl || undefined,
        defaultModel: formModel,
        defaultParams: {
          temperature: parseFloat(formTemperature) || 0.7,
          max_tokens: parseInt(formMaxTokens) || 4096,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm-configs"] });
      toast.success("LLM provider added");
      resetForm();
    },
    onError: () => toast.error("Failed to add provider"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      llmConfigsApi.update(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm-configs"] });
      toast.success("Provider updated");
      resetForm();
    },
    onError: () => toast.error("Failed to update provider"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => llmConfigsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm-configs"] });
      toast.success("Provider deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete provider"),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => llmConfigsApi.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm-configs"] });
      toast.success("Default provider updated");
    },
    onError: () => toast.error("Failed to set default"),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => llmConfigsApi.testConnection(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Connection successful");
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    },
    onError: () => toast.error("Connection test failed"),
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

  function openEdit(config: LlmConfigData) {
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
      toast.error("Name, provider, and model are required");
      return;
    }
    if (!editId && !formApiKey.trim()) {
      toast.error("API key is required");
      return;
    }

    if (editId) {
      const payload: Record<string, unknown> = {
        provider: formProvider,
        name: formName,
        defaultModel: formModel,
        baseUrl: formBaseUrl || undefined,
        defaultParams: {
          temperature: parseFloat(formTemperature) || 0.7,
          max_tokens: parseInt(formMaxTokens) || 4096,
        },
      };
      if (formApiKey.trim()) payload.apiKey = formApiKey;
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate();
    }
  }

  const needsBaseUrl = ["azure", "local"].includes(formProvider);
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">LLM Config</h1>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editId ? "Edit Provider" : "Add Provider"}
              </h2>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Provider</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value)}
                >
                  <option value="">Select provider</option>
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My OpenAI"
                />
              </div>
              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder={editId ? "Leave empty to keep current" : "sk-..."}
                />
              </div>
              {needsBaseUrl && (
                <div>
                  <Label>Base URL</Label>
                  <Input
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder="https://your-endpoint.com/v1"
                  />
                </div>
              )}
              <div>
                <Label>Default Model</Label>
                <Input
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder="gpt-4o"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Temperature</Label>
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
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formMaxTokens}
                    onChange={(e) => setFormMaxTokens(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editId ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Delete Provider</h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              This will permanently delete this LLM provider configuration.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget)}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
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
          Failed to load LLM configs.
        </p>
      )}
      {!isLoading && !isError && configs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">No LLM providers configured.</p>
        </div>
      )}
      {!isLoading && !isError && configs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Provider</th>
                <th className="px-4 py-3 text-left font-medium">Model</th>
                <th className="px-4 py-3 text-left font-medium">API Key</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
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
                    {config.apiKey}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={testMutation.isPending}
                        onClick={() => testMutation.mutate(config.id)}
                      >
                        <Plug className="mr-1 h-3 w-3" />
                        Test
                      </Button>
                      {!config.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setDefaultMutation.mutate(config.id)}
                        >
                          <Star className="mr-1 h-3 w-3" />
                          Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(config)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[hsl(var(--destructive))]"
                        onClick={() => setDeleteTarget(config.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
