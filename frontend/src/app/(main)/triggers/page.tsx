"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { Copy, Loader2, Inbox, Plus, X } from "lucide-react";
import Link from "next/link";
import { TriggerDetailDrawer } from "@/components/triggers/trigger-detail-drawer";

interface Trigger {
  id: string;
  name: string;
  type: "webhook" | "schedule" | "manual";
  isActive: boolean;
  workflowId: string;
  workflowName: string;
  endpointPath?: string;
  lastTriggeredAt?: string;
}

interface Workflow {
  id: string;
  name: string;
}

type AuthType = "none" | "hmac" | "bearer";

const FILTER_TABS = ["all", "webhook", "schedule", "manual"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

const STATUS_FILTERS = ["all", "active", "inactive"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const TYPE_BADGE_STYLES: Record<string, string> = {
  webhook:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  schedule:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  manual:
    "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function TriggersPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const queryClient = useQueryClient();

  // Form state
  const [formName, setFormName] = useState("");
  const [formWorkflowId, setFormWorkflowId] = useState("");
  const [formAuthType, setFormAuthType] = useState<AuthType>("none");
  const [formSecret, setFormSecret] = useState("");
  const [formHmacHeader, setFormHmacHeader] = useState("X-Hub-Signature-256");
  const [formBearerToken, setFormBearerToken] = useState("");

  const { data: triggers = [], isLoading, isError } = useQuery<Trigger[]>({
    queryKey: ["triggers", activeTab, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (activeTab !== "all") params.type = activeTab;
      if (statusFilter === "active") params.status = "active";
      if (statusFilter === "inactive") params.status = "inactive";
      const res = await apiClient.get("/triggers", { params });
      const raw = res.data.data ?? res.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (raw as any[]).map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        isActive: t.isActive,
        workflowId: t.workflowId ?? t.workflow?.id ?? "",
        workflowName: t.workflow?.name ?? "",
        endpointPath: t.endpointPath,
        lastTriggeredAt: t.lastTriggeredAt,
      }));
    },
  });

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ["workflows-list"],
    queryFn: async () => {
      const res = await apiClient.get("/workflows");
      return res.data.data ?? res.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiClient.patch(`/triggers/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      toast.success("Trigger updated");
    },
    onError: () => {
      toast.error("Failed to update trigger");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const config: Record<string, unknown> = { authType: formAuthType };
      if (formAuthType === "hmac") {
        config.secret = formSecret;
        config.hmacHeader = formHmacHeader;
        config.hmacAlgorithm = "sha256";
      }
      if (formAuthType === "bearer") {
        config.bearerToken = formBearerToken;
      }
      await apiClient.post("/triggers", {
        workflowId: formWorkflowId,
        type: "webhook",
        name: formName,
        endpointPath: crypto.randomUUID(),
        config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      toast.success("Webhook trigger created");
      resetForm();
    },
    onError: () => {
      toast.error("Failed to create webhook trigger");
    },
  });

  function resetForm() {
    setFormName("");
    setFormWorkflowId("");
    setFormAuthType("none");
    setFormSecret("");
    setFormHmacHeader("X-Hub-Signature-256");
    setFormBearerToken("");
    setShowDialog(false);
  }

  function handleCreate() {
    if (!formName.trim() || !formWorkflowId) {
      toast.error("Please fill in all required fields");
      return;
    }
    createMutation.mutate();
  }

  function getWebhookUrl(endpointPath: string) {
    const base = typeof window !== "undefined"
      ? window.location.origin.replace(/:\d+$/, ":3011")
      : "";
    return `${base}/api/hooks/${endpointPath}`;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy"),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Triggers</h1>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      {/* Create Webhook Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Webhook Trigger</h2>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="webhook-name">Name</Label>
                <Input
                  id="webhook-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My Webhook"
                />
              </div>
              <div>
                <Label htmlFor="webhook-workflow">Workflow</Label>
                <select
                  id="webhook-workflow"
                  className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  value={formWorkflowId}
                  onChange={(e) => setFormWorkflowId(e.target.value)}
                >
                  <option value="">Select a workflow</option>
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="webhook-auth">Authentication</Label>
                <select
                  id="webhook-auth"
                  className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  value={formAuthType}
                  onChange={(e) => setFormAuthType(e.target.value as AuthType)}
                >
                  <option value="none">None (Public)</option>
                  <option value="hmac">HMAC Signature</option>
                  <option value="bearer">Bearer Token</option>
                </select>
              </div>
              {formAuthType === "hmac" && (
                <>
                  <div>
                    <Label htmlFor="webhook-secret">Secret Key</Label>
                    <Input
                      id="webhook-secret"
                      type="password"
                      value={formSecret}
                      onChange={(e) => setFormSecret(e.target.value)}
                      placeholder="your-secret-key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="webhook-hmac-header">Signature Header</Label>
                    <Input
                      id="webhook-hmac-header"
                      value={formHmacHeader}
                      onChange={(e) => setFormHmacHeader(e.target.value)}
                      placeholder="X-Hub-Signature-256"
                    />
                  </div>
                </>
              )}
              {formAuthType === "bearer" && (
                <div>
                  <Label htmlFor="webhook-token">Bearer Token</Label>
                  <Input
                    id="webhook-token"
                    type="password"
                    value={formBearerToken}
                    onChange={(e) => setFormBearerToken(e.target.value)}
                    placeholder="your-bearer-token"
                  />
                </div>
              )}
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
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          {FILTER_TABS.map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === "all"
                ? "All Status"
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          Failed to load triggers.
        </p>
      )}

      {!isLoading && !isError && triggers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">No triggers found.</p>
        </div>
      )}

      {!isLoading && !isError && triggers.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Workflow</th>
                <th className="px-4 py-3 text-left font-medium">Endpoint</th>
                <th className="px-4 py-3 text-left font-medium">Last Triggered</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {triggers.map((trigger) => (
                <tr
                  key={trigger.id}
                  className="cursor-pointer hover:bg-[hsl(var(--muted))/0.5]"
                  onClick={() => setSelectedTriggerId(trigger.id)}
                >
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block h-2.5 w-2.5 rounded-full",
                        trigger.isActive ? "bg-green-500" : "bg-gray-400",
                      )}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{trigger.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                        TYPE_BADGE_STYLES[trigger.type],
                      )}
                    >
                      {trigger.type.charAt(0).toUpperCase() + trigger.type.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/workflows/${trigger.workflowId}`}
                      className="text-[hsl(var(--primary))] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {trigger.workflowName || "-"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {trigger.type === "webhook" && trigger.endpointPath ? (
                      <span className="inline-flex items-center gap-1">
                        <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs max-w-[200px] truncate">
                          {getWebhookUrl(trigger.endpointPath)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(getWebhookUrl(trigger.endpointPath!));
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {trigger.lastTriggeredAt
                      ? new Date(trigger.lastTriggeredAt).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={toggleMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMutation.mutate({
                          id: trigger.id,
                          isActive: !trigger.isActive,
                        });
                      }}
                    >
                      {trigger.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TriggerDetailDrawer
        triggerId={selectedTriggerId}
        open={selectedTriggerId !== null}
        onClose={() => setSelectedTriggerId(null)}
      />
    </div>
  );
}
