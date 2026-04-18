"use client";

import { useState, use } from "react";
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
import {
  integrationsApi,
  type IntegrationDto,
  type IntegrationScope,
  type ServiceDefinition,
  type AuthVariant,
  type UsageWorkflow,
} from "@/lib/api/integrations";
import { ServiceIcon, prettyAuthType } from "../_shared/service-icons";
import { StatusBadge } from "../_shared/status-badge";
import { CredentialsForm } from "../_shared/credentials-form";
import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";

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
      {tab === "activity" && <ActivityTab integrationId={id} t={t} />}
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
        value={new Date(integration.createdAt).toLocaleString()}
      />
      <InfoRow
        label={t("integrations.lastUsedLabel")}
        value={
          integration.lastUsedAt
            ? new Date(integration.lastUsedAt).toLocaleString()
            : "—"
        }
      />
      <InfoRow
        label={t("integrations.lastRotatedLabel")}
        value={
          integration.lastRotatedAt
            ? new Date(integration.lastRotatedAt).toLocaleString()
            : "—"
        }
      />
      <InfoRow
        label={t("integrations.tokenExpiresLabel")}
        value={
          integration.tokenExpiresAt
            ? new Date(integration.tokenExpiresAt).toLocaleString()
            : "—"
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
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="mt-1 break-all text-sm">{value}</div>
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
      if (res.authUrl) {
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
            disabled={reauthorize.isPending}
          >
            {reauthorize.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t("integrations.reauthorizeBtn")}
          </Button>
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
            ? new Date(integration.lastRotatedAt).toLocaleString()
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

function openOAuthPopup(url: string) {
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  window.open(
    url,
    "integration-oauth",
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
  );
}

// ---------------- Scope & Permissions ----------------

function ScopeTab({
  integration,
  service,
  onChanged,
  t,
}: {
  integration: IntegrationDto;
  service: ServiceDefinition | undefined;
  onChanged: () => void;
  t: TFunction;
}) {
  const currentScopes = Array.isArray(integration.credentials.scopes)
    ? (integration.credentials.scopes as string[])
    : [];

  const allOptions = service?.scopes ?? [];
  const missingScopes =
    integration.statusReason === "insufficient_scope" &&
    allOptions.length > 0
      ? allOptions.filter((s) => !currentScopes.includes(s.value))
      : [];

  const [selected, setSelected] = useState<string[]>([]);

  const requestMutation = useMutation({
    mutationFn: () => integrationsApi.requestScopes(integration.id, selected),
    onSuccess: (res) => {
      if (res.authUrl) {
        openOAuthPopup(res.authUrl);
        toast.success(t("integrations.scopeRequestOpened"));
      }
      onChanged();
    },
    onError: () => toast.error(t("integrations.requestScopesFailed")),
  });

  if (integration.authType !== "oauth2") {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
        {t("integrations.scopeOnlyOauth")}
      </div>
    );
  }

  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  return (
    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
      <section>
        <h3 className="text-sm font-semibold">{t("integrations.currentScopes")}</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {currentScopes.length === 0 && (
            <li className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("integrations.noScopes")}
            </li>
          )}
          {currentScopes.map((s) => (
            <li
              key={s}
              className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs"
            >
              {s}
            </li>
          ))}
        </ul>
      </section>

      {missingScopes.length > 0 && (
        <section className="rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950">
          <div className="font-medium text-red-700 dark:text-red-300">
            {t("integrations.missingScopesDetected")}
          </div>
          <ul className="mt-1 flex flex-wrap gap-2">
            {missingScopes.map((s) => (
              <li
                key={s.value}
                className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-200"
              >
                {s.value}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("integrations.requestScopesTitle")}</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("integrations.requestScopesHint")}
        </p>
        <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3">
          {allOptions.map((s) => (
            <label
              key={s.value}
              className="flex cursor-pointer items-start gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(s.value)}
                onChange={() => toggle(s.value)}
                className="mt-0.5"
                disabled={currentScopes.includes(s.value)}
              />
              <div className="flex-1">
                <div className="font-medium">
                  {s.label}
                  {currentScopes.includes(s.value) && (
                    <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {t("integrations.alreadyGranted")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {s.value}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => requestMutation.mutate()}
            disabled={selected.length === 0 || requestMutation.isPending}
          >
            {requestMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("integrations.requestScopesBtn")}
          </Button>
        </div>
      </section>
    </div>
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

function ActivityTab({ integrationId, t }: { integrationId: string; t: TFunction }) {
  const { data, isLoading } = useQuery({
    queryKey: ["integrations", integrationId, "activity"],
    queryFn: () =>
      integrationsApi.activity(integrationId, { limit: 20, days: 7 }),
  });

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
              <th className="px-2 py-2">{t("integrations.activityStatus")}</th>
              <th className="px-2 py-2">{t("integrations.activityDuration")}</th>
              <th className="px-2 py-2">{t("integrations.activityError")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.items.map((row) => (
              <tr key={row.id}>
                <td className="px-2 py-2">
                  {new Date(row.at).toLocaleString()}
                </td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
