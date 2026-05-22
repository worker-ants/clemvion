import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { SlideDrawer } from "@/components/ui/slide-drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import { useT } from "@/lib/i18n";
import { useHasRole } from "@/components/auth/role-gate";
import {
  Loader2,
  Copy,
  ChevronDown,
  ChevronRight,
  Pencil,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface TriggerDetail {
  id: string;
  name: string;
  type: "webhook" | "schedule" | "manual";
  isActive: boolean;
  workflowId: string;
  workflowName: string;
  endpointPath?: string;
  config?: {
    authType?: "none" | "hmac" | "bearer";
    hmacHeader?: string;
    hmacAlgorithm?: string;
    /** Spec EIA §4 — notification webhook 설정 (외부 인터랙션 채널 메타). */
    notification?: {
      url?: string;
      events?: string[];
      signing?: { algorithm?: string };
      retry?: { maxAttempts?: number };
    };
    /** Spec EIA §4 — inbound interaction (REST + SSE) 설정. */
    interaction?: {
      enabled?: boolean;
      tokenStrategy?: "per_execution" | "per_trigger";
    };
    [key: string]: unknown;
  };
  /** Spec EIA §7.1 — outbound notification 발송 건강도. */
  notificationHealth?: "unknown" | "healthy" | "degraded";
  cronExpression?: string;
  timezone?: string;
  nextRunAt?: string;
}

interface TriggerHistoryEntry {
  id: string;
  startedAt: string;
  status: string;
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  webhook: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  schedule: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  manual: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

interface TriggerDetailDrawerProps {
  triggerId: string | null;
  open: boolean;
  onClose: () => void;
}

export function TriggerDetailDrawer({ triggerId, open, onClose }: TriggerDetailDrawerProps) {
  const queryClient = useQueryClient();
  const { data: trigger, isLoading: isLoadingTrigger } = useQuery<TriggerDetail>({
    queryKey: ["trigger-detail", triggerId],
    queryFn: async () => {
      const res = await apiClient.get(`/triggers/${triggerId}`);
      const raw = res.data.data ?? res.data;
      return {
        ...raw,
        workflowName: raw.workflow?.name ?? raw.workflowName ?? "",
        workflowId: raw.workflowId ?? raw.workflow?.id ?? "",
      } as TriggerDetail;
    },
    enabled: !!triggerId && open,
  });

  function invalidateAfterSave() {
    queryClient.invalidateQueries({ queryKey: ["trigger-detail", triggerId] });
    queryClient.invalidateQueries({ queryKey: ["triggers"] });
  }

  const { data: history = [], isLoading: isLoadingHistory } = useQuery<TriggerHistoryEntry[]>({
    queryKey: ["trigger-history", triggerId],
    queryFn: async () => {
      const res = await apiClient.get(`/triggers/${triggerId}/history`, {
        params: { limit: "10" },
      });
      const responseData = res.data.data ?? res.data;
      return Array.isArray(responseData) ? responseData : responseData.items ?? [];
    },
    enabled: !!triggerId && open,
  });

  return (
    <SlideDrawer open={open} onClose={onClose} title="Trigger Details">
      {isLoadingTrigger ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : trigger ? (
        <div className="space-y-6">
          {/* Overview */}
          <OverviewCard trigger={trigger} onSaved={invalidateAfterSave} />

          {/* Webhook Details */}
          {trigger.type === "webhook" && (
            <WebhookConfigCard trigger={trigger} onSaved={invalidateAfterSave} />
          )}

          {/* External Interaction API (Spec EIA §4) — webhook 트리거에서만 표시 */}
          {trigger.type === "webhook" && (
            <ExternalInteractionCard trigger={trigger} onSaved={invalidateAfterSave} />
          )}

          {/* Schedule Details */}
          {trigger.type === "schedule" && (
            <ScheduleConfigurationCard trigger={trigger} />
          )}

          {/* Recent History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Calls</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No recent calls found.
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm"
                    >
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {formatDate(entry.startedAt, "datetime")}
                      </span>
                      <Badge
                        variant={
                          entry.status === "success"
                            ? "success"
                            : entry.status === "error" || entry.status === "failed"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {entry.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Trigger not found.
        </p>
      )}
    </SlideDrawer>
  );
}

function getWebhookUrl(endpointPath: string) {
  const base = typeof window !== "undefined"
    ? window.location.origin.replace(/:\d+$/, ":3011")
    : "";
  return `${base}/api/hooks/${endpointPath}`;
}

function OverviewCard({
  trigger,
  onSaved,
}: {
  trigger: TriggerDetail;
  onSaved: () => void;
}) {
  const t = useT();
  const canEdit = useHasRole("editor");
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(trigger.name);

  const updateMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiClient.patch(`/triggers/${trigger.id}`, { name });
    },
    onSuccess: () => {
      toast.success(t("triggers.detail.saved"));
      setEditing(false);
      onSaved();
    },
    onError: () => {
      toast.error(t("triggers.detail.saveFailed"));
    },
  });

  function startEdit() {
    setNameValue(trigger.name);
    setEditing(true);
  }

  function cancelEdit() {
    setNameValue(trigger.name);
    setEditing(false);
  }

  const saveDisabled =
    updateMutation.isPending ||
    nameValue.trim().length === 0 ||
    nameValue.trim() === trigger.name;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Overview</CardTitle>
        {canEdit && !editing && (
          <Button size="sm" variant="ghost" onClick={startEdit} aria-label={t("triggers.detail.edit")}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {editing && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={cancelEdit}
              disabled={updateMutation.isPending}
            >
              {t("triggers.detail.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => updateMutation.mutate(nameValue.trim())}
              disabled={saveDisabled}
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {updateMutation.isPending
                ? t("triggers.detail.saving")
                : t("triggers.detail.save")}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[hsl(var(--muted-foreground))]">
              {t("triggers.detail.nameLabel")}
            </dt>
            <dd className="font-medium">
              {editing ? (
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  placeholder={t("triggers.detail.namePlaceholder")}
                  className="h-8 w-56 text-right"
                  maxLength={255}
                />
              ) : (
                trigger.name
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">Type</dt>
            <dd>
              <span
                className={cn(
                  "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                  TYPE_BADGE_STYLES[trigger.type],
                )}
              >
                {trigger.type.charAt(0).toUpperCase() + trigger.type.slice(1)}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">Status</dt>
            <dd>
              <Badge variant={trigger.isActive ? "success" : "outline"}>
                {trigger.isActive ? "Active" : "Inactive"}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">Workflow</dt>
            <dd>
              <Link
                href={`/workflows/${trigger.workflowId}`}
                className="text-[hsl(var(--primary))] hover:underline"
              >
                {trigger.workflowName}
              </Link>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function ScheduleConfigurationCard({ trigger }: { trigger: TriggerDetail }) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Schedule Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-3 text-sm">
          {trigger.cronExpression && (
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">Cron Expression</dt>
              <dd>
                <code className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">
                  {trigger.cronExpression}
                </code>
              </dd>
            </div>
          )}
          {trigger.timezone && (
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">Timezone</dt>
              <dd className="font-medium">{trigger.timezone}</dd>
            </div>
          )}
          {trigger.nextRunAt && (
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">Next Run</dt>
              <dd className="font-medium">
                {formatDate(trigger.nextRunAt, "datetime")}
              </dd>
            </div>
          )}
        </dl>
        <div className="border-t border-[hsl(var(--border))] pt-3 text-xs space-y-1">
          <Link
            href={`/schedules?triggerId=${encodeURIComponent(trigger.id)}`}
            className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"
          >
            {t("triggers.detail.editInSchedule")}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
          <p className="text-[hsl(var(--muted-foreground))]">
            {t("triggers.detail.editInScheduleHelp")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function WebhookConfigCard({
  trigger,
  onSaved,
}: {
  trigger: TriggerDetail;
  onSaved: () => void;
}) {
  const t = useT();
  const canEdit = useHasRole("editor");
  const [showExample, setShowExample] = useState(false);
  const url = trigger.endpointPath ? getWebhookUrl(trigger.endpointPath) : "";
  const authType = trigger.config?.authType ?? "none";
  const hmacHeader = trigger.config?.hmacHeader ?? "X-Hub-Signature-256";

  // Edit state — `authType=none|hmac|bearer`, endpointPath, hmacHeader, hmacSecret, bearerToken
  const [editing, setEditing] = useState(false);
  const [endpointPathValue, setEndpointPathValue] = useState(
    trigger.endpointPath ?? "",
  );
  const [authTypeValue, setAuthTypeValue] = useState<
    "none" | "hmac" | "bearer"
  >(authType);
  const [hmacHeaderValue, setHmacHeaderValue] = useState(hmacHeader);
  const [hmacSecretValue, setHmacSecretValue] = useState("");
  const [bearerTokenValue, setBearerTokenValue] = useState("");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (endpointPathValue !== (trigger.endpointPath ?? "")) {
        body.endpointPath = endpointPathValue.trim();
      }
      // W10: 변경된 필드만 전송 — config 전체 spread 제거
      const configPatch: Record<string, unknown> = {
        authType: authTypeValue,
      };
      if (authTypeValue === "hmac") {
        configPatch.hmacHeader = hmacHeaderValue.trim() || "X-Hub-Signature-256";
        if (hmacSecretValue.trim().length > 0) {
          configPatch.hmacSecret = hmacSecretValue.trim();
        }
      }
      if (authTypeValue === "bearer") {
        if (bearerTokenValue.trim().length > 0) {
          configPatch.bearerToken = bearerTokenValue.trim();
        }
      }
      body.config = configPatch;
      await apiClient.patch(`/triggers/${trigger.id}`, body);
    },
    onSuccess: () => {
      toast.success(t("triggers.detail.saved"));
      setEditing(false);
      setHmacSecretValue("");
      setBearerTokenValue("");
      onSaved();
    },
    onError: () => {
      toast.error(t("triggers.detail.saveFailed"));
    },
  });

  function handleSaveClick() {
    // W7: endpointPath 변경 시 confirm 을 onClick 단계에서 처리 — mutationFn 안에서 throw 패턴 제거
    if (
      endpointPathValue !== (trigger.endpointPath ?? "") &&
      !window.confirm(t("triggers.detail.endpointPathChangeWarning"))
    ) {
      return;
    }
    updateMutation.mutate();
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy"),
    );
  }

  function cancelEdit() {
    setEditing(false);
    setEndpointPathValue(trigger.endpointPath ?? "");
    // W14: trigger.config 를 직접 참조해 stale closure 방지
    setAuthTypeValue(trigger.config?.authType ?? "none");
    setHmacHeaderValue(trigger.config?.hmacHeader ?? "X-Hub-Signature-256");
    setHmacSecretValue("");
    setBearerTokenValue("");
  }

  function getCurlExample() {
    if (authType === "hmac") {
      return `SECRET="your-secret-key"
BODY='{"event":"test"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')

curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "${hmacHeader}: $SIG" \\
  -d "$BODY"`;
    }
    if (authType === "bearer") {
      return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-token" \\
  -d '{"event":"test"}'`;
    }
    return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{"event":"test"}'`;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Webhook Configuration</CardTitle>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t("triggers.detail.edit")}
          </Button>
        )}
        {editing && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={cancelEdit}
              disabled={updateMutation.isPending}
            >
              {t("triggers.detail.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveClick}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {updateMutation.isPending
                ? t("triggers.detail.saving")
                : t("triggers.detail.save")}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editing && (
          <div className="space-y-3 text-sm">
            <div>
              <Label htmlFor="webhook-edit-endpoint">
                {t("triggers.detail.endpointPathLabel")}
              </Label>
              <Input
                id="webhook-edit-endpoint"
                value={endpointPathValue}
                onChange={(e) => setEndpointPathValue(e.target.value)}
                className="font-mono text-xs"
                maxLength={255}
              />
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {t("triggers.detail.endpointPathHelp")}
              </p>
            </div>
            <div>
              <Label htmlFor="webhook-edit-auth">
                {t("triggers.detail.authTypeLabel")}
              </Label>
              <select
                id="webhook-edit-auth"
                className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                value={authTypeValue}
                onChange={(e) =>
                  setAuthTypeValue(
                    e.target.value as "none" | "hmac" | "bearer",
                  )
                }
              >
                <option value="none">{t("triggers.authNone")}</option>
                <option value="hmac">{t("triggers.authHmac")}</option>
                <option value="bearer">{t("triggers.authBearer")}</option>
              </select>
            </div>
            {authTypeValue === "hmac" && (
              <>
                <div>
                  <Label htmlFor="webhook-edit-hmac-header">
                    {t("triggers.detail.hmacHeaderLabel")}
                  </Label>
                  <Input
                    id="webhook-edit-hmac-header"
                    value={hmacHeaderValue}
                    onChange={(e) => setHmacHeaderValue(e.target.value)}
                    placeholder="X-Hub-Signature-256"
                  />
                </div>
                <div>
                  <Label htmlFor="webhook-edit-hmac-secret">
                    {t("triggers.detail.hmacSecretLabel")}
                  </Label>
                  <Input
                    id="webhook-edit-hmac-secret"
                    type="password"
                    value={hmacSecretValue}
                    onChange={(e) => setHmacSecretValue(e.target.value)}
                    placeholder="•••••••• (leave blank to keep)"
                    autoComplete="new-password"
                  />
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {t("triggers.detail.hmacSecretHelp")}
                  </p>
                </div>
              </>
            )}
            {authTypeValue === "bearer" && (
              <div>
                <Label htmlFor="webhook-edit-bearer">
                  {t("triggers.detail.bearerTokenLabel")}
                </Label>
                <Input
                  id="webhook-edit-bearer"
                  type="password"
                  value={bearerTokenValue}
                  onChange={(e) => setBearerTokenValue(e.target.value)}
                  placeholder="•••••••• (leave blank to keep)"
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {t("triggers.detail.bearerTokenHelp")}
                </p>
              </div>
            )}
          </div>
        )}

        <dl className="space-y-3 text-sm">
          {url && !editing && (
            <div>
              <dt className="text-[hsl(var(--muted-foreground))] mb-1">URL</dt>
              <dd className="flex items-center gap-1">
                <code className="block flex-1 break-all rounded bg-[hsl(var(--muted))] px-2 py-1.5 text-xs">
                  {url}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyText(url)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">HTTP Method</dt>
            <dd><Badge variant="outline">POST</Badge></dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">Authentication</dt>
            <dd>
              <Badge variant="outline">
                {authType === "hmac" ? "HMAC Signature" : authType === "bearer" ? "Bearer Token" : "None (Public)"}
              </Badge>
            </dd>
          </div>
          {authType === "hmac" && (
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">Signature Header</dt>
              <dd className="font-medium">{hmacHeader}</dd>
            </div>
          )}
        </dl>

        {/* Usage Example */}
        <div>
          <button
            type="button"
            className="flex w-full items-center gap-1 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            onClick={() => setShowExample(!showExample)}
          >
            {showExample ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Usage Example (curl)
          </button>
          {showExample && (
            <div className="mt-2 relative">
              <pre className="rounded bg-[hsl(var(--muted))] px-3 py-2.5 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                {getCurlExample()}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 h-6 w-6"
                onClick={() => copyText(getCurlExample())}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Spec EIA §4 — External Interaction API 의 현재 설정을 표시하는 read-only 카드.
 *
 * v1 은 표시 전용 (수정 UI 는 후속 PR). 호스팅된 워크플로우가 외부 호출자에게 어떤 채널을
 * 노출하고 있는지 한눈에 보기 위함. `notificationHealth` 배지로 발송 상태 모니터링.
 */
const NOTIFICATION_EVENT_CHOICES = [
  "execution.waiting_for_input",
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
  "execution.ai_message",
] as const;

function ExternalInteractionCard({
  trigger,
  onSaved,
}: {
  trigger: TriggerDetail;
  onSaved: () => void;
}) {
  const t = useT();
  const canEdit = useHasRole("editor");
  const notification = trigger.config?.notification;
  const interaction = trigger.config?.interaction;
  const hasAny = Boolean(notification?.url || interaction?.enabled);
  const health = trigger.notificationHealth ?? "unknown";
  const healthVariant: "success" | "outline" | "destructive" =
    health === "healthy"
      ? "success"
      : health === "degraded"
        ? "destructive"
        : "outline";
  const healthLabel: Record<typeof health, string> = {
    unknown: "Unknown",
    healthy: "Healthy",
    degraded: "Degraded",
  };

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [urlValue, setUrlValue] = useState(notification?.url ?? "");
  const [eventsValue, setEventsValue] = useState<Set<string>>(
    new Set(notification?.events ?? []),
  );
  const [interactionEnabled, setInteractionEnabled] = useState(
    interaction?.enabled ?? false,
  );
  const [strategy, setStrategy] = useState<"per_execution" | "per_trigger">(
    interaction?.tokenStrategy ?? "per_execution",
  );

  // Rotate / revoke result dialogs (1회만 표시)
  const [rotateResult, setRotateResult] = useState<string | null>(null);
  const [revokeResult, setRevokeResult] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const patchBody: Record<string, unknown> = {};
      if (urlValue && urlValue.length > 0) {
        patchBody.notification = {
          url: urlValue,
          events: Array.from(eventsValue),
          ...(notification?.signing ? { signing: notification.signing } : {}),
          ...(notification?.retry ? { retry: notification.retry } : {}),
        };
      }
      patchBody.interaction = {
        enabled: interactionEnabled,
        tokenStrategy: strategy,
      };
      await apiClient.patch(`/triggers/${trigger.id}`, patchBody);
      toast.success(t("triggers.externalInteraction.saveSucceeded"));
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(
        `${t("triggers.externalInteraction.saveFailed")}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateSecret(): Promise<void> {
    if (!window.confirm(t("triggers.externalInteraction.rotateConfirm"))) return;
    try {
      const res = await apiClient.post<{
        data: { secret: string; rotatedAt: string };
      }>(`/triggers/${trigger.id}/notification/rotate-secret`, {});
      setRotateResult(res.data.data.secret);
      toast.success(t("triggers.externalInteraction.rotateSucceeded"));
    } catch (err) {
      toast.error(
        `${t("triggers.externalInteraction.rotateFailed")}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function handleRevokeToken(): Promise<void> {
    if (!window.confirm(t("triggers.externalInteraction.revokeConfirm"))) return;
    try {
      const res = await apiClient.post<{ data: { token: string } }>(
        `/triggers/${trigger.id}/interaction/revoke-token`,
        {},
      );
      setRevokeResult(res.data.data.token);
      toast.success(t("triggers.externalInteraction.revokeSucceeded"));
    } catch (err) {
      toast.error(
        `${t("triggers.externalInteraction.revokeFailed")}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("triggers.externalInteraction.copied"));
    } catch {
      toast.error(t("triggers.copyFailed"));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">External Interaction</CardTitle>
        {canEdit && !editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t("triggers.externalInteraction.edit")}
          </Button>
        ) : editing ? (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              {t("triggers.externalInteraction.cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving
                ? t("triggers.externalInteraction.saving")
                : t("triggers.externalInteraction.save")}
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAny && !editing && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("triggers.externalInteraction.notConfigured")}
          </p>
        )}

        {notification?.url && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="font-medium">Notification (Outbound)</dt>
              <Badge variant={healthVariant}>{healthLabel[health]}</Badge>
            </div>
            <dl className="space-y-1.5 pl-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[hsl(var(--muted-foreground))]">URL</dt>
                <dd className="font-mono break-all text-right max-w-[60%]">
                  {notification.url}
                </dd>
              </div>
              {notification.events && notification.events.length > 0 && (
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[hsl(var(--muted-foreground))]">Events</dt>
                  <dd className="text-right">
                    {notification.events.map((e) => (
                      <Badge key={e} variant="outline" className="mr-1 mb-1 text-xs">
                        {e}
                      </Badge>
                    ))}
                  </dd>
                </div>
              )}
              {notification.signing?.algorithm && (
                <div className="flex items-center justify-between">
                  <dt className="text-[hsl(var(--muted-foreground))]">Algorithm</dt>
                  <dd className="font-mono text-[hsl(var(--foreground))]">
                    {notification.signing.algorithm}
                  </dd>
                </div>
              )}
              {notification.retry?.maxAttempts !== undefined && (
                <div className="flex items-center justify-between">
                  <dt className="text-[hsl(var(--muted-foreground))]">Retry attempts</dt>
                  <dd className="font-medium">{notification.retry.maxAttempts}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {interaction?.enabled && !editing && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="font-medium">Interaction (Inbound REST + SSE)</dt>
              <Badge variant="success">Enabled</Badge>
            </div>
            <dl className="space-y-1.5 pl-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-[hsl(var(--muted-foreground))]">Token strategy</dt>
                <dd className="font-mono">
                  {interaction.tokenStrategy ?? "per_execution"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[hsl(var(--muted-foreground))]">Endpoints</dt>
                <dd className="font-mono text-right text-[10px] text-[hsl(var(--muted-foreground))]">
                  /api/external/executions/&lcub;id&rcub;/&#123;interact,stream,cancel,refresh-token&#125;
                </dd>
              </div>
            </dl>
            {interaction.tokenStrategy === "per_trigger" && (
              <Button size="sm" variant="outline" onClick={handleRevokeToken}>
                {t("triggers.externalInteraction.interactionRevokeToken")}
              </Button>
            )}
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium mb-1">
                {t("triggers.externalInteraction.notificationUrl")}
              </label>
              <input
                type="text"
                className="w-full px-2 py-1.5 text-xs font-mono border rounded bg-[hsl(var(--background))] border-[hsl(var(--border))]"
                placeholder={
                  t("triggers.externalInteraction.notificationUrlPlaceholder")
                }
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
              />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                {t("triggers.externalInteraction.notificationUrlHelp")}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                {t("triggers.externalInteraction.eventChoices")}
              </label>
              <div className="space-y-1">
                {NOTIFICATION_EVENT_CHOICES.map((ev) => (
                  <label
                    key={ev}
                    className="flex items-center gap-2 text-xs font-mono"
                  >
                    <input
                      type="checkbox"
                      checked={eventsValue.has(ev)}
                      onChange={(e) => {
                        const next = new Set(eventsValue);
                        if (e.target.checked) next.add(ev);
                        else next.delete(ev);
                        setEventsValue(next);
                      }}
                    />
                    {ev}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={interactionEnabled}
                  onChange={(e) => setInteractionEnabled(e.target.checked)}
                />
                {t("triggers.externalInteraction.interactionEnabled")}
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                {t("triggers.externalInteraction.interactionTokenStrategy")}
              </label>
              <select
                className="px-2 py-1.5 text-xs font-mono border rounded bg-[hsl(var(--background))] border-[hsl(var(--border))]"
                value={strategy}
                onChange={(e) =>
                  setStrategy(
                    e.target.value as "per_execution" | "per_trigger",
                  )
                }
              >
                <option value="per_execution">
                  {
                    t("triggers.externalInteraction.tokenStrategyPerExecution")
                  }
                </option>
                <option value="per_trigger">
                  {t("triggers.externalInteraction.tokenStrategyPerTrigger")}
                </option>
              </select>
            </div>
          </div>
        )}

        {/* Action buttons (non-editing) */}
        {!editing && notification?.url && (
          <Button size="sm" variant="outline" onClick={handleRotateSecret}>
            {t("triggers.externalInteraction.notificationSecretRotate")}
          </Button>
        )}

        {/* Secret rotation result (1회 표시) */}
        {rotateResult && (
          <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-xs space-y-2">
            <div className="font-medium">
              {t("triggers.externalInteraction.rotateNewSecret")}
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono break-all">{rotateResult}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void copyText(rotateResult)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRotateResult(null)}
            >
              {t("triggers.externalInteraction.cancel")}
            </Button>
          </div>
        )}

        {/* Per-trigger token revoke result */}
        {revokeResult && (
          <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-xs space-y-2">
            <div className="font-medium">
              {t("triggers.externalInteraction.revokeNewToken")}
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono break-all">{revokeResult}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void copyText(revokeResult)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRevokeResult(null)}
            >
              {t("triggers.externalInteraction.cancel")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
