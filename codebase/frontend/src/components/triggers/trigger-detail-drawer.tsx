import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { SlideDrawer } from "@/components/ui/slide-drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import { useT } from "@/lib/i18n";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { useHasRole } from "@/components/auth/role-gate";
import {
  AuthConfigSelect,
  useAuthConfigs,
  AUTH_CONFIG_TYPE_LABEL_KEYS,
} from "./auth-config-select";
import {
  Loader2,
  Copy,
  ChevronDown,
  ChevronRight,
  Pencil,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getWebhookUrl } from "@/lib/utils/webhook-url";
import { isValidNotificationUrl } from "@/lib/utils/url-validation";

/**
 * Chat Channel `rateLimitPerMinute` 의 제품 기본값 (spec Chat Channel §4.1).
 * read 표시·edit 폼 초기값·저장 시 fallback 세 곳에서 동일 값을 참조한다.
 */
const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;

/**
 * 1회성 시크릿(secret / token) 노출 박스.
 *
 * 보안(ai-review W): 평문을 DOM 에 상시 렌더하지 않는다 — 기본 마스킹하고
 * "표시" 클릭 시에만 평문 노출, 그리고 60초 후 부모 state 를 비워 자동으로
 * 사라지게 한다(`onExpire`). 복사 버튼은 마스킹 상태에서도 실제 값을 복사한다.
 */
function SecretRevealBox({
  title,
  secret,
  onDismiss,
}: {
  title: string;
  secret: string;
  onDismiss: () => void;
}) {
  const t = useT();
  const copyToClipboard = useCopyToClipboard();
  const [revealed, setRevealed] = useState(false);

  // 부모가 매 렌더 새 함수를 넘겨도 타이머가 재시작되지 않도록 ref 로 고정.
  // ref 갱신은 render 중이 아니라 effect 안에서 한다 (react-hooks/refs).
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), 60_000);
    return () => clearTimeout(timer);
  }, [secret]);

  return (
    <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-xs space-y-2">
      <div className="font-medium">{title}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono break-all">
          {revealed ? secret : "•".repeat(Math.min(secret.length, 32))}
        </code>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setRevealed((v) => !v)}
          aria-label={
            revealed
              ? t("triggers.externalInteraction.secretHide")
              : t("triggers.externalInteraction.secretReveal")
          }
        >
          {revealed ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            void copyToClipboard(secret, {
              success: t("triggers.externalInteraction.copied"),
              error: t("triggers.copyFailed"),
            })
          }
          aria-label={t("triggers.externalInteraction.copy")}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-[hsl(var(--muted-foreground))]">
        {t("triggers.externalInteraction.secretAutoHideNote")}
      </p>
      <Button size="sm" variant="outline" onClick={onDismiss}>
        {t("triggers.externalInteraction.cancel")}
      </Button>
    </div>
  );
}

/** Spec Chat Channel §4.1 + §5.4.2 — config.chatChannel (응답 sanitize 후 형태). */
interface ChatChannelConfigView {
  provider?: string;
  /** Spec §5.4.2 — derived 필드 (`botTokenRef IS NOT NULL → true`). */
  hasBotToken?: boolean;
  botIdentity?: { botId?: number; username?: string };
  uiMapping?: {
    formMode?: "multi_step" | "native_modal" | "auto";
    /** Spec R-CC-11 — text/photo/auto, default auto. legacy text_only 는 backend normalize. */
    visualNode?: "text" | "photo" | "auto";
    buttonLayout?: "auto" | "vertical" | "horizontal";
  };
  rateLimitPerMinute?: number;
  languageHints?: Record<string, string>;
  /** Spec §4.1 — languageHints 미설정 키의 default 문구 언어 (default ko). */
  languageLocale?: "ko" | "en";
}

interface TriggerDetail {
  id: string;
  name: string;
  type: "webhook" | "schedule" | "manual";
  isActive: boolean;
  workflowId: string;
  workflowName: string;
  endpointPath?: string;
  /** Webhook 인증 — 연결된 AuthConfig (없으면 인증 없음). 인증 자료는 Authentication 메뉴에서 관리. */
  authConfigId?: string | null;
  config?: {
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
    /** Spec Chat Channel §4.1 — chatChannel adapter 설정 (sanitize 후). */
    chatChannel?: ChatChannelConfigView;
    [key: string]: unknown;
  };
  /** Spec EIA §7.1 — outbound notification 발송 건강도. */
  notificationHealth?: "unknown" | "healthy" | "degraded";
  /** Spec Chat Channel §3.4 CCH-SE-01 — chat channel 외부 호출 건강도. */
  chatChannelHealth?: "unknown" | "healthy" | "degraded";
  chatChannelLastError?: string | null;
  chatChannelSetupAt?: string | null;
  chatChannelRotatedAt?: string | null;
  cronExpression?: string;
  timezone?: string;
  nextRunAt?: string;
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
  const t = useT();
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

  return (
    <SlideDrawer open={open} onClose={onClose} title={t("triggers.detail.drawerTitle")}>
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

          {/* Chat Channel (Spec Chat Channel §4.1 / 2-trigger-list R-8) — webhook 트리거에서만 표시 */}
          {trigger.type === "webhook" && (
            <ChatChannelCard trigger={trigger} onSaved={invalidateAfterSave} />
          )}

          {/* Schedule Details */}
          {trigger.type === "schedule" && (
            <ScheduleConfigurationCard trigger={trigger} />
          )}

          {/*
            Recent Calls 카드는 [Spec §2.1 + Rationale R-7] 에 따라 본 drawer 에서
            제거됨. ⋮ 메뉴 → "호출 이력" (별도 Dialog) 가 동일 데이터를 더 가벼운
            modal 로 노출한다.
          */}
        </div>
      ) : (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("triggers.detail.notFound")}
        </p>
      )}
    </SlideDrawer>
  );
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
        <CardTitle className="text-base">
          {t("triggers.detail.sectionOverview")}
        </CardTitle>
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
            <dt className="text-[hsl(var(--muted-foreground))]">
              {t("triggers.type")}
            </dt>
            <dd>
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
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">
              {t("triggers.status")}
            </dt>
            <dd>
              <Badge variant={trigger.isActive ? "success" : "outline"}>
                {trigger.isActive
                  ? t("triggers.statusActive")
                  : t("triggers.statusInactive")}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">
              {t("triggers.workflow")}
            </dt>
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
        <CardTitle className="text-base">
          {t("triggers.detail.sectionSchedule")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-3 text-sm">
          {trigger.cronExpression && (
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.detail.cronExpressionLabel")}
              </dt>
              <dd>
                <code className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">
                  {trigger.cronExpression}
                </code>
              </dd>
            </div>
          )}
          {trigger.timezone && (
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.detail.timezoneLabel")}
              </dt>
              <dd className="font-medium">{trigger.timezone}</dd>
            </div>
          )}
          {trigger.nextRunAt && (
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.detail.nextRunLabel")}
              </dt>
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
  const copyToClipboard = useCopyToClipboard();
  const [showExample, setShowExample] = useState(false);
  const url = trigger.endpointPath ? getWebhookUrl(trigger.endpointPath) : "";
  // 연결된 AuthConfig (read-only 표시 + cURL 예시 분기용).
  const { data: authConfigs = [] } = useAuthConfigs();
  const linkedAuthConfig = trigger.authConfigId
    ? (authConfigs.find((c) => c.id === trigger.authConfigId) ?? null)
    : null;

  // Edit state — endpointPath + authConfigId (인증 자료는 Authentication 메뉴에서 관리).
  const [editing, setEditing] = useState(false);
  const [endpointPathValue, setEndpointPathValue] = useState(
    trigger.endpointPath ?? "",
  );
  const [authConfigIdValue, setAuthConfigIdValue] = useState<string | null>(
    trigger.authConfigId ?? null,
  );

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (endpointPathValue !== (trigger.endpointPath ?? "")) {
        body.endpointPath = endpointPathValue.trim();
      }
      // 인증은 authConfigId binding 으로만 (inline 인증 필드 폐지). null = 인증 없음.
      if (authConfigIdValue !== (trigger.authConfigId ?? null)) {
        body.authConfigId = authConfigIdValue;
      }
      await apiClient.patch(`/triggers/${trigger.id}`, body);
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
    void copyToClipboard(text, {
      success: t("triggers.copied"),
      error: t("triggers.copyFailed"),
    });
  }

  function cancelEdit() {
    setEditing(false);
    setEndpointPathValue(trigger.endpointPath ?? "");
    setAuthConfigIdValue(trigger.authConfigId ?? null);
  }

  function getCurlExample() {
    // 인증 자료 평문은 노출하지 않고 placeholder 만 — 실제 값은 Authentication 메뉴에서 확인.
    const acType = linkedAuthConfig?.type;
    if (acType === "hmac") {
      return `SECRET="<HMAC_SECRET>"
BODY='{"event":"test"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')

curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "X-Hub-Signature-256: $SIG" \\
  -d "$BODY"`;
    }
    if (acType === "bearer_token") {
      return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <BEARER_TOKEN>" \\
  -d '{"event":"test"}'`;
    }
    if (acType === "api_key") {
      return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <API_KEY>" \\
  -d '{"event":"test"}'`;
    }
    if (acType === "basic_auth") {
      return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -u "<USERNAME>:<PASSWORD>" \\
  -d '{"event":"test"}'`;
    }
    return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{"event":"test"}'`;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          {t("triggers.detail.sectionWebhook")}
        </CardTitle>
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
              <Label htmlFor="webhook-edit-authconfig">
                {t("triggers.authConfigLabel")}
              </Label>
              <AuthConfigSelect
                id="webhook-edit-authconfig"
                value={authConfigIdValue}
                onChange={setAuthConfigIdValue}
                disabled={updateMutation.isPending}
              />
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {t("triggers.authConfigHelp")}
              </p>
            </div>
          </div>
        )}

        <dl className="space-y-3 text-sm">
          {url && !editing && (
            <div>
              <dt className="text-[hsl(var(--muted-foreground))] mb-1">
                {t("triggers.detail.urlLabel")}
              </dt>
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
            <dt className="text-[hsl(var(--muted-foreground))]">
              {t("triggers.detail.httpMethodLabel")}
            </dt>
            <dd><Badge variant="outline">POST</Badge></dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">
              {t("triggers.authenticationLabel")}
            </dt>
            <dd>
              {linkedAuthConfig ? (
                <Badge variant="outline">
                  {linkedAuthConfig.name} ·{" "}
                  {t(
                    AUTH_CONFIG_TYPE_LABEL_KEYS[linkedAuthConfig.type] ??
                      "authentication.typeApiKey",
                  )}
                </Badge>
              ) : (
                <Badge variant="outline">{t("triggers.authConfigNone")}</Badge>
              )}
            </dd>
          </div>
        </dl>

        {/* Usage Example */}
        <div>
          <button
            type="button"
            className="flex w-full items-center gap-1 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            onClick={() => setShowExample(!showExample)}
          >
            {showExample ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {t("triggers.detail.usageExampleCurl")}
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
 * 편집·rotate·revoke 지원 (PR #265). 호스팅된 워크플로우가 외부 호출자에게 어떤 채널을
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
    unknown: t("triggers.externalInteraction.healthUnknown"),
    healthy: t("triggers.externalInteraction.healthHealthy"),
    degraded: t("triggers.externalInteraction.healthDegraded"),
  };

  // Edit state
  const [editing, setEditing] = useState(false);
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

  const saveMutation = useMutation({
    mutationFn: async () => {
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
    },
    onSuccess: () => {
      toast.success(t("triggers.externalInteraction.saveSucceeded"));
      setEditing(false);
      onSaved();
    },
    // 보안(ai-review W): 서버 err.message 원문을 toast 에 노출하지 않는다 —
    // i18n 문자열만. (OverviewCard.onError 와 동일 패턴.)
    onError: () => {
      toast.error(t("triggers.externalInteraction.saveFailed"));
    },
  });

  function handleSave(): void {
    // 클라이언트 사전 검증 — https:// 만 허용 (spec EIA-NX-09). 빈 값은 통과
    // (notification 은 선택). 최종 SSRF 차단은 백엔드 권위.
    if (!isValidNotificationUrl(urlValue)) {
      toast.error(t("triggers.externalInteraction.notificationUrlInvalid"));
      return;
    }
    saveMutation.mutate();
  }

  // cancel 시 미저장 입력값을 원래 값으로 리셋 (carried-over 기존 동작).
  function resetForm(): void {
    setUrlValue(notification?.url ?? "");
    setEventsValue(new Set(notification?.events ?? []));
    setInteractionEnabled(interaction?.enabled ?? false);
    setStrategy(interaction?.tokenStrategy ?? "per_execution");
  }

  async function handleRotateSecret(): Promise<void> {
    if (!window.confirm(t("triggers.externalInteraction.rotateConfirm"))) return;
    try {
      const res = await apiClient.post<{
        data: { secret: string; rotatedAt: string };
      }>(`/triggers/${trigger.id}/notification/rotate-secret`, {});
      setRotateResult(res.data.data.secret);
      toast.success(t("triggers.externalInteraction.rotateSucceeded"));
    } catch {
      toast.error(t("triggers.externalInteraction.rotateFailed"));
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
    } catch {
      toast.error(t("triggers.externalInteraction.revokeFailed"));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          {t("triggers.externalInteraction.section")}
        </CardTitle>
        {canEdit && !editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t("triggers.externalInteraction.edit")}
          </Button>
        ) : editing ? (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // useMutation 전환 후 직전 저장 실패의 error 상태가 재진입까지
                // 잔류하지 않도록 cancel 시 mutation 상태를 초기화하고,
                // 미저장 입력값을 원래 값으로 되돌린다.
                saveMutation.reset();
                resetForm();
                setEditing(false);
              }}
              disabled={saveMutation.isPending}
            >
              {t("triggers.externalInteraction.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
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
              <dt className="font-medium">
                {t("triggers.externalInteraction.notification")}
              </dt>
              <Badge variant={healthVariant}>{healthLabel[health]}</Badge>
            </div>
            <dl className="space-y-1.5 pl-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.detail.urlLabel")}
                </dt>
                <dd className="font-mono break-all text-right max-w-[60%]">
                  {notification.url}
                </dd>
              </div>
              {notification.events && notification.events.length > 0 && (
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.externalInteraction.eventsLabel")}
                  </dt>
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
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.externalInteraction.algorithmLabel")}
                  </dt>
                  <dd className="font-mono text-[hsl(var(--foreground))]">
                    {notification.signing.algorithm}
                  </dd>
                </div>
              )}
              {notification.retry?.maxAttempts !== undefined && (
                <div className="flex items-center justify-between">
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.externalInteraction.retryAttemptsLabel")}
                  </dt>
                  <dd className="font-medium">{notification.retry.maxAttempts}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {interaction?.enabled && !editing && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="font-medium">
                {t("triggers.externalInteraction.interaction")}
              </dt>
              <Badge variant="success">{t("triggers.externalInteraction.interactionEnabled")}</Badge>
            </div>
            <dl className="space-y-1.5 pl-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.externalInteraction.interactionTokenStrategy")}
                </dt>
                <dd className="font-mono">
                  {interaction.tokenStrategy === "per_trigger"
                    ? t("triggers.externalInteraction.tokenStrategyPerTrigger")
                    : t("triggers.externalInteraction.tokenStrategyPerExecution")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.externalInteraction.endpointsLabel")}
                </dt>
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
              <Label htmlFor="eia-notification-url">
                {t("triggers.externalInteraction.notificationUrl")}
              </Label>
              <Input
                id="eia-notification-url"
                type="text"
                className="mt-1 font-mono text-xs"
                placeholder={t(
                  "triggers.externalInteraction.notificationUrlPlaceholder",
                )}
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
              />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                {t("triggers.externalInteraction.notificationUrlHelp")}
              </p>
            </div>
            <div>
              <Label className="mb-1 block">
                {t("triggers.externalInteraction.eventChoices")}
              </Label>
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
              <Label htmlFor="eia-token-strategy">
                {t("triggers.externalInteraction.interactionTokenStrategy")}
              </Label>
              <NativeSelect
                id="eia-token-strategy"
                className="mt-1 font-mono text-xs"
                value={strategy}
                onChange={(e) =>
                  setStrategy(
                    e.target.value as "per_execution" | "per_trigger",
                  )
                }
              >
                <option value="per_execution">
                  {t("triggers.externalInteraction.tokenStrategyPerExecution")}
                </option>
                <option value="per_trigger">
                  {t("triggers.externalInteraction.tokenStrategyPerTrigger")}
                </option>
              </NativeSelect>
            </div>
          </div>
        )}

        {/* Action buttons (non-editing) */}
        {!editing && notification?.url && (
          <Button size="sm" variant="outline" onClick={handleRotateSecret}>
            {t("triggers.externalInteraction.notificationSecretRotate")}
          </Button>
        )}

        {/* Secret rotation result (마스킹 + 클릭 노출 + 60s 자동 소거) */}
        {rotateResult && (
          <SecretRevealBox
            title={t("triggers.externalInteraction.rotateNewSecret")}
            secret={rotateResult}
            onDismiss={() => setRotateResult(null)}
          />
        )}

        {/* Per-trigger token revoke result (마스킹 + 클릭 노출 + 60s 자동 소거) */}
        {revokeResult && (
          <SecretRevealBox
            title={t("triggers.externalInteraction.revokeNewToken")}
            secret={revokeResult}
            onDismiss={() => setRevokeResult(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** ChatChannel edit 폼의 편집 가능 필드 묶음. */
interface ChatChannelEditValues {
  visualNode: "text" | "photo" | "auto";
  buttonLayout: "auto" | "vertical" | "horizontal";
  rateLimitPerMinute: string;
  languageHintsJson: string;
  languageLocale: "ko" | "en";
}

/** chatChannel config 에서 edit 폼 초기값을 도출한다 (마운트·cancel 리셋 공용). */
function initialChatChannelEditValues(
  chatChannel: ChatChannelConfigView | undefined,
): ChatChannelEditValues {
  return {
    visualNode: chatChannel?.uiMapping?.visualNode ?? "auto",
    buttonLayout: chatChannel?.uiMapping?.buttonLayout ?? "auto",
    rateLimitPerMinute: String(
      chatChannel?.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
    ),
    languageHintsJson: chatChannel?.languageHints
      ? JSON.stringify(chatChannel.languageHints, null, 2)
      : "",
    languageLocale: chatChannel?.languageLocale ?? "ko",
  };
}

/** languageHints JSON 파싱 실패를 saveFailed 와 구분해 i18n 메시지로 분기하기 위한 마커. */
class LanguageHintsParseError extends Error {}

/**
 * languageHints textarea(JSON) 를 flat `Record<string,string>` 로 파싱한다.
 * 빈 입력은 `undefined` (미설정). 형식 오류 시 `LanguageHintsParseError`.
 */
function parseLanguageHints(
  json: string,
): Record<string, string> | undefined {
  if (json.trim().length === 0) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new LanguageHintsParseError();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new LanguageHintsParseError();
  }
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]),
  );
}

/**
 * ChatChannel edit 폼 — uiMapping / rateLimit / languageLocale / languageHints.
 * 책임 분리(ai-review W): 폼 마크업을 카드 본체에서 분리한다.
 */
function ChatChannelEditForm({
  values,
  onChange,
}: {
  values: ChatChannelEditValues;
  onChange: (next: ChatChannelEditValues) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-3 text-sm">
      <div>
        <Label htmlFor="cc-visualNode">
          {t("triggers.chatChannel.uiMappingVisualNode")}
        </Label>
        <NativeSelect
          id="cc-visualNode"
          className="mt-1"
          value={values.visualNode}
          onChange={(e) =>
            onChange({
              ...values,
              visualNode: e.target.value as "text" | "photo" | "auto",
            })
          }
        >
          <option value="auto">
            {t("triggers.chatChannel.visualNodeAuto")}
          </option>
          <option value="text">
            {t("triggers.chatChannel.visualNodeText")}
          </option>
          <option value="photo">
            {t("triggers.chatChannel.visualNodePhoto")}
          </option>
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor="cc-buttonLayout">
          {t("triggers.chatChannel.uiMappingButtonLayout")}
        </Label>
        <NativeSelect
          id="cc-buttonLayout"
          className="mt-1"
          value={values.buttonLayout}
          onChange={(e) =>
            onChange({
              ...values,
              buttonLayout: e.target.value as
                | "auto"
                | "vertical"
                | "horizontal",
            })
          }
        >
          <option value="auto">
            {t("triggers.chatChannel.buttonLayoutAuto")}
          </option>
          <option value="vertical">
            {t("triggers.chatChannel.buttonLayoutVertical")}
          </option>
          <option value="horizontal">
            {t("triggers.chatChannel.buttonLayoutHorizontal")}
          </option>
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor="cc-rateLimit">
          {t("triggers.chatChannel.rateLimitPerMinute")}
        </Label>
        <Input
          id="cc-rateLimit"
          type="number"
          min={1}
          max={600}
          value={values.rateLimitPerMinute}
          onChange={(e) =>
            onChange({ ...values, rateLimitPerMinute: e.target.value })
          }
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="cc-languageLocale">
          {t("triggers.chatChannel.languageLocale")}
        </Label>
        <NativeSelect
          id="cc-languageLocale"
          className="mt-1"
          value={values.languageLocale}
          onChange={(e) =>
            onChange({
              ...values,
              languageLocale: e.target.value as "ko" | "en",
            })
          }
        >
          <option value="ko">
            {t("triggers.chatChannel.languageLocaleKo")}
          </option>
          <option value="en">
            {t("triggers.chatChannel.languageLocaleEn")}
          </option>
        </NativeSelect>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {t("triggers.chatChannel.languageLocaleHelp")}
        </p>
      </div>
      <div>
        <Label htmlFor="cc-languageHints">
          {t("triggers.chatChannel.languageHints")}
        </Label>
        <textarea
          id="cc-languageHints"
          rows={6}
          className="mt-1 w-full rounded border border-[hsl(var(--input))] bg-transparent p-2 font-mono text-xs"
          placeholder={`{\n  "groupChatRefusal": "...",\n  "executionStarted": "...",\n  "executionCompleted": "...",\n  "executionStillRunning": "...",\n  "help": "..."\n}`}
          value={values.languageHintsJson}
          onChange={(e) =>
            onChange({ ...values, languageHintsJson: e.target.value })
          }
        />
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {t("triggers.chatChannel.languageHintsHelp")}
        </p>
      </div>
    </div>
  );
}

/**
 * Bot Token 재발급 모달 — spec §5.4.1 single-path.
 * 책임 분리(ai-review W): modal 마크업·입력 state 를 카드 본체에서 분리한다.
 */
function RotateBotTokenModal({
  pending,
  onConfirm,
  onClose,
}: {
  pending: boolean;
  onConfirm: (newBotToken: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5">
        <h3 className="mb-2 text-base font-semibold">
          {t("triggers.chatChannel.rotateBotTokenDialogTitle")}
        </h3>
        <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))]">
          {t("triggers.chatChannel.rotateBotTokenDescription")}
        </p>
        <p className="mb-3 text-sm">
          {t("triggers.chatChannel.rotateBotTokenConfirm")}
        </p>
        <Label htmlFor="cc-rotate-input">
          {t("triggers.chatChannel.botTokenInputLabel")}
        </Label>
        <Input
          id="cc-rotate-input"
          placeholder={t("triggers.chatChannel.botTokenInputPlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 font-mono"
          autoFocus
        />
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {t("triggers.chatChannel.botTokenFormatHelp")}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            {t("triggers.chatChannel.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(value.trim())}
            disabled={pending || value.trim().length === 0}
          >
            {pending
              ? t("triggers.chatChannel.saving")
              : t("triggers.chatChannel.rotateBotTokenDialogConfirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Chat Channel 카드 (Spec 2-trigger-list §2.3.1 + Rationale R-8).
 *
 * - read 모드: provider · bot identity · uiMapping · rateLimit · languageHints · health 그룹
 * - edit 모드: uiMapping / rateLimitPerMinute / languageHints 만 편집 (provider/botToken 은 별 경로)
 * - rotate Bot Token: spec §5.4.1 single-path — POST /chat-channel/rotate-bot-token
 *
 * 내부 ref (botTokenRef/secretTokenRef) 는 backend 가 응답에서 strip (CCH-SE-03 UI 차원).
 * hasBotToken derived 필드로 등록 여부만 노출 (spec §5.4.2).
 */
function ChatChannelCard({
  trigger,
  onSaved,
}: {
  trigger: TriggerDetail;
  onSaved: () => void;
}) {
  const t = useT();
  const canEdit = useHasRole("editor");
  const chatChannel = trigger.config?.chatChannel;
  const hasChatChannel = Boolean(chatChannel?.provider);
  const health = trigger.chatChannelHealth ?? "unknown";
  const healthVariant: "success" | "outline" | "destructive" =
    health === "healthy"
      ? "success"
      : health === "degraded"
        ? "destructive"
        : "outline";
  const healthLabel: Record<typeof health, string> = {
    unknown: t("triggers.chatChannel.healthUnknown"),
    healthy: t("triggers.chatChannel.healthHealthy"),
    degraded: t("triggers.chatChannel.healthDegraded"),
  };

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<ChatChannelEditValues>(() =>
    initialChatChannelEditValues(chatChannel),
  );

  // Rotate Bot Token modal
  const [rotateOpen, setRotateOpen] = useState(false);

  // PROVIDER LABEL — extensible when more providers land
  function providerLabel(p?: string): string {
    if (p === "telegram") return t("triggers.chatChannel.providerTelegram");
    if (p === "slack") return t("triggers.chatChannel.providerSlack");
    if (p === "discord") return t("triggers.chatChannel.providerDiscord");
    return p ?? "-";
  }

  function visualNodeLabel(v?: string): string {
    if (v === "text") return t("triggers.chatChannel.visualNodeText");
    if (v === "photo") return t("triggers.chatChannel.visualNodePhoto");
    return t("triggers.chatChannel.visualNodeAuto");
  }

  function formModeLabel(v?: string): string {
    if (v === "native_modal") return t("triggers.chatChannel.formModeNativeModal");
    if (v === "auto") return t("triggers.chatChannel.formModeAuto");
    return t("triggers.chatChannel.formModeMultiStep");
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      // languageHints JSON 검증 — 잘못된 JSON 은 네트워크 호출 전 차단.
      const parsedHints = parseLanguageHints(editValues.languageHintsJson);
      const rateLimitParsed = Number(editValues.rateLimitPerMinute);
      const patchChatChannel: Record<string, unknown> = {
        provider: chatChannel?.provider ?? "telegram",
        // botToken 은 입력 단계에서 별 path — 본 PATCH 에는 미포함 (single-path).
        // backend 가 PATCH body 의 chatChannel 을 받으면 setupChannel 재호출하지만
        // botToken 없으면 botTokenRef 유지 (mergeExternalConfig).
        uiMapping: {
          formMode: "multi_step",
          visualNode: editValues.visualNode,
          buttonLayout: editValues.buttonLayout,
        },
        rateLimitPerMinute: Number.isFinite(rateLimitParsed)
          ? rateLimitParsed
          : DEFAULT_RATE_LIMIT_PER_MINUTE,
        languageLocale: editValues.languageLocale,
        ...(parsedHints ? { languageHints: parsedHints } : {}),
      };
      // backend mergeExternalConfig 가 chatChannel 전체를 교체하므로 비편집 필드도 동봉
      // 단 botToken 은 미포함 — single-path 정책상 PATCH 로 토큰 변경 불가
      // botTokenRef / secretTokenRef / secretToken 도 미포함 — backend assertChatChannelInputSafe 차단
      await apiClient.patch(`/triggers/${trigger.id}`, {
        chatChannel: patchChatChannel,
      });
    },
    onSuccess: () => {
      toast.success(t("triggers.chatChannel.saveSucceeded"));
      setEditing(false);
      onSaved();
    },
    // 보안(ai-review W): 서버/검증 err.message 원문을 toast 에 노출하지 않는다.
    onError: (err) => {
      toast.error(
        err instanceof LanguageHintsParseError
          ? t("triggers.chatChannel.languageHintsInvalid")
          : t("triggers.chatChannel.saveFailed"),
      );
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async (newBotToken: string) => {
      await apiClient.post(
        `/triggers/${trigger.id}/chat-channel/rotate-bot-token`,
        { newBotToken },
      );
    },
    onSuccess: () => {
      toast.success(t("triggers.chatChannel.rotateBotTokenSucceeded"));
      setRotateOpen(false);
      onSaved();
    },
    onError: () => {
      toast.error(t("triggers.chatChannel.rotateBotTokenFailed"));
    },
  });

  function cancelEdit(): void {
    // cancel 시 미저장 입력값을 원래 값으로 리셋.
    setEditValues(initialChatChannelEditValues(chatChannel));
    saveMutation.reset();
    setEditing(false);
  }

  if (!hasChatChannel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("triggers.chatChannel.section")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("triggers.chatChannel.notConfigured")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          {t("triggers.chatChannel.section")}
        </CardTitle>
        {canEdit && !editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t("triggers.chatChannel.edit")}
          </Button>
        ) : editing ? (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={cancelEdit}
              disabled={saveMutation.isPending}
            >
              {t("triggers.chatChannel.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? t("triggers.chatChannel.saving")
                : t("triggers.chatChannel.save")}
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing ? (
          <>
            {/* Provider · Bot Token · Health 그룹 */}
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.chatChannel.provider")}
              </dt>
              <dd>{providerLabel(chatChannel?.provider)}</dd>
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.chatChannel.botToken")}
              </dt>
              <dd className="flex items-center gap-2">
                <span>
                  {chatChannel?.hasBotToken
                    ? t("triggers.chatChannel.botTokenRegistered")
                    : t("triggers.chatChannel.botTokenMissing")}
                </span>
                {canEdit && chatChannel?.hasBotToken ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRotateOpen(true)}
                  >
                    {t("triggers.chatChannel.rotateBotToken")}
                  </Button>
                ) : null}
              </dd>
              {chatChannel?.botIdentity?.username || chatChannel?.botIdentity?.botId ? (
                <>
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.botIdentity")}
                  </dt>
                  <dd>
                    {chatChannel.botIdentity.username
                      ? `@${chatChannel.botIdentity.username}`
                      : ""}
                    {chatChannel.botIdentity.botId
                      ? ` (id=${chatChannel.botIdentity.botId})`
                      : ""}
                  </dd>
                </>
              ) : (
                <>
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.botIdentity")}
                  </dt>
                  <dd className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.botIdentityNotResolved")}
                  </dd>
                </>
              )}
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.chatChannel.health")}
              </dt>
              <dd className="flex items-center gap-2">
                <Badge variant={healthVariant}>{healthLabel[health]}</Badge>
                {health === "degraded" ? (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.healthDegradedHelp")}
                  </span>
                ) : null}
              </dd>
              {trigger.chatChannelLastError ? (
                <>
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.lastError")}
                  </dt>
                  <dd className="font-mono text-xs">
                    {trigger.chatChannelLastError}
                  </dd>
                </>
              ) : null}
              {trigger.chatChannelSetupAt ? (
                <>
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.setupAt")}
                  </dt>
                  <dd className="text-xs">
                    {formatDate(trigger.chatChannelSetupAt, "datetime")}
                  </dd>
                </>
              ) : null}
              {trigger.chatChannelRotatedAt ? (
                <>
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.rotatedAt")}
                  </dt>
                  <dd className="text-xs">
                    {formatDate(trigger.chatChannelRotatedAt, "datetime")}
                  </dd>
                </>
              ) : null}
            </dl>

            {/* UI Mapping 그룹 */}
            <div className="border-t border-[hsl(var(--border))] pt-3">
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.uiMappingFormMode")}
                </dt>
                <dd>{formModeLabel(chatChannel?.uiMapping?.formMode)}</dd>
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.uiMappingVisualNode")}
                </dt>
                <dd>{visualNodeLabel(chatChannel?.uiMapping?.visualNode)}</dd>
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.uiMappingButtonLayout")}
                </dt>
                <dd>{chatChannel?.uiMapping?.buttonLayout ?? "auto"}</dd>
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.rateLimitPerMinute")}
                </dt>
                <dd>
                  {chatChannel?.rateLimitPerMinute ??
                    DEFAULT_RATE_LIMIT_PER_MINUTE}
                </dd>
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.languageLocale")}
                </dt>
                <dd>
                  {(chatChannel?.languageLocale ?? "ko") === "en"
                    ? t("triggers.chatChannel.languageLocaleEn")
                    : t("triggers.chatChannel.languageLocaleKo")}
                </dd>
              </dl>
            </div>

            {/* languageHints */}
            {chatChannel?.languageHints &&
            Object.keys(chatChannel.languageHints).length > 0 ? (
              <div className="border-t border-[hsl(var(--border))] pt-3">
                <p className="mb-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.languageHints")}
                </p>
                <pre className="overflow-x-auto rounded bg-[hsl(var(--muted))] p-2 text-xs">
                  {JSON.stringify(chatChannel.languageHints, null, 2)}
                </pre>
              </div>
            ) : null}
          </>
        ) : (
          <ChatChannelEditForm values={editValues} onChange={setEditValues} />
        )}

        {/* Rotate Bot Token modal — single-path via rotate API */}
        {rotateOpen ? (
          <RotateBotTokenModal
            pending={rotateMutation.isPending}
            onConfirm={(token) => rotateMutation.mutate(token)}
            onClose={() => setRotateOpen(false)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
