"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Inbox,
  Plus,
  Search,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { RoleGate } from "@/components/auth/role-gate";
import { cn } from "@/lib/utils/cn";
import {
  integrationsApi,
  type IntegrationDto,
  type ListStatusFilter,
} from "@/lib/api/integrations";
import { ServiceIcon, prettyAuthType } from "./_shared/service-icons";
import {
  StatusBadge,
  computeAttentionBreakdown,
  type AttentionBreakdown,
} from "./_shared/status-badge";
import { ServicePickerModal } from "./_shared/service-picker-modal";
import { useT, type TranslationKey } from "@/lib/i18n";

const SCOPE_OPTIONS: { value: "all" | "personal" | "organization"; labelKey: TranslationKey }[] = [
  { value: "all", labelKey: "integrations.scopeAll" },
  { value: "personal", labelKey: "integrations.scopePersonal" },
  { value: "organization", labelKey: "integrations.scopeOrganization" },
];

const STATUS_FILTERS: { value: ListStatusFilter; labelKey: TranslationKey }[] = [
  { value: "all", labelKey: "integrations.statusAll" },
  { value: "attention", labelKey: "integrations.statusAttention" },
  { value: "connected", labelKey: "integrations.statusConnected" },
  { value: "expiring", labelKey: "integrations.statusExpiring" },
  { value: "expired", labelKey: "integrations.statusExpired" },
  { value: "error", labelKey: "integrations.statusError" },
];

const PAGE_SIZE = 30;

export default function IntegrationsPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const scope = (searchParams.get("scope") ?? "all") as
    | "personal"
    | "organization"
    | "all";
  const serviceTypes = searchParams.getAll("serviceType");
  const status = (searchParams.get("status") ?? "all") as ListStatusFilter;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [pickerOpen, setPickerOpen] = useState(false);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "" || value === "all") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    router.replace(`/integrations?${next.toString()}`);
  };

  const toggleServiceType = (type: string) => {
    const next = new URLSearchParams(searchParams.toString());
    const current = new Set(next.getAll("serviceType"));
    next.delete("serviceType");
    if (current.has(type)) current.delete(type);
    else current.add(type);
    for (const v of current) next.append("serviceType", v);
    next.delete("page");
    router.replace(`/integrations?${next.toString()}`);
  };

  const { data: services = [] } = useQuery({
    queryKey: ["integrations", "services"],
    queryFn: () => integrationsApi.services(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: listData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      "integrations",
      "list",
      { q, scope, serviceTypes, status, page },
    ],
    queryFn: () =>
      integrationsApi.list({
        q: q || undefined,
        scope: scope === "all" ? undefined : scope,
        serviceType: serviceTypes.length > 0 ? serviceTypes : undefined,
        status: status === "all" ? undefined : status,
        page,
        limit: PAGE_SIZE,
      }),
    // Cafe24 Private rows transition to `connected` after the user completes
    // "테스트 실행" in a separate tab — refetchOnWindowFocus brings the list
    // up to date when the user returns. spec/2-navigation/4-integration.md §6
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const integrations = useMemo(() => listData?.data ?? [], [listData]);
  const pagination = listData?.pagination;

  const attention = useMemo(
    () => computeAttentionBreakdown(integrations),
    [integrations],
  );

  const grouped = useMemo(() => {
    const org: IntegrationDto[] = [];
    const personal: IntegrationDto[] = [];
    for (const i of integrations) {
      (i.scope === "organization" ? org : personal).push(i);
    }
    return { org, personal };
  }, [integrations]);

  // `N` keyboard shortcut — open Add Integration modal when not typing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setPickerOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("integrations.title")}</h1>
        <RoleGate minRole="editor">
          <Button onClick={() => setPickerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("integrations.addIntegration")}
            <kbd className="ml-2 hidden rounded bg-[hsl(var(--primary-foreground))]/20 px-1.5 py-0.5 text-[10px] sm:inline">
              N
            </kbd>
          </Button>
        </RoleGate>
      </div>

      {attention.total > 0 && (
        <AttentionBanner
          breakdown={attention}
          onActivate={() => {
            // spec §2.4 — single row jumps to detail, multi-row applies the
            // attention virtual filter.
            if (attention.total === 1 && attention.mostUrgentId) {
              router.push(`/integrations/${attention.mostUrgentId}`);
            } else {
              updateParam("status", "attention");
            }
          }}
        />
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder={t("integrations.searchPlaceholder")}
              value={q}
              onChange={(e) => updateParam("q", e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-[hsl(var(--border))] p-1">
              {SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    scope === opt.value
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                  )}
                  onClick={() => updateParam("scope", opt.value)}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label={t("integrations.refreshAria")}
            >
              <RefreshCw
                className={cn("h-4 w-4", isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip
            active={serviceTypes.length === 0}
            onClick={() => updateParam("serviceType", null)}
          >
            {t("integrations.allServices")}
          </Chip>
          {services.map((s) => (
            <Chip
              key={s.type}
              active={serviceTypes.includes(s.type)}
              onClick={() => toggleServiceType(s.type)}
            >
              {s.name}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.value}
              active={status === f.value}
              onClick={() => updateParam("status", f.value)}
            >
              {t(f.labelKey)}
            </Chip>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30"
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-4 text-sm">
          {t("integrations.loadFailedHint")}{" "}
          <button
            onClick={() => void refetch()}
            className="font-medium underline"
          >
            {t("integrations.retry")}
          </button>
        </div>
      )}

      {!isLoading && !isError && integrations.length === 0 && (
        <EmptyState
          icon={Inbox}
          title={t("integrations.emptyTitle")}
          description={t("integrations.emptyDescription")}
          action={
            <RoleGate minRole="editor">
              <Button onClick={() => setPickerOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("integrations.addIntegration")}
              </Button>
            </RoleGate>
          }
        />
      )}

      {!isLoading && !isError && integrations.length > 0 && (
        <>
          {grouped.org.length > 0 && (
            <Section title={t("integrations.sectionOrg")} items={grouped.org} />
          )}
          {grouped.personal.length > 0 && (
            <Section title={t("integrations.sectionPersonal")} items={grouped.personal} />
          )}
        </>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-4 text-sm text-[hsl(var(--muted-foreground))]">
          <span>
            {t("integrations.paginationSummary", {
              page: pagination.page,
              totalPages: pagination.totalPages,
              totalItems: pagination.totalItems,
            })}
          </span>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(next) =>
              updateParam("page", next > 1 ? String(next) : null)
            }
          />
        </div>
      )}

      {pickerOpen && (
        <ServicePickerModal
          services={services}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// spec/2-navigation/4-integration.md §2.4 — "Need attention" banner.
// Breakdown-aware title + per-category counts, red tone when any error row
// is present (amber otherwise). Click action is owned by the parent so the
// 1-row → detail-jump vs. N-row → attention-filter branch lives where it
// reads naturally (next to the rest of the URL handling).

// Tone palette indexed by whether the breakdown contains at least one error
// row. Centralised so the banner button and its icon stay in lock-step when
// we tweak the colour palette.
const ATTENTION_BANNER_TONE = {
  error: {
    banner:
      "border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    icon: "text-red-600 dark:text-red-400",
  },
  warn: {
    banner:
      "border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
    icon: "text-yellow-600 dark:text-yellow-400",
  },
} as const;

interface AttentionBannerProps {
  breakdown: AttentionBreakdown;
  /**
   * Invoked when the user activates the banner (click / keyboard). The
   * parent decides what to do: single-row breakdowns jump to the detail
   * page, multi-row breakdowns apply the `?status=attention` filter. The
   * banner itself is intentionally action-agnostic.
   */
  onActivate: () => void;
}

function AttentionBanner({ breakdown, onActivate }: AttentionBannerProps) {
  const t = useT();
  const hasError = breakdown.error > 0;
  const tone = hasError ? ATTENTION_BANNER_TONE.error : ATTENTION_BANNER_TONE.warn;
  const isSingle = breakdown.total === 1;
  const title = isSingle
    ? t("integrations.attentionTitleSingle")
    : t("integrations.attentionTitlePlural", { count: breakdown.total });
  const callToAction = isSingle
    ? t("integrations.attentionClickToOpen")
    : t("integrations.attentionClickToFilter");
  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
        tone.banner,
      )}
    >
      <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", tone.icon)} />
      <span className="flex flex-col gap-0.5">
        <strong className="font-semibold">{title}</strong>
        <span className="text-xs opacity-90">
          {[
            breakdown.expired > 0
              ? t("integrations.attentionBreakdownExpired", {
                  count: breakdown.expired,
                })
              : null,
            breakdown.expiring > 0
              ? t("integrations.attentionBreakdownExpiring", {
                  count: breakdown.expiring,
                })
              : null,
            breakdown.error > 0
              ? t("integrations.attentionBreakdownError", {
                  count: breakdown.error,
                })
              : null,
            callToAction,
          ]
            .filter((s): s is string => Boolean(s))
            .join(" · ")}
        </span>
      </span>
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
          : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
      )}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: IntegrationDto[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <IntegrationCard key={i.id} integration={i} />
        ))}
      </div>
    </section>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationDto }) {
  return (
    <Link
      href={`/integrations/${integration.id}`}
      className="group flex flex-col gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-colors hover:border-[hsl(var(--primary))]"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-[hsl(var(--border))] p-2">
          <ServiceIcon type={integration.serviceType} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium group-hover:text-[hsl(var(--primary))]">
            {integration.name}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {prettyAuthType(integration.authType)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <StatusBadge integration={integration} />
      </div>
    </Link>
  );
}

export const dynamic = "force-dynamic";
