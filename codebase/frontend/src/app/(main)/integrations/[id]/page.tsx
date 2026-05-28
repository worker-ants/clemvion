"use client";

import { useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import {
  integrationsApi,
  type IntegrationDto,
  type IntegrationScope,
  type AuthVariant,
  type UsageWorkflow,
} from "@/lib/api/integrations";
import { ServiceIcon, prettyAuthType } from "../_shared/service-icons";
import { StatusBadge, humanizeUntil } from "../_shared/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isReauthorizeDisabled } from "@/lib/integrations/reauthorize";
import { CredentialsForm } from "../_shared/credentials-form";
import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";
import { ScopeTab } from "./scope-tab";
import { Cafe24AppUrlCard } from "./cafe24-app-url-card";
import { openOAuthPopup } from "./open-oauth-popup";

/** catalog staleTime: 1h (operation 메타데이터는 정적·변경 빈도 매우 낮음) */
const ONE_HOUR_MS = 60 * 60 * 1000;

const TABS = [
  "overview",
  "security",
  "scope",
  "usage",
  "activity",
  "danger",
] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL_KEYS: Record<Tab, TranslationKey> = {
  overview: "integrations.tabOverview",
  security: "integrations.tabSecurity",
  scope: "integrations.tabScope",
  usage: "integrations.tabUsage",
  activity: "integrations.tabActivity",
  danger: "integrations.tabDanger",
};

export default function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useT();
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: integration, isLoading, isError } = useQuery({
    queryKey: ["integrations", id],
    queryFn: () => integrationsApi.get(id),
  });

  const { data: services = [] } = useQuery({
    queryKey: ["integrations", "services"],
    queryFn: () => integrationsApi.services(),
    staleTime: 5 * 60 * 1000,
  });

  const service = services.find((s) => s.type === integration?.serviceType);
  const variant = service?.authVariants.find(
    (v) => v.authType === integration?.authType,
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["integrations", id] });
    void queryClient.invalidateQueries({ queryKey: ["integrations", "list"] });
  };

  const deleteMutation = useMutation({
    mutationFn: () => integrationsApi.remove(id),
    onSuccess: () => {
      toast.success(t("integrations.deleted"));
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      router.push("/integrations");
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { status?: number; data?: { code?: string } };
      };
      if (e.response?.status === 409) {
        toast.error(t("integrations.inUseError"));
      } else {
        toast.error(t("integrations.deleteFailed"));
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (isError || !integration) {
    return (
      <div className="space-y-4">
        <Link
          href="/integrations"
          className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" /> {t("integrations.backToList")}
        </Link>
        <p className="text-sm">{t("integrations.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" /> {t("integrations.backToList")}
      </Link>

      <header className="flex items-start gap-4 border-b border-[hsl(var(--border))] pb-6">
        <div className="rounded-lg border border-[hsl(var(--border))] p-3">
          <ServiceIcon type={integration.serviceType} className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{integration.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
            <span>{prettyAuthType(integration.authType)}</span>
            <span>·</span>
            <span className="capitalize">{integration.scope}</span>
            <span>·</span>
            <StatusBadge integration={integration} />
            {integration.lastUsedAt && (
              <>
                <span>·</span>
                <span>
                  {t("integrations.lastUsedRel", {
                    relative: formatRel(integration.lastUsedAt, t),
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-[hsl(var(--border))]">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
            )}
          >
            {t(TAB_LABEL_KEYS[key])}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <OverviewTab integration={integration} onChanged={invalidate} t={t} />
      )}
      {tab === "security" && (
        <SecurityTab
          integration={integration}
          variant={variant}
          onChanged={invalidate}
          t={t}
        />
      )}
      {tab === "scope" && (
        <ScopeTab
          integration={integration}
          service={service}
          onChanged={invalidate}
          t={t}
        />
      )}
      {tab === "usage" && <UsageTab integrationId={id} t={t} />}
      {tab === "activity" && (
        <ActivityTab
          integrationId={id}
          serviceType={integration.serviceType}
          t={t}
        />
      )}
      {tab === "danger" && (
        <DangerTab
          integration={integration}
          onDelete={() => deleteMutation.mutate()}
          deleting={deleteMutation.isPending}
          onScopeChanged={invalidate}
          t={t}
        />
      )}
    </div>
  );
}

function formatRel(at: string, t: TFunction): string {
  const diff = Date.now() - new Date(at).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("integrations.timeJustNow");
  if (minutes < 60) return t("integrations.timeMinutesAgo", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("integrations.timeHoursAgo", { hours });
  const days = Math.floor(hours / 24);
  return t("integrations.timeDaysAgo", { days });
}

// ---------------- Overview ----------------

function OverviewTab({
  integration,
  onChanged,
  t,
}: {
  integration: IntegrationDto;
  onChanged: () => void;
  t: TFunction;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(integration.name);

  const saveName = useMutation({
    mutationFn: () => integrationsApi.update(integration.id, { name }),
    onSuccess: () => {
      toast.success(t("integrations.nameUpdated"));
      setEditing(false);
      onChanged();
    },
    onError: () => toast.error(t("integrations.nameUpdateFailed")),
  });

  const testMutation = useMutation({
    mutationFn: () => integrationsApi.test(integration.id),
    onSuccess: (res) => {
      if (res.success) toast.success(t("integrations.connectionPassed"));
      else toast.error(t("integrations.connectionFailedMsg", { error: res.message ?? "" }));
    },
    onError: () => toast.error(t("integrations.testFailedToast")),
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <InfoRow label={t("integrations.serviceLabel")} value={integration.serviceType} />
      <InfoRow
        label={t("integrations.authTypeLabel")}
        value={prettyAuthType(integration.authType)}
      />
      <div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">{t("integrations.nameLabel")}</div>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              size="sm"
              onClick={() => saveName.mutate()}
              disabled={saveName.isPending}
            >
              {t("integrations.saveBtn")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setName(integration.name);
              }}
            >
              {t("integrations.cancelBtn")}
            </Button>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm">{integration.name}</span>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {t("integrations.editBtn")}
            </Button>
          </div>
        )}
      </div>
      <InfoRow
        label={t("integrations.createdAtLabel")}
        value={formatDate(integration.createdAt, "datetime")}
      />
      <InfoRow
        label={t("integrations.lastUsedLabel")}
        value={
          integration.lastUsedAt
            ? formatDate(integration.lastUsedAt, "datetime")
            : "—"
        }
      />
      <InfoRow
        label={t("integrations.lastRotatedLabel")}
        value={
          integration.lastRotatedAt
            ? formatDate(integration.lastRotatedAt, "datetime")
            : "—"
        }
      />
      <InfoRow
        label={t("integrations.tokenExpiresLabel")}
        value={
          integration.tokenExpiresAt
            ? integration.autoRefresh
              ? t("integrations.tokenExpiresAuto", {
                  duration: humanizeUntil(integration.tokenExpiresAt),
                })
              : formatDate(integration.tokenExpiresAt, "datetime")
            : "—"
        }
        tooltip={
          integration.autoRefresh && integration.tokenExpiresAt
            ? formatDate(integration.tokenExpiresAt, "datetime")
            : undefined
        }
      />

      <div className="sm:col-span-2">
        <Button
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending}
        >
          {testMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {t("integrations.testConnectionBtn")}
        </Button>
      </div>

      {integration.appUrl && (
        <div className="sm:col-span-2">
          <Cafe24AppUrlCard appUrl={integration.appUrl} t={t} />
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  /**
   * Optional supplementary detail surfaced on hover. Used by the "Token
   * Expires" row to demote the absolute timestamp behind the friendlier
   * `Auto-renews · in <duration>` caption (spec/2-navigation/4-integration.md
   * §4.2). When omitted the row renders without any hover affordance.
   */
  tooltip?: string;
}) {
  const valueNode = (
    <div
      className={cn(
        "mt-1 break-all text-sm",
        tooltip && "cursor-help underline decoration-dotted underline-offset-4",
      )}
    >
      {value}
    </div>
  );
  return (
    <div>
      <div className="text-xs text-[hsl(var(--muted-foreground))]">{label}</div>
      {tooltip ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>{valueNode}</TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        valueNode
      )}
    </div>
  );
}

// ---------------- Security ----------------

function SecurityTab({
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

  const reauthorize = useMutation({
    mutationFn: () => integrationsApi.reauthorize(integration.id),
    onSuccess: (res) => {
      if ("authUrl" in res && res.authUrl) {
        openOAuthPopup(res.authUrl);
        toast.success(t("integrations.reauthorizeOpened"));
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
            {t("integrations.reauthorizeHint")}
          </p>
          <Button
            variant="outline"
            onClick={() => reauthorize.mutate()}
            disabled={reauthorize.isPending || isReauthorizeDisabled(integration)}
            title={
              isReauthorizeDisabled(integration)
                ? t("integrations.reauthorizeDisabledHint")
                : undefined
            }
          >
            {reauthorize.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t("integrations.reauthorizeBtn")}
          </Button>
          {isReauthorizeDisabled(integration) && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("integrations.reauthorizeDisabledHint")}
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

// ---------------- Usage ----------------

function UsageTab({ integrationId, t }: { integrationId: string; t: TFunction }) {
  const { data: usages = [], isLoading } = useQuery({
    queryKey: ["integrations", integrationId, "usages"],
    queryFn: () => integrationsApi.usages(integrationId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (usages.length === 0) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
        {t("integrations.usageEmpty")}
      </div>
    );
  }

  const totalNodes = usages.reduce((acc, w) => acc + w.nodes.length, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        {t("integrations.usageSummary", {
          nodes: totalNodes,
          workflows: usages.length,
        })}
      </p>
      <div className="divide-y rounded-lg border border-[hsl(var(--border))]">
        {usages.map((w: UsageWorkflow) => (
          <div key={w.workflowId} className="p-4">
            <div className="flex items-center gap-2">
              <Link
                href={`/workflows/${w.workflowId}`}
                className="font-medium hover:underline"
              >
                {w.workflowName}
              </Link>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  w.isActive
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                )}
              >
                {w.isActive ? t("common.active") : t("common.inactive")}
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {w.nodes.map((n) => (
                <li
                  key={n.id}
                  className="text-[hsl(var(--muted-foreground))]"
                >
                  ├─ {n.label}{" "}
                  <span className="text-xs">({n.type})</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Activity ----------------

function ActivityTab({
  integrationId,
  serviceType,
  t,
}: {
  integrationId: string;
  serviceType: string;
  t: TFunction;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["integrations", integrationId, "activity"],
    queryFn: () =>
      integrationsApi.activity(integrationId, { limit: 20, days: 7 }),
  });

  // Catalog 는 service-type 별로 한 번만 fetch (TanStack staleTime 1h). 통합별
  // operation 메타데이터는 거의 안 바뀌고, 여러 통합 상세 페이지를 오갈 때
  // 같은 service-type 끼리 캐시 공유한다. cafe24 가 아닌 service 는 빈 배열을
  // 받기 때문에 lookup miss → endpoint subtext fallback 으로 자연 처리.
  const { data: catalog } = useQuery({
    queryKey: ["integrations", "catalog", serviceType],
    queryFn: () => integrationsApi.catalog(serviceType),
    staleTime: ONE_HOUR_MS,
  });

  // useMemo must be called unconditionally (Rules of Hooks) — before any early return.
  const catalogByKey = useMemo(
    () => new Map((catalog?.operations ?? []).map((op) => [op.key, op])),
    [catalog],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
        {t("integrations.activityEmpty")}
      </div>
    );
  }

  const rate = Math.round(data.summary.successRate * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[hsl(var(--border))] p-4 text-sm">
        {t("integrations.activitySummary", { total: data.summary.totalCalls, rate })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-2 py-2">{t("integrations.activityWhen")}</th>
              <th className="px-2 py-2">{t("integrations.activityApi")}</th>
              <th className="px-2 py-2">{t("integrations.activityStatus")}</th>
              <th className="px-2 py-2">{t("integrations.activityDuration")}</th>
              <th className="px-2 py-2">{t("integrations.activityError")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.items.map((row) => {
              const apiCell = renderApiCell({
                apiLabel: row.apiLabel ?? null,
                apiMethod: row.apiMethod ?? null,
                apiPath: row.apiPath ?? null,
                catalog: catalogByKey,
                t,
              });
              return (
                <tr key={row.id}>
                  <td className="px-2 py-2">
                    {formatDate(row.at, "datetime")}
                  </td>
                  <td className="px-2 py-2">{apiCell}</td>
                  <td className="px-2 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        row.status === "success"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-2">{row.durationMs}ms</td>
                  <td className="px-2 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {row.error
                      ? String(
                          (row.error as { message?: string }).message ??
                            JSON.stringify(row.error),
                        )
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * `§4.6` 활동 탭의 `API` 컬럼 렌더링.
 *  - 라벨 dict lookup 성공: 굵게 라벨 + 작게 endpoint subtext (2줄)
 *  - 라벨 없음 + endpoint 있음: endpoint 한 줄
 *  - 둘 다 NULL: `—` (i18n key `activityApiUnknown`)
 * SoT: spec/2-navigation/4-integration.md §4.6.
 */
function renderApiCell(args: {
  apiLabel: string | null;
  apiMethod: string | null;
  apiPath: string | null;
  catalog: Map<string, { labelKey: string; descriptionKey?: string }>;
  t: TFunction;
}) {
  const { apiLabel, apiMethod, apiPath, catalog, t } = args;
  const endpoint =
    apiMethod && apiPath
      ? `${apiMethod} ${apiPath}`
      : apiMethod
      ? apiMethod
      : apiPath ?? "";

  // catalog endpoint 가 응답한 labelKey 가 dict 안에 있으면 i18n 라벨 사용.
  // 본 PR 에서는 dict 가 빈 상태라 사실상 모든 cafe24 호출도 endpoint-only
  // fallback 으로 흐른다 (follow-up plan cafe24-catalog-i18n.md 에서 채움).
  const catalogEntry = apiLabel ? catalog.get(apiLabel) : undefined;
  const labelKey = catalogEntry?.labelKey ?? apiLabel ?? null;
  const humanLabel = labelKey ? tryTranslateLabel(labelKey, t) : null;

  if (humanLabel) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{humanLabel}</span>
        {endpoint && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {endpoint}
          </span>
        )}
      </div>
    );
  }
  if (endpoint) {
    return (
      <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
        {endpoint}
      </span>
    );
  }
  return (
    <span className="text-[hsl(var(--muted-foreground))]">
      {t("integrations.activityApiUnknown")}
    </span>
  );
}

/**
 * `cafe24.<resource>.<operation>` catalog key 가 cafe24Catalog dict 에 매핑돼
 * 있으면 사람 친화 라벨 반환, 없으면 null 반환 (endpoint-only fallback 으로
 * 위임). 현재 dict 는 빈 상태이므로 항상 null. SoT: dict/{ko,en}/cafe24Catalog.ts.
 *
 * @see plan/in-progress/cafe24-catalog-i18n.md — dict 채우기 follow-up
 */
function tryTranslateLabel(catalogKey: string, t: TFunction): string | null {
  const fullKey = `cafe24Catalog.${catalogKey}` as TranslationKey;
  const translated = t(fullKey);
  // i18n framework 가 key 누락 시 key 문자열을 그대로 반환 — 그 케이스는 lookup
  // miss 로 취급해 endpoint subtext fallback 으로 흘려보낸다.
  if (translated === fullKey) return null;
  return translated;
}

// ---------------- Danger zone ----------------

function DangerTab({
  integration,
  onDelete,
  deleting,
  onScopeChanged,
  t,
}: {
  integration: IntegrationDto;
  onDelete: () => void;
  deleting: boolean;
  onScopeChanged: () => void;
  t: TFunction;
}) {
  const [confirming, setConfirming] = useState(false);
  const [nextScope, setNextScope] = useState<IntegrationScope>(integration.scope);

  const scopeMutation = useMutation({
    mutationFn: () => integrationsApi.updateScope(integration.id, nextScope),
    onSuccess: () => {
      toast.success(t("integrations.scopeUpdated"));
      onScopeChanged();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? t("integrations.scopeUpdateFailedDefault"));
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[hsl(var(--border))] p-6">
        <h3 className="text-sm font-semibold">{t("integrations.scopeChangeTitle")}</h3>
        <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
          {t("integrations.scopeChangeHint")}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={nextScope}
            onChange={(e) => setNextScope(e.target.value as IntegrationScope)}
            className="flex h-10 rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
          >
            <option value="personal">{t("integrations.scopePersonal")}</option>
            <option value="organization">{t("integrations.scopeOrganization")}</option>
          </select>
          <Button
            variant="outline"
            onClick={() => {
              if (nextScope !== integration.scope) {
                if (window.confirm(t("integrations.scopeChangeConfirm"))) {
                  scopeMutation.mutate();
                }
              }
            }}
            disabled={
              nextScope === integration.scope || scopeMutation.isPending
            }
          >
            {scopeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("integrations.scopeApply")}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-red-300 p-6 dark:border-red-900">
        <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">
          {t("integrations.dangerDeleteTitle")}
        </h3>
        <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
          {t("integrations.dangerDeleteHint")}
        </p>
        {!confirming ? (
          <Button
            variant="outline"
            className="text-red-600"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("integrations.dangerDeleteBtn")}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              onClick={onDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("integrations.confirmDeleteBtn")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t("integrations.cancelBtn")}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
