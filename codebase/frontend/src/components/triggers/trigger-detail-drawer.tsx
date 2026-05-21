import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { SlideDrawer } from "@/components/ui/slide-drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import { useT } from "@/lib/i18n";
import { Loader2, Copy, ChevronDown, ChevronRight } from "lucide-react";
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-[hsl(var(--muted-foreground))]">Name</dt>
                  <dd className="font-medium">{trigger.name}</dd>
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

          {/* Webhook Details */}
          {trigger.type === "webhook" && (
            <WebhookConfigCard trigger={trigger} />
          )}

          {/* External Interaction API (Spec EIA §4) — webhook 트리거에서만 표시 */}
          {trigger.type === "webhook" && (
            <ExternalInteractionCard trigger={trigger} />
          )}

          {/* Schedule Details */}
          {trigger.type === "schedule" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schedule Configuration</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
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

function WebhookConfigCard({ trigger }: { trigger: TriggerDetail }) {
  const [showExample, setShowExample] = useState(false);
  const url = trigger.endpointPath ? getWebhookUrl(trigger.endpointPath) : "";
  const authType = trigger.config?.authType ?? "none";
  const hmacHeader = trigger.config?.hmacHeader ?? "X-Hub-Signature-256";

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy"),
    );
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
      <CardHeader>
        <CardTitle className="text-base">Webhook Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-3 text-sm">
          {url && (
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
function ExternalInteractionCard({ trigger }: { trigger: TriggerDetail }) {
  const t = useT();
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">External Interaction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAny && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t.triggers.externalInteraction.notConfigured}
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

        {interaction?.enabled && (
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
