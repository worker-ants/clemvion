"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import {
  integrationsApi,
  type AuthVariant,
  type IntegrationScope,
  type ServiceDefinition,
} from "@/lib/api/integrations";
import { ServiceIcon } from "../_shared/service-icons";
import { CredentialsForm } from "../_shared/credentials-form";
import { useT, type TFunction } from "@/lib/i18n";

interface OAuthCallbackPayload {
  type: "oauth_callback";
  status: "success" | "error";
  mode?: "new" | "reauthorize" | "request_scopes";
  provider?: string;
  integrationId?: string | null;
  previewToken?: string | null;
  error?: string | null;
}

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
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

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

  const createMutation = useMutation({
    mutationFn: async () => {
      const isOAuth = variant?.authType === "oauth2";
      const payload = {
        serviceType,
        name,
        authType: variant!.authType,
        scope,
        credentials: isOAuth
          ? { scopes: selectedScopes }
          : credentials,
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
      const e = err as {
        response?: { data?: { message?: string; code?: string } };
        message?: string;
      };
      const msg =
        e.response?.data?.message ?? e.message ?? t("integrations.integrationCreateFailedDefault");
      toast.error(msg);
    },
  });

  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const clearOAuthTimeout = () => {
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current);
      oauthTimeoutRef.current = null;
    }
  };

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
      return integrationsApi.oauthBegin({
        service: serviceType,
        scopes: selectedScopes,
        mode: "new",
        integrationName: name,
        scope,
        ...cafe24Extra,
      });
    },
    onSuccess: ({ authUrl }) => {
      popupRef.current = openOAuthPopup(authUrl);
      setOauthError(null);
      setOauthWaiting(true);
      clearOAuthTimeout();
      oauthTimeoutRef.current = setTimeout(() => {
        setOauthWaiting(false);
        setOauthError(t("integrations.oauthTimedOutShort"));
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        toast.error(t("integrations.oauthTimedOutMessage"));
      }, 5 * 60 * 1000);
      toast.message(t("integrations.oauthContinueInPopup"));
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? t("integrations.oauthStartFailed"));
    },
  });

  useEffect(() => {
    const handler = (event: MessageEvent<OAuthCallbackPayload>) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth_callback") return;
      clearOAuthTimeout();
      setOauthWaiting(false);
      if (event.data.status === "error") {
        const msg = event.data.error ?? t("integrations.oauthFailedShort");
        setOauthError(msg);
        toast.error(msg);
        return;
      }
      if (event.data.previewToken) {
        setPreviewToken(event.data.previewToken);
        setOauthError(null);
        toast.success(t("integrations.oauthCompletedToast"));
        goToStep("test");
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      clearOAuthTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const isOAuth = variant?.authType === "oauth2";
    const hasUserInput =
      (!isOAuth && Object.values(credentials).some((v) => v)) ||
      name.trim().length > 0 ||
      oauthWaiting;
    if (!hasUserInput) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [variant, credentials, name, oauthWaiting]);

  const goToStep = (next: Step) => {
    const qp = new URLSearchParams();
    qp.set("service", serviceType);
    qp.set("step", next);
    router.replace(`/integrations/new?${qp.toString()}`);
  };

  const validate = (): string | null => {
    if (!variant) return t("integrations.selectAuthType");
    if (!name.trim()) return t("integrations.nameRequired");
    const isOAuth = variant.authType === "oauth2";
    if (isOAuth) {
      // Cafe24 begin-time validation — mirror backend OAuth begin checks
      // so users hit them locally before the popup opens.
      if (serviceType === "cafe24") {
        const mallId = String(credentials.mall_id ?? "").trim();
        if (!/^[a-z0-9-]{3,50}$/.test(mallId)) {
          return "Mall ID must be 3-50 lowercase letters, digits, or hyphens.";
        }
        const appType = credentials.app_type as
          | "public"
          | "private"
          | undefined;
        if (appType !== "public" && appType !== "private") {
          return "Cafe24 app type must be 'public' or 'private'.";
        }
        if (appType === "private") {
          if (!String(credentials.client_id ?? "").trim()) {
            return "Private apps require client_id.";
          }
          if (!String(credentials.client_secret ?? "").trim()) {
            return "Private apps require client_secret.";
          }
        }
      }
      if (selectedScopes.length === 0) return t("integrations.selectAtLeastOneScope");
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
            {t("integrations.stepCounter", { current: step === "auth" ? 1 : 2 })}
          </p>
        </div>
      </div>

      {step === "auth" && (
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
          onConnect={() => {
            if (!name.trim()) {
              toast.error(t("integrations.nameRequired"));
              return;
            }
            if (selectedScopes.length === 0) {
              toast.error(t("integrations.selectAtLeastOneScope"));
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

interface AuthStepProps {
  service: ServiceDefinition;
  variant: AuthVariant | undefined;
  variantIndex: number;
  setVariantIndex: (i: number) => void;
  name: string;
  setName: (s: string) => void;
  scope: IntegrationScope;
  setScope: (s: IntegrationScope) => void;
  credentials: Record<string, unknown>;
  setCredentials: (c: Record<string, unknown>) => void;
  selectedScopes: string[];
  setSelectedScopes: (s: string[]) => void;
  previewToken: string | null;
  oauthWaiting: boolean;
  oauthError: string | null;
  onConnect: () => void;
  connecting: boolean;
  onContinue: () => void;
  t: TFunction;
}

function AuthStep({
  service,
  variant,
  variantIndex,
  setVariantIndex,
  name,
  setName,
  scope,
  setScope,
  credentials,
  setCredentials,
  selectedScopes,
  setSelectedScopes,
  previewToken,
  oauthWaiting,
  oauthError,
  onConnect,
  connecting,
  onContinue,
  t,
}: AuthStepProps) {
  const isOAuth = variant?.authType === "oauth2";
  const toggleScope = (value: string) => {
    setSelectedScopes(
      selectedScopes.includes(value)
        ? selectedScopes.filter((s) => s !== value)
        : [...selectedScopes, value],
    );
  };

  return (
    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
      <div>
        <Label htmlFor="int-name">
          {t("integrations.nameLabel")} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="int-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("integrations.namePlaceholderWithService", { name: service.name })}
        />
      </div>

      <div>
        <Label>{t("integrations.scopeChangeTitle")}</Label>
        <div className="inline-flex w-full rounded-lg border border-[hsl(var(--border))] p-1">
          {(["personal", "organization"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                scope === opt
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
              onClick={() => setScope(opt)}
            >
              {opt === "personal"
                ? t("integrations.scopePersonal")
                : t("integrations.scopeOrganization")}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {t("integrations.scopeHint")}
        </p>
      </div>

      {service.authVariants.length > 1 && (
        <div>
          <Label>{t("integrations.authTypeLabel2")}</Label>
          <div className="flex flex-wrap gap-2">
            {service.authVariants.map((v, i) => (
              <button
                key={v.authType}
                type="button"
                onClick={() => setVariantIndex(i)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  variantIndex === i
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {variant && !isOAuth && (
        <CredentialsForm
          variant={variant}
          values={credentials}
          onChange={(key, value) =>
            setCredentials({ ...credentials, [key]: value })
          }
        />
      )}

      {variant?.authType === "oauth2" && service.type === "cafe24" && (
        <Cafe24ExtraFields
          credentials={credentials}
          setCredentials={setCredentials}
        />
      )}

      {variant?.authType === "oauth2" && service.scopes.length > 0 && (
        <div>
          <Label>{t("integrations.oauthScopesLabel")}</Label>
          {service.type === "cafe24" && (
            <div
              role="note"
              className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {t("integrations.cafe24ScopeWarning")}
            </div>
          )}
          <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3">
            {service.scopes.map((s) => (
              <label
                key={s.value}
                className="flex cursor-pointer items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(s.value)}
                  onChange={() => toggleScope(s.value)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {s.value}
                  </div>
                </div>
                {s.recommended && (
                  <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {t("integrations.recommendedBadge")}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {isOAuth && (
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
          <div className="mb-2 text-sm font-medium">
            {oauthWaiting
              ? t("integrations.waitingPopup")
              : previewToken
                ? t("integrations.oauthComplete")
                : t("integrations.authorizePrompt")}
          </div>
          {oauthError && (
            <div className="mb-2 text-xs text-red-600 dark:text-red-400">
              {oauthError}
            </div>
          )}
          <Button
            variant={previewToken ? "outline" : "default"}
            onClick={onConnect}
            disabled={connecting || oauthWaiting}
          >
            {connecting || oauthWaiting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {previewToken
              ? t("integrations.reauthorizeBtn2")
              : t("integrations.connectWith", { name: service.name })}
          </Button>
          {oauthWaiting && (
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              {t("integrations.timesOutHint")}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onContinue}>{t("integrations.continueBtn")}</Button>
      </div>
    </div>
  );
}

/**
 * Cafe24-only extra fields for OAuth2 — Mall ID + App type (+ private-app
 * client_id / client_secret). Stored on the same `credentials` map so the
 * page-level oauthBegin handler can pluck them out at the call site.
 * spec/2-navigation/4-integration.md §3.2 (OAuth2 Cafe24 흐름).
 */
function Cafe24ExtraFields({
  credentials,
  setCredentials,
}: {
  credentials: Record<string, unknown>;
  setCredentials: (c: Record<string, unknown>) => void;
}) {
  const set = (key: string, value: unknown) =>
    setCredentials({ ...credentials, [key]: value });
  const mallId = String(credentials.mall_id ?? "");
  const appType =
    (credentials.app_type as "public" | "private" | undefined) ?? "public";
  const clientId = String(credentials.client_id ?? "");
  const clientSecret = String(credentials.client_secret ?? "");

  return (
    <div className="space-y-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-4">
      <div>
        <Label htmlFor="cafe24-mall-id">
          Mall ID <span className="text-red-500">*</span>
        </Label>
        <Input
          id="cafe24-mall-id"
          placeholder="myshop"
          value={mallId}
          onChange={(e) => set("mall_id", e.target.value.trim())}
          // `-` is escaped because browsers compile the HTML5 `pattern`
          // attribute with the ES2024 `v` flag, which rejects an
          // unescaped hyphen inside a character class. Same semantic as
          // the backend regex /^[a-z0-9-]{3,50}$/.
          pattern="^[a-z0-9\-]{3,50}$"
        />
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Lower-case letters, digits, and hyphens, 3–50 chars. Forms the
          base URL <code>https://{"{mall_id}"}.cafe24api.com</code>.
        </p>
      </div>

      <div>
        <Label>
          App Type <span className="text-red-500">*</span>
        </Label>
        <div className="inline-flex w-full rounded-lg border border-[hsl(var(--border))] p-1">
          {(["public", "private"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                appType === opt
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
              onClick={() => set("app_type", opt)}
            >
              {opt === "public" ? "Public (App Store)" : "Private (Self-issued)"}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          <strong>Public</strong> — official Cafe24 app store app (server-side
          credentials). <strong>Private</strong> — paste the
          client_id / client_secret from your shop&apos;s admin.
        </p>
      </div>

      {appType === "private" && (
        <>
          <div>
            <Label htmlFor="cafe24-client-id">
              Client ID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cafe24-client-id"
              value={clientId}
              onChange={(e) => set("client_id", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cafe24-client-secret">
              Client Secret <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cafe24-client-secret"
              type="password"
              autoComplete="new-password"
              value={clientSecret}
              onChange={(e) => set("client_secret", e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function openOAuthPopup(url: string): Window | null {
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  return window.open(
    url,
    "integration-oauth",
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
  );
}

interface TestStepProps {
  service: ServiceDefinition;
  name: string;
  serviceType: string;
  authType: string;
  credentials: Record<string, unknown>;
  skipProbe: boolean;
  savedError: string | null;
  onTestError: (err: string | null) => void;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  t: TFunction;
}

function TestStep({
  service,
  name,
  serviceType,
  authType,
  credentials,
  skipProbe,
  savedError,
  onTestError,
  saving,
  onBack,
  onSave,
  t,
}: TestStepProps) {
  const test = useQuery({
    queryKey: ["integrations", "preview-test", serviceType, authType],
    enabled: !skipProbe,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await integrationsApi.previewTest({
        serviceType,
        authType,
        credentials,
      });
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
  });

  useEffect(() => {
    if (!skipProbe && test.isError) {
      onTestError((test.error as Error | undefined)?.message ?? t("integrations.validationFailed"));
    } else if (test.isSuccess) {
      onTestError(null);
    }
  }, [skipProbe, test.isError, test.isSuccess, test.error, onTestError, t]);

  const pending = !skipProbe && test.isPending;
  const failed = (!skipProbe && test.isError) || !!savedError;
  const message = savedError
    ? savedError
    : test.isError
      ? (test.error as Error | undefined)?.message
      : null;

  return (
    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
      <div className="flex items-center gap-3">
        {pending ? (
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        ) : failed ? (
          <XCircle className="h-8 w-8 text-red-500" />
        ) : (
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        )}
        <div>
          <h2 className="text-lg font-semibold">
            {pending
              ? t("integrations.testingCredentials")
              : failed
                ? t("integrations.validationFailed")
                : t("integrations.readyToSave")}
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {pending
              ? t("integrations.runningProbe")
              : failed
                ? message ?? t("integrations.checkAuthRetry")
                : t("integrations.readyMessage", { service: service.name, name })}
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          {t("integrations.backToAuth")}
        </Button>
        <Button onClick={onSave} disabled={saving || pending || failed}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("integrations.saveIntegration")}
        </Button>
      </div>
    </div>
  );
}
