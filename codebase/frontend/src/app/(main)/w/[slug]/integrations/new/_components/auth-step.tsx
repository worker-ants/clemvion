"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import type {
  AuthVariant,
  Cafe24PrecheckResult,
  IntegrationScope,
  ServiceDefinition,
} from "@/lib/api/integrations";
import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";
import { useWorkspaceSlug } from "@/lib/workspace/use-workspace-slug";
import { buildWorkspaceHref } from "@/lib/workspace/href";
import { CredentialsForm } from "../../_shared/credentials-form";
import {
  ApprovalRequiredBadge,
  RestrictedScopeNotice,
} from "@/components/integrations/approval-required-badge";

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
  cafe24Conflict: Cafe24PrecheckResult | null;
  cafe24PrecheckLoading: boolean;
  onConnect: () => void;
  connecting: boolean;
  onContinue: () => void;
  t: TFunction;
}

export function AuthStep({
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
  cafe24Conflict,
  cafe24PrecheckLoading,
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
          placeholder={t("integrations.namePlaceholderWithService", {
            name: service.name,
          })}
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
          publicAppAvailable={service.meta?.publicAppAvailable !== false}
          conflict={cafe24Conflict}
          precheckLoading={cafe24PrecheckLoading}
        />
      )}

      {variant?.authType === "oauth2" && service.type === "makeshop" && (
        <MakeshopExtraFields
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
                {s.requiresApproval && <ApprovalRequiredBadge t={t} />}
                {s.recommended && (
                  <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {t("integrations.recommendedBadge")}
                  </span>
                )}
              </label>
            ))}
          </div>
          <RestrictedScopeNotice
            count={
              service.scopes.filter(
                (s) => s.requiresApproval && selectedScopes.includes(s.value),
              ).length
            }
            t={t}
          />
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
            // Cafe24 사전 중복 감지 — conflict 가 발견된 mall_id 로는 OAuth
            // 진입 자체를 막는다. 사용자가 mall_id 를 다른 값으로 바꾸거나
            // 기존 통합을 삭제하지 않는 한 Connect 비활성. precheck 가
            // 350ms debounce 후 fetching 중인 동안에도 Connect 를 비활성화해
            // "사전 감지 결과를 보기 전에 OAuth 시작" race 를 막는다.
            // backend 가드는 backstop 으로 살아있어 우회 시도도 안전.
            disabled={
              connecting ||
              oauthWaiting ||
              cafe24PrecheckLoading ||
              cafe24Conflict?.conflict === true
            }
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
  publicAppAvailable,
  conflict,
  precheckLoading,
}: {
  credentials: Record<string, unknown>;
  setCredentials: (c: Record<string, unknown>) => void;
  /** False when server's CAFE24_CLIENT_* env vars are unset → only Private. */
  publicAppAvailable: boolean;
  /** Cafe24 mall_id 사전 중복 감지 결과 (null 이면 미감지 / 진행 중). */
  conflict: Cafe24PrecheckResult | null;
  /** debounce 호출 중 표시용 (배너 자리 안정화). */
  precheckLoading: boolean;
}) {
  // `t` 를 prop 으로 받지 않고 useT 를 직접 호출 — 다른 컴포넌트(`AuthStep` 등)
  // 와의 일관성. ai-review WARNING #10 (2026-05-16) 조치.
  const t = useT();
  const slug = useWorkspaceSlug();
  const set = (key: string, value: unknown) =>
    setCredentials({ ...credentials, [key]: value });
  const mallId = String(credentials.mall_id ?? "");
  // When Public isn't usable on this deployment, force the form to Private
  // and never even render the toggle so the user can't accidentally pick a
  // dead-end option. Default to "public" only if the deployment supports it.
  const rawAppType = credentials.app_type as "public" | "private" | undefined;
  const appType: "public" | "private" = !publicAppAvailable
    ? "private"
    : (rawAppType ?? "public");
  // When the deployment forbids Public, coerce the credentials state to
  // "private" exactly once. Done in an effect (not during render) so we
  // don't violate React's "no setState during render" rule.
  useEffect(() => {
    if (!publicAppAvailable && rawAppType !== "private") {
      set("app_type", "private");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicAppAvailable, rawAppType]);
  const clientId = String(credentials.client_id ?? "");
  const clientSecret = String(credentials.client_secret ?? "");
  const appTypeOptions = publicAppAvailable
    ? (["public", "private"] as const)
    : (["private"] as const);

  // 상태별 안내 메시지 분기 — connected 는 가장 강한 차단, pending_install
  // 은 install 진행 중 안내, expired/error 는 정리 후 재등록 안내.
  // spec/2-navigation/4-integration.md §9.2 Rationale "precheck endpoint".
  const conflictDescKey: TranslationKey | null = !conflict?.conflict
    ? null
    : conflict.status === "pending_install"
      ? "integrations.cafe24DuplicateMallPendingDesc"
      : conflict.status === "expired"
        ? "integrations.cafe24DuplicateMallExpiredDesc"
        : conflict.status === "error"
          ? "integrations.cafe24DuplicateMallErrorDesc"
          : "integrations.cafe24DuplicateMallConnectedDesc";

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
          aria-invalid={conflict?.conflict ? true : undefined}
          aria-describedby={
            conflict?.conflict ? "cafe24-mall-dup-banner" : undefined
          }
        />
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Lower-case letters, digits, and hyphens, 3–50 chars. Forms the base
          URL <code>https://{"{mall_id}"}.cafe24api.com</code>.
        </p>
        {/* 사전 중복 감지 inline 배너 — precheck endpoint 응답에 따라
            상태별 안내 + 기존 통합으로 가는 deep link 노출. */}
        {conflict?.conflict && conflictDescKey && (
          <div
            id="cafe24-mall-dup-banner"
            role="alert"
            className="mt-2 flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              aria-hidden
            />
            <div className="space-y-1.5">
              <div className="font-semibold">
                {t("integrations.cafe24DuplicateMallTitle")}
              </div>
              <div>{t(conflictDescKey)}</div>
              {conflict.existingIntegrationId && (
                <Link
                  href={buildWorkspaceHref(
                    slug,
                    `/integrations/${conflict.existingIntegrationId}`,
                  )}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                >
                  {t("integrations.cafe24DuplicateMallViewExisting")}
                  {conflict.existingName ? ` — ${conflict.existingName}` : ""}
                </Link>
              )}
            </div>
          </div>
        )}
        {precheckLoading && !conflict?.conflict && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t("integrations.cafe24DuplicateMallChecking")}
          </p>
        )}
      </div>

      <div>
        <Label>
          App Type <span className="text-red-500">*</span>
        </Label>
        <div className="inline-flex w-full rounded-lg border border-[hsl(var(--border))] p-1">
          {appTypeOptions.map((opt) => (
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
              {opt === "public"
                ? "Public (App Store)"
                : "Private (Self-issued)"}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {publicAppAvailable ? (
            <>
              <strong>Public</strong> — official Cafe24 app store app
              (server-side credentials). <strong>Private</strong> — paste the
              client_id / client_secret from your shop&apos;s admin.
            </>
          ) : (
            <>
              <strong>Private only</strong> — this deployment has not registered
              a Cafe24 App Store app, so only self-issued Private apps are
              available. Paste your shop&apos;s client_id / client_secret below.
            </>
          )}
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

/**
 * MakeShop-only extra fields for OAuth2 — Client ID + Client Secret. MakeShop is
 * confidential-client install-first: there is NO public/private toggle and NO
 * shop_uid input at begin (shop_uid arrives via the ShopStore install redirect).
 * Stored on the same `credentials` map so the page-level oauthBegin handler can
 * pluck them out at the call site. spec/2-navigation/4-integration.md §5.9.
 */
function MakeshopExtraFields({
  credentials,
  setCredentials,
}: {
  credentials: Record<string, unknown>;
  setCredentials: (c: Record<string, unknown>) => void;
}) {
  const t = useT();
  const set = (key: string, value: unknown) =>
    setCredentials({ ...credentials, [key]: value });
  const clientId = String(credentials.client_id ?? "");
  const clientSecret = String(credentials.client_secret ?? "");

  return (
    <div className="space-y-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-4">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {t("integrations.makeshopExtraFieldsHint")}
      </p>
      <div>
        <Label htmlFor="makeshop-client-id">
          Client ID <span className="text-red-500">*</span>
        </Label>
        <Input
          id="makeshop-client-id"
          value={clientId}
          onChange={(e) => set("client_id", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="makeshop-client-secret">
          Client Secret <span className="text-red-500">*</span>
        </Label>
        <Input
          id="makeshop-client-secret"
          type="password"
          autoComplete="new-password"
          value={clientSecret}
          onChange={(e) => set("client_secret", e.target.value)}
        />
      </div>
    </div>
  );
}
