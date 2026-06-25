"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  integrationsApi,
  type AuthVariant,
  type IntegrationScope,
  type ServiceDefinition,
} from "@/lib/api/integrations";
import { getIntegrationErrorI18nKey } from "@/lib/api/integration-error-codes";
import {
  useCafe24MallIdPrecheck,
  CAFE24_MALL_ID_PATTERN,
} from "@/lib/integrations/use-cafe24-mall-id-precheck";
import { useOauthPopupReturn } from "@/lib/integrations/use-oauth-popup-return";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { ServiceIcon } from "../_shared/service-icons";
import { useT, type TranslationKey } from "@/lib/i18n";
import { AuthStep } from "./_components/auth-step";
import { TestStep } from "./_components/test-step";
import { Cafe24PrivatePendingStep } from "./_components/cafe24-private-pending-step";
import { MakeshopPendingStep } from "./_components/makeshop-pending-step";

type Step = "auth" | "test";

export default function NewIntegrationPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const serviceType = params.get("service") ?? "";
  const rawStep = params.get("step") ?? "auth";
  const step: Step = rawStep === "test" ? "test" : "auth";

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["integrations", "services"],
    queryFn: () => integrationsApi.services(),
    staleTime: 5 * 60 * 1000,
  });

  const service: ServiceDefinition | undefined = useMemo(
    () => services?.find((s) => s.type === serviceType),
    [services, serviceType],
  );

  const [variantIndex, setVariantIndex] = useState(0);
  const variant: AuthVariant | undefined = service?.authVariants[variantIndex];

  const [name, setName] = useState("");
  const [scope, setScope] = useState<IntegrationScope>("personal");
  const [credentials, setCredentials] = useState<Record<string, unknown>>({});
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [testError, setTestError] = useState<string | null>(null);

  const goToStep = (next: Step) => {
    const qp = new URLSearchParams();
    qp.set("service", serviceType);
    qp.set("step", next);
    router.replace(`/integrations/new?${qp.toString()}`);
  };

  // OAuth 팝업 복귀 상태 기계(§3.5) — message handler·popup.closed 폴링·5분
  // 타임아웃·previewToken 을 훅으로 분리. 성공 시 test 단계로 이동.
  const {
    oauthWaiting,
    oauthError,
    previewToken,
    setPreviewToken,
    startPopup,
  } = useOauthPopupReturn({ t, onAuthorized: () => goToStep("test") });

  const [privatePending, setPrivatePending] = useState<{
    integrationId: string;
    appUrl: string;
    callbackUrl: string;
  } | null>(null);
  // MakeShop install-first pending — appUrl/callbackUrl 등록 안내 + 설치 폴링.
  const [makeshopPending, setMakeshopPending] = useState<{
    integrationId: string;
    appUrl: string;
    callbackUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!variant) {
      setCredentials({});
      setSelectedScopes([]);
      return;
    }
    const nextCreds: Record<string, unknown> = {};
    for (const f of variant.fields) {
      if (f.default !== undefined) nextCreds[f.key] = f.default;
    }
    setCredentials(nextCreds);
    setSelectedScopes(
      variant.authType === "oauth2" && service
        ? service.scopes.filter((s) => s.recommended).map((s) => s.value)
        : [],
    );
    setPreviewToken(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  // Cafe24 mall_id 사전 중복 감지 — 350ms debounce + AbortController + state 묶음을
  // `useCafe24MallIdPrecheck` 훅으로 분리해 page.tsx 응집도 향상 (ai-review W9,
  // 2026-05-16). spec/2-navigation/4-integration.md §9.2.
  const isCafe24OAuth =
    variant?.authType === "oauth2" && serviceType === "cafe24";
  const cafe24MallIdInput = String(credentials.mall_id ?? "").trim();
  const { conflict: cafe24Conflict, loading: cafe24PrecheckLoading } =
    useCafe24MallIdPrecheck(cafe24MallIdInput, isCafe24OAuth);

  /**
   * 에러 토스트 — 도메인-aware 코드 매핑 (`INTEGRATION_ERROR_CODE_TO_I18N`) 에
   * 등록된 backend 코드는 한글 i18n 메시지를 primary 로, backend 영문 message 는
   * 괄호 안 보조 정보로 노출. 매핑 없는 코드는 backend message 우선.
   * 사용자가 "괄호 등을 이용해서 보조 안내로 사용" 지시 (2026-05-16, ai-review W11).
   */
  const formatErrorToast = (
    err: unknown,
    fallbackKey: TranslationKey,
  ): string => {
    const e = err as {
      response?: { data?: { message?: string; code?: string } };
      message?: string;
    };
    const backendCode = e.response?.data?.code;
    const backendMessage = e.response?.data?.message ?? e.message;
    const mappedKey = getIntegrationErrorI18nKey(backendCode);
    if (mappedKey) {
      const primary = t(mappedKey);
      return backendMessage ? `${primary} (${backendMessage})` : primary;
    }
    return backendMessage ?? t(fallbackKey);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const isOAuth = variant?.authType === "oauth2";
      const payload = {
        serviceType,
        name,
        authType: variant!.authType,
        scope,
        credentials: isOAuth ? { scopes: selectedScopes } : credentials,
        previewToken: isOAuth ? (previewToken ?? undefined) : undefined,
      };
      return integrationsApi.create(payload);
    },
    onSuccess: (created) => {
      toast.success(t("integrations.integrationCreatedToast"));
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      router.push(`/integrations/${created.id}`);
    },
    onError: (err: unknown) => {
      toast.error(
        formatErrorToast(err, "integrations.integrationCreateFailedDefault"),
      );
    },
  });

  const oauthBeginMutation = useMutation({
    mutationFn: async () => {
      // Cafe24 needs mall_id + app_type (and private-app credentials) on
      // the begin call so the backend can build the mall-specific
      // authorize URL and persist them on the OAuth state row.
      // spec/2-navigation/4-integration.md §3.2 / §9.2.
      const cafe24Extra =
        serviceType === "cafe24"
          ? {
              mallId: String(credentials.mall_id ?? "").trim(),
              appType:
                (credentials.app_type as "public" | "private" | undefined) ??
                "public",
              ...(credentials.app_type === "private"
                ? {
                    clientId: String(credentials.client_id ?? ""),
                    clientSecret: String(credentials.client_secret ?? ""),
                  }
                : {}),
            }
          : {};
      // MakeShop is confidential-client install-first — pass client_id /
      // client_secret at begin (shop_uid is learned at install, NOT here).
      // Backend reads body.clientId / body.clientSecret (same OAuthBeginDto
      // fields cafe24 Private uses). spec/2-navigation/4-integration.md §5.9.
      const makeshopExtra =
        serviceType === "makeshop"
          ? {
              clientId: String(credentials.client_id ?? ""),
              clientSecret: String(credentials.client_secret ?? ""),
            }
          : {};
      return integrationsApi.oauthBegin({
        service: serviceType,
        scopes: selectedScopes,
        mode: "new",
        integrationName: name,
        scope,
        ...cafe24Extra,
        ...makeshopExtra,
      });
    },
    onSuccess: (result) => {
      if ("mode" in result && result.mode === "cafe24_private_pending") {
        setPrivatePending({
          integrationId: result.integrationId,
          appUrl: result.appUrl,
          callbackUrl: result.callbackUrl,
        });
        queryClient.invalidateQueries({ queryKey: ["integrations"] });
        return;
      }
      if ("mode" in result && result.mode === "makeshop_pending_install") {
        setMakeshopPending({
          integrationId: result.integrationId,
          appUrl: result.appUrl,
          callbackUrl: result.callbackUrl,
        });
        queryClient.invalidateQueries({ queryKey: ["integrations"] });
        return;
      }
      if (!("authUrl" in result)) return;
      startPopup(result.authUrl);
    },
    onError: (err: unknown) => {
      toast.error(formatErrorToast(err, "integrations.oauthStartFailed"));
    },
  });

  // 이탈 가드(§3.6) — 미저장 입력이 있으면 브라우저 이탈 시 네이티브 확인.
  const isOAuth = variant?.authType === "oauth2";
  const hasUserInput =
    (!isOAuth && Object.values(credentials).some((v) => v)) ||
    name.trim().length > 0 ||
    oauthWaiting;
  useUnsavedChangesWarning(hasUserInput);

  const validate = (): string | null => {
    if (!variant) return t("integrations.selectAuthType");
    if (!name.trim()) return t("integrations.nameRequired");
    const isOAuthVariant = variant.authType === "oauth2";
    if (isOAuthVariant) {
      // Cafe24 begin-time validation — mirror backend OAuth begin checks
      // so users hit them locally before the popup opens.
      if (serviceType === "cafe24") {
        const mallId = String(credentials.mall_id ?? "").trim();
        if (!CAFE24_MALL_ID_PATTERN.test(mallId)) {
          return t("integrations.cafe24ValidateMallIdPattern");
        }
        const appType = credentials.app_type as
          | "public"
          | "private"
          | undefined;
        if (appType !== "public" && appType !== "private") {
          return t("integrations.cafe24ValidateAppType");
        }
        if (appType === "private") {
          if (!String(credentials.client_id ?? "").trim()) {
            return t("integrations.cafe24ValidatePrivateClientIdRequired");
          }
          if (!String(credentials.client_secret ?? "").trim()) {
            return t("integrations.cafe24ValidatePrivateClientSecretRequired");
          }
        }
      }
      if (serviceType === "makeshop") {
        if (!String(credentials.client_id ?? "").trim()) {
          return t("integrations.makeshopValidateClientIdRequired");
        }
        if (!String(credentials.client_secret ?? "").trim()) {
          return t("integrations.makeshopValidateClientSecretRequired");
        }
      }
      if (selectedScopes.length === 0)
        return t("integrations.selectAtLeastOneScope");
      if (!previewToken) return t("integrations.completeOauth");
      return null;
    }
    for (const f of variant.fields) {
      if (f.required) {
        const v = credentials[f.key];
        if (v === undefined || v === null || v === "") {
          return t("integrations.fieldRequired", { label: f.label });
        }
      }
    }
    return null;
  };

  if (servicesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="space-y-4">
        <Link
          href="/integrations"
          className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" /> {t("integrations.backToList")}
        </Link>
        <p className="text-sm">
          {t("integrations.unknownService", { type: serviceType || "—" })}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" /> {t("integrations.backToList")}
      </Link>

      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-[hsl(var(--border))] p-3">
          <ServiceIcon type={service.type} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {t("integrations.connectWith", { name: service.name })}
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("integrations.stepCounter", {
              current: step === "auth" ? 1 : 2,
            })}
          </p>
        </div>
      </div>

      {step === "auth" && !privatePending && !makeshopPending && (
        <AuthStep
          service={service}
          variant={variant}
          variantIndex={variantIndex}
          setVariantIndex={setVariantIndex}
          name={name}
          setName={setName}
          scope={scope}
          setScope={setScope}
          credentials={credentials}
          setCredentials={setCredentials}
          selectedScopes={selectedScopes}
          setSelectedScopes={setSelectedScopes}
          previewToken={previewToken}
          oauthWaiting={oauthWaiting}
          oauthError={oauthError}
          cafe24Conflict={cafe24Conflict}
          cafe24PrecheckLoading={cafe24PrecheckLoading}
          onConnect={() => {
            if (!name.trim()) {
              toast.error(t("integrations.nameRequired"));
              return;
            }
            if (selectedScopes.length === 0) {
              toast.error(t("integrations.selectAtLeastOneScope"));
              return;
            }
            if (serviceType === "makeshop") {
              if (!String(credentials.client_id ?? "").trim()) {
                toast.error(t("integrations.makeshopValidateClientIdRequired"));
                return;
              }
              if (!String(credentials.client_secret ?? "").trim()) {
                toast.error(
                  t("integrations.makeshopValidateClientSecretRequired"),
                );
                return;
              }
            }
            // 사전 감지로 중복이 이미 잡혔으면 backend 왕복 자체를 막는다.
            // backend 도 동일한 가드를 가지지만 사용자 입장에선 toast 만
            // 보고 OAuth 흐름이 시작 안 되니 inline 배너가 더 명확.
            if (cafe24Conflict?.conflict) {
              toast.error(t("integrations.cafe24DuplicateMallToast"));
              return;
            }
            oauthBeginMutation.mutate();
          }}
          connecting={oauthBeginMutation.isPending}
          onContinue={() => {
            const err = validate();
            if (err) {
              toast.error(err);
              return;
            }
            setTestError(null);
            goToStep("test");
          }}
          t={t}
        />
      )}

      {privatePending && (
        <Cafe24PrivatePendingStep
          appUrl={privatePending.appUrl}
          callbackUrl={privatePending.callbackUrl}
          integrationId={privatePending.integrationId}
          t={t}
        />
      )}

      {makeshopPending && (
        <MakeshopPendingStep
          appUrl={makeshopPending.appUrl}
          callbackUrl={makeshopPending.callbackUrl}
          integrationId={makeshopPending.integrationId}
          t={t}
        />
      )}

      {step === "test" && variant && (
        <TestStep
          service={service}
          name={name}
          serviceType={serviceType}
          authType={variant.authType}
          credentials={
            variant.authType === "oauth2"
              ? { scopes: selectedScopes, __has_preview: !!previewToken }
              : credentials
          }
          skipProbe={variant.authType === "oauth2"}
          savedError={testError}
          onTestError={setTestError}
          saving={createMutation.isPending}
          onBack={() => goToStep("auth")}
          onSave={() => createMutation.mutate()}
          t={t}
        />
      )}
    </div>
  );
}
