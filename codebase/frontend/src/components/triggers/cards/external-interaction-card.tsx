import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { triggersApi, type TriggerDetail } from "@/lib/api/triggers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n";
import { useHasRole } from "@/components/auth/role-gate";
import { SecretRevealBox } from "../secret-reveal-box";
import { isValidNotificationUrl } from "@/lib/utils/url-validation";
import { toast } from "sonner";
import { useCardEditToggle } from "../hooks/use-card-edit-toggle";

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

export function ExternalInteractionCard({
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
  const { editing, setEditing, startEdit, cancelEdit } = useCardEditToggle();
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
      await triggersApi.update(trigger.id, patchBody);
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

  // cancel 시 미저장 입력값을 원래 값으로 리셋 + 직전 실패 상태 초기화
  // (ChatChannelCard.cancelEdit 와 동일 패턴).
  function handleCancel(): void {
    cancelEdit(() => {
      setUrlValue(notification?.url ?? "");
      setEventsValue(new Set(notification?.events ?? []));
      setInteractionEnabled(interaction?.enabled ?? false);
      setStrategy(interaction?.tokenStrategy ?? "per_execution");
      saveMutation.reset();
    });
  }

  async function handleRotateSecret(): Promise<void> {
    if (!window.confirm(t("triggers.externalInteraction.rotateConfirm"))) return;
    try {
      const { secret } = await triggersApi.rotateNotificationSecret(
        trigger.id,
      );
      setRotateResult(secret);
      toast.success(t("triggers.externalInteraction.rotateSucceeded"));
    } catch {
      toast.error(t("triggers.externalInteraction.rotateFailed"));
    }
  }

  async function handleRevokeToken(): Promise<void> {
    if (!window.confirm(t("triggers.externalInteraction.revokeConfirm"))) return;
    try {
      const { token } = await triggersApi.revokeInteractionToken(trigger.id);
      setRevokeResult(token);
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
          <Button size="sm" variant="outline" onClick={startEdit}>
            {t("triggers.externalInteraction.edit")}
          </Button>
        ) : editing ? (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
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
