"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/date";
import {
  integrationsApi,
  type IntegrationDto,
  type AuthVariant,
} from "@/lib/api/integrations";
import { prettyAuthType } from "../_shared/service-icons";
import { CredentialsForm } from "../_shared/credentials-form";
import {
  isCafe24Private,
  reauthorizeDisabledReason,
  type ReauthorizeDisabledReason,
} from "@/lib/integrations/reauthorize";
import { type TFunction, type TranslationKey } from "@/lib/i18n";
import { openOAuthPopup } from "./open-oauth-popup";

/** 재인증 버튼을 막는 사유마다 보여 줄 안내 문구. `Record` 라 사유가 늘면 여기서 빠진 키를 타입이 잡는다. */
export const REAUTHORIZE_DISABLED_HINT_KEYS: Record<
  ReauthorizeDisabledReason,
  TranslationKey
> = {
  pending_install: "integrations.reauthorizeDisabledPendingInstall",
  install_timeout: "integrations.reauthorizeDisabledInstallTimeout",
  no_app_url: "integrations.reauthorizeDisabledNoAppUrl",
  makeshop: "integrations.reauthorizeDisabledMakeshop",
};

/**
 * 통합 상세의 보안 탭 — OAuth 통합은 재인증, 그 밖의 통합은 자격 증명 교체.
 *
 * `page.tsx` 에서 옮겼다. Next.js 의 page 파일은 정해진 export 만 가질 수 있어 컴포넌트를 내보내 테스트할 수 없다.
 * Cafe24 Private 재인증은 팝업을 열지 않고 서버가 재설치 요청 표시를 남긴다(`cafe24_private_pending`). 응답을 받으면
 * 안내 토스트를 띄우고 `onChanged` 로 상세를 다시 읽어 재설치 대기 안내(`ReinstallRequestedNotice`)를 띄운다.
 * NERV CLE-INT-MANAGE · CLE-INT-OAUTH, Task CLE-T-NNENG8.
 */
export function SecurityTab({
  integration,
  variant,
  onChanged,
  t,
}: {
  integration: IntegrationDto;
  variant: AuthVariant | undefined;
  onChanged: () => void;
  t: TFunction;
}) {
  const isOAuth = integration.authType === "oauth2";
  const disabledReason = reauthorizeDisabledReason(integration);
  const disabledHint =
    disabledReason === null
      ? undefined
      : t(REAUTHORIZE_DISABLED_HINT_KEYS[disabledReason]);

  const reauthorize = useMutation({
    mutationFn: () => integrationsApi.reauthorize(integration.id),
    onSuccess: (res) => {
      if ("authUrl" in res && res.authUrl) {
        openOAuthPopup(res.authUrl);
        toast.success(t("integrations.reauthorizeOpened"));
      } else if ("mode" in res && res.mode === "cafe24_private_pending") {
        toast.info(t("integrations.cafe24ReinstallRequestedTitle"));
        onChanged();
      } else {
        toast.success(t("integrations.integrationReset"));
        onChanged();
      }
    },
    onError: () => toast.error(t("integrations.reauthorizeFailedToast")),
  });

  const [rotateOpen, setRotateOpen] = useState(false);
  const [newCredentials, setNewCredentials] = useState<Record<string, unknown>>({});

  const rotate = useMutation({
    mutationFn: () => integrationsApi.rotate(integration.id, newCredentials),
    onSuccess: () => {
      toast.success(t("integrations.credentialsRotated"));
      setRotateOpen(false);
      setNewCredentials({});
      onChanged();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? t("integrations.rotateFailedDefault"));
    },
  });

  return (
    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
      <section>
        <h3 className="text-sm font-semibold">{t("integrations.authenticationSection")}</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {prettyAuthType(integration.authType)}
        </p>
      </section>

      {isOAuth ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("integrations.reauthorizeSection")}</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {t(
              isCafe24Private(integration)
                ? "integrations.reauthorizeHintCafe24Private"
                : "integrations.reauthorizeHint",
            )}
          </p>
          <Button
            variant="outline"
            onClick={() => reauthorize.mutate()}
            disabled={reauthorize.isPending || disabledReason !== null}
            title={disabledHint}
          >
            {reauthorize.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t("integrations.reauthorizeBtn")}
          </Button>
          {disabledHint && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {disabledHint}
            </p>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("integrations.rotateSection")}</h3>
            {!rotateOpen && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotateOpen(true)}
              >
                {t("integrations.rotateBtn")}
              </Button>
            )}
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {t("integrations.rotateHint")}
          </p>
          {rotateOpen && variant && (
            <div className="space-y-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
              <CredentialsForm
                variant={variant}
                values={newCredentials}
                secretsMasked
                onChange={(k, v) =>
                  setNewCredentials({ ...newCredentials, [k]: v })
                }
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRotateOpen(false);
                    setNewCredentials({});
                  }}
                >
                  {t("integrations.cancelBtn")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => rotate.mutate()}
                  disabled={rotate.isPending || !hasInput(newCredentials)}
                >
                  {rotate.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("integrations.saveBtn")}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("integrations.lastRotatedLabel")}
        </div>
        <div className="mt-1 text-sm">
          {integration.lastRotatedAt
            ? formatDate(integration.lastRotatedAt, "datetime")
            : t("integrations.never")}
        </div>
      </section>
    </div>
  );
}

function hasInput(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some(
    (v) => v !== undefined && v !== null && v !== "",
  );
}
