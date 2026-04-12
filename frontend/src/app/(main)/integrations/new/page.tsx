"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  const router = useRouter();
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

  // Reset form defaults whenever the selected auth variant changes. Using
  // `useEffect` (rather than render-time setState) is the React-idiomatic way
  // to sync derived state, at the cost of a single extra render pass.
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
    // `service` is read alongside `variant` — reset when either changes.
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
      toast.success("Integration created");
      router.push(`/integrations/${created.id}`);
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { message?: string; code?: string } };
        message?: string;
      };
      const msg =
        e.response?.data?.message ?? e.message ?? "Failed to create integration";
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
      return integrationsApi.oauthBegin({
        service: serviceType,
        scopes: selectedScopes,
        mode: "new",
        integrationName: name,
        scope,
      });
    },
    onSuccess: ({ authUrl }) => {
      popupRef.current = openOAuthPopup(authUrl);
      setOauthError(null);
      setOauthWaiting(true);
      clearOAuthTimeout();
      // Spec §3.5 — 5 minute timeout for the provider popup to complete.
      oauthTimeoutRef.current = setTimeout(() => {
        setOauthWaiting(false);
        setOauthError("Authorization timed out. Please try again.");
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        toast.error("OAuth timed out — popup did not return within 5 minutes.");
      }, 5 * 60 * 1000);
      toast.message(
        "Continue in the popup. This window will update when you are done.",
      );
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? "Failed to start OAuth");
    },
  });

  // Listen for OAuth popup result. Cleanup always clears the timeout.
  useEffect(() => {
    const handler = (event: MessageEvent<OAuthCallbackPayload>) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth_callback") return;
      clearOAuthTimeout();
      setOauthWaiting(false);
      if (event.data.status === "error") {
        setOauthError(event.data.error ?? "OAuth failed");
        toast.error(event.data.error ?? "OAuth failed");
        return;
      }
      if (event.data.previewToken) {
        setPreviewToken(event.data.previewToken);
        setOauthError(null);
        toast.success("OAuth completed. Continue to save.");
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

  // Spec §3.6 — warn on navigation away while credentials are being entered.
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
    if (!variant) return "Select an authentication type";
    if (!name.trim()) return "Integration name is required";
    const isOAuth = variant.authType === "oauth2";
    if (isOAuth) {
      if (selectedScopes.length === 0) return "Select at least one scope";
      if (!previewToken)
        return "Complete OAuth authorization before continuing";
      return null;
    }
    for (const f of variant.fields) {
      if (f.required) {
        const v = credentials[f.key];
        if (v === undefined || v === null || v === "") {
          return `${f.label} is required`;
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
          <ArrowLeft className="h-4 w-4" /> Back to integrations
        </Link>
        <p className="text-sm">Unknown service type: {serviceType || "—"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to integrations
      </Link>

      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-[hsl(var(--border))] p-3">
          <ServiceIcon type={service.type} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Connect {service.name}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Step {step === "auth" ? "1" : "2"} of 2
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
              toast.error("Integration name is required first");
              return;
            }
            if (selectedScopes.length === 0) {
              toast.error("Select at least one scope");
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
          Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="int-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`My ${service.name}`}
        />
      </div>

      <div>
        <Label>Scope</Label>
        <div className="inline-flex w-full rounded-lg border border-[hsl(var(--border))] p-1">
          {(["personal", "organization"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                scope === opt
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
              onClick={() => setScope(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Organization scope requires Admin role.
        </p>
      </div>

      {service.authVariants.length > 1 && (
        <div>
          <Label>Authentication Type</Label>
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

      {variant?.authType === "oauth2" && service.scopes.length > 0 && (
        <div>
          <Label>OAuth Scopes</Label>
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
                    Recommended
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
              ? "Waiting for the provider popup…"
              : previewToken
                ? "OAuth authorization complete."
                : "Authorize this integration with the provider."}
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
            {previewToken ? "Reauthorize" : `Connect with ${service.name}`}
          </Button>
          {oauthWaiting && (
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              Times out after 5 minutes.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onContinue}>Continue</Button>
      </div>
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
      onTestError((test.error as Error | undefined)?.message ?? "Validation failed");
    } else if (test.isSuccess) {
      onTestError(null);
    }
  }, [skipProbe, test.isError, test.isSuccess, test.error, onTestError]);

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
              ? "Testing credentials..."
              : failed
                ? "Validation failed"
                : "Ready to save"}
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {pending
              ? "Running a preview test against the service registry."
              : failed
                ? message ?? "Check the auth step and try again."
                : `${service.name} "${name}" credentials are ready. Connection will be verified on first use.`}
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back to auth
        </Button>
        <Button onClick={onSave} disabled={saving || pending || failed}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save integration
        </Button>
      </div>
    </div>
  );
}
