import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { triggersApi, type TriggerDetail } from "@/lib/api/triggers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { useHasRole } from "@/components/auth/role-gate";
import {
  AuthConfigSelect,
  useAuthConfigs,
  AUTH_CONFIG_TYPE_LABEL_KEYS,
} from "../auth-config-select";
import {
  Loader2,
  Copy,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { getWebhookUrl } from "@/lib/utils/webhook-url";
import { useCardEditToggle } from "../hooks/use-card-edit-toggle";

export function WebhookConfigCard({
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
  const { editing, setEditing, startEdit, cancelEdit } = useCardEditToggle();
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
      await triggersApi.update(trigger.id, body);
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

  function handleCancel() {
    cancelEdit(() => {
      setEndpointPathValue(trigger.endpointPath ?? "");
      setAuthConfigIdValue(trigger.authConfigId ?? null);
    });
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
          <Button size="sm" variant="outline" onClick={startEdit}>
            {t("triggers.detail.edit")}
          </Button>
        )}
        {editing && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
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
