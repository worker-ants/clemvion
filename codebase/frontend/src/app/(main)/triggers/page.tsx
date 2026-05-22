"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import { Copy, Loader2, Inbox, Plus, X, MoreVertical } from "lucide-react";
import Link from "next/link";
import { TriggerDetailDrawer } from "@/components/triggers/trigger-detail-drawer";
import {
  TriggerDeleteDialog,
  type TriggerDeleteTarget,
} from "@/components/triggers/trigger-delete-dialog";
import { Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { normalizePagedResponse } from "@/lib/api/paginated";
import { usePageParam } from "@/lib/hooks/use-page-param";
import { useT, type TranslationKey } from "@/lib/i18n";
import { RoleGate, useHasRole } from "@/components/auth/role-gate";

const PAGE_SIZE = 20;

interface Trigger {
  id: string;
  name: string;
  type: "webhook" | "schedule" | "manual";
  isActive: boolean;
  workflowId: string;
  workflowName: string;
  endpointPath?: string;
  lastTriggeredAt?: string;
  cronExpression?: string;
  nextRunAt?: string;
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

const FILTER_TAB_LABELS: Record<FilterTab, TranslationKey> = {
  all: "triggers.tabAll",
  webhook: "triggers.tabWebhook",
  schedule: "triggers.tabSchedule",
  manual: "triggers.tabManual",
};

const STATUS_FILTER_LABELS: Record<StatusFilter, TranslationKey> = {
  all: "triggers.statusAll",
  active: "triggers.statusActive",
  inactive: "triggers.statusInactive",
};

export default function TriggersPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TriggerDeleteTarget | null>(
    null,
  );
  const canEdit = useHasRole("editor");
  const queryClient = useQueryClient();

  // Form state
  const [formName, setFormName] = useState("");
  const [formWorkflowId, setFormWorkflowId] = useState("");
  const [formAuthType, setFormAuthType] = useState<AuthType>("none");
  const [formSecret, setFormSecret] = useState("");
  const [formHmacHeader, setFormHmacHeader] = useState("X-Hub-Signature-256");
  const [formBearerToken, setFormBearerToken] = useState("");

  const { page, setPage } = usePageParam();
  // Raw row shape from /triggers — only the fields we map
  interface RawTrigger {
    id: string;
    name: string;
    type: "webhook" | "schedule" | "manual";
    isActive: boolean;
    workflowId?: string;
    workflow?: { id?: string; name?: string };
    endpointPath?: string;
    lastTriggeredAt?: string;
    cronExpression?: string;
    nextRunAt?: string;
  }
  const triggersQuery = useQuery<{ items: Trigger[]; totalPages: number }>({
    queryKey: ["triggers", activeTab, statusFilter, page],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit: PAGE_SIZE,
      };
      if (activeTab !== "all") params.type = activeTab;
      if (statusFilter === "active") params.status = "active";
      if (statusFilter === "inactive") params.status = "inactive";
      const res = await apiClient.get("/triggers", { params });
      const { items: raw, totalPages } = normalizePagedResponse<RawTrigger>(
        res.data,
        page,
      );
      const items: Trigger[] = raw.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        isActive: t.isActive,
        workflowId: t.workflowId ?? t.workflow?.id ?? "",
        workflowName: t.workflow?.name ?? "",
        endpointPath: t.endpointPath,
        lastTriggeredAt: t.lastTriggeredAt,
        cronExpression: t.cronExpression,
        nextRunAt: t.nextRunAt,
      }));
      return { items, totalPages };
    },
    placeholderData: (prev) => prev,
  });
  const triggers: Trigger[] = triggersQuery.data?.items ?? [];
  const totalPages: number = triggersQuery.data?.totalPages ?? 1;
  const isLoading = triggersQuery.isLoading;
  const isError = triggersQuery.isError;

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
      toast.success(t("triggers.updated"));
    },
    onError: () => {
      toast.error(t("triggers.updateFailed"));
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
      toast.success(t("triggers.webhookCreated"));
      resetForm();
    },
    onError: () => {
      toast.error(t("triggers.webhookCreateFailed"));
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
      toast.error(t("triggers.fillRequired"));
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
      () => toast.success(t("triggers.copied")),
      () => toast.error(t("triggers.copyFailed")),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("triggers.title")}</h1>
        <RoleGate minRole="editor">
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("triggers.addWebhook")}
          </Button>
        </RoleGate>
      </div>

      {/* Create Webhook Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("triggers.addWebhookTrigger")}</h2>
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
                <Label htmlFor="webhook-name">{t("triggers.nameLabel")}</Label>
                <Input
                  id="webhook-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("triggers.namePlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="webhook-workflow">{t("triggers.workflowLabel")}</Label>
                <select
                  id="webhook-workflow"
                  className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  value={formWorkflowId}
                  onChange={(e) => setFormWorkflowId(e.target.value)}
                >
                  <option value="">{t("triggers.selectWorkflow")}</option>
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="webhook-auth">{t("triggers.authenticationLabel")}</Label>
                <select
                  id="webhook-auth"
                  className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  value={formAuthType}
                  onChange={(e) => setFormAuthType(e.target.value as AuthType)}
                >
                  <option value="none">{t("triggers.authNone")}</option>
                  <option value="hmac">{t("triggers.authHmac")}</option>
                  <option value="bearer">{t("triggers.authBearer")}</option>
                </select>
              </div>
              {formAuthType === "hmac" && (
                <>
                  <div>
                    <Label htmlFor="webhook-secret">{t("triggers.secretKey")}</Label>
                    <Input
                      id="webhook-secret"
                      type="password"
                      value={formSecret}
                      onChange={(e) => setFormSecret(e.target.value)}
                      placeholder={t("triggers.secretPlaceholder")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="webhook-hmac-header">{t("triggers.signatureHeader")}</Label>
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
                  <Label htmlFor="webhook-token">{t("triggers.bearerToken")}</Label>
                  <Input
                    id="webhook-token"
                    type="password"
                    value={formBearerToken}
                    onChange={(e) => setFormBearerToken(e.target.value)}
                    placeholder={t("triggers.bearerPlaceholder")}
                  />
                </div>
              )}
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
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
            >
              {t(FILTER_TAB_LABELS[tab])}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
            >
              {t(STATUS_FILTER_LABELS[status])}
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
          {t("triggers.loadFailed")}
        </p>
      )}

      {!isLoading && !isError && triggers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">{t("triggers.noTriggersFound")}</p>
        </div>
      )}

      {!isLoading && !isError && triggers.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("triggers.columnStatus")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("triggers.nameLabel")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("triggers.type")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("triggers.workflow")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("triggers.endpoint")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("triggers.lastTriggered")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("triggers.columnActions")}</th>
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
                      {trigger.type === "webhook"
                        ? t("triggers.typeWebhook")
                        : trigger.type === "schedule"
                          ? t("triggers.typeSchedule")
                          : t("triggers.typeManual")}
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
                      ? formatDate(trigger.lastTriggeredAt, "datetime")
                      : "-"}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("triggers.rowActions.menuLabel")}
                          className="h-8 w-8"
                        >
                          <MoreVertical
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setSelectedTriggerId(trigger.id)}
                        >
                          {t("triggers.rowActions.viewDetails")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setSelectedTriggerId(trigger.id)}
                        >
                          {t("triggers.rowActions.viewHistory")}
                        </DropdownMenuItem>
                        {canEdit && trigger.type === "schedule" && (
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/schedules?triggerId=${trigger.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {t("triggers.rowActions.editInSchedule")}
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {canEdit && (
                          <>
                            <DropdownMenuItem
                              disabled={toggleMutation.isPending}
                              onSelect={() =>
                                toggleMutation.mutate({
                                  id: trigger.id,
                                  isActive: !trigger.isActive,
                                })
                              }
                            >
                              {trigger.isActive
                                ? t("triggers.toggleDeactivate")
                                : t("triggers.toggleActivate")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() =>
                                setDeleteTarget({
                                  id: trigger.id,
                                  name: trigger.name,
                                  type: trigger.type,
                                  workflowName: trigger.workflowName,
                                  webhookUrl:
                                    trigger.type === "webhook" &&
                                    trigger.endpointPath
                                      ? getWebhookUrl(trigger.endpointPath)
                                      : undefined,
                                  cronExpression: trigger.cronExpression,
                                  nextRunAt: trigger.nextRunAt,
                                })
                              }
                            >
                              {t("triggers.rowActions.delete")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      <TriggerDetailDrawer
        triggerId={selectedTriggerId}
        open={selectedTriggerId !== null}
        onClose={() => setSelectedTriggerId(null)}
      />

      <TriggerDeleteDialog
        trigger={deleteTarget}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
