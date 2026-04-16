"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Plus,
  Search,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { RoleGate } from "@/components/auth/role-gate";
import { cn } from "@/lib/utils/cn";
import {
  integrationsApi,
  type IntegrationDto,
  type ListStatusFilter,
} from "@/lib/api/integrations";
import { ServiceIcon, prettyAuthType } from "./_shared/service-icons";
import { StatusBadge, needsAttention } from "./_shared/status-badge";
import { ServicePickerModal } from "./_shared/service-picker-modal";

const SCOPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "personal", label: "Personal" },
  { value: "organization", label: "Organization" },
] as const;

const STATUS_FILTERS: { value: ListStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "connected", label: "Connected" },
  { value: "expiring", label: "Expiring" },
  { value: "expired", label: "Expired" },
  { value: "error", label: "Error" },
];

const PAGE_SIZE = 30;

export default function IntegrationsPage() {
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
  });

  const integrations = useMemo(() => listData?.data ?? [], [listData]);
  const pagination = listData?.pagination;

  const attentionCount = useMemo(
    () => integrations.filter(needsAttention).length,
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
        <h1 className="text-3xl font-bold">Integrations</h1>
        <RoleGate minRole="editor">
          <Button onClick={() => setPickerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Integration
            <kbd className="ml-2 hidden rounded bg-[hsl(var(--primary-foreground))]/20 px-1.5 py-0.5 text-[10px] sm:inline">
              N
            </kbd>
          </Button>
        </RoleGate>
      </div>

      {attentionCount > 0 && (
        <button
          type="button"
          onClick={() => updateParam("status", "expiring")}
          className="flex w-full items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-left text-sm text-yellow-900 hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            <strong>{attentionCount}</strong> integration
            {attentionCount > 1 ? "s" : ""} need attention (expiring, expired, or
            error). Click to filter.
          </span>
        </button>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder="Search integrations..."
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
                  {opt.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label="Refresh"
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
            All services
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
              {f.label}
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
          Failed to load integrations.{" "}
          <button
            onClick={() => void refetch()}
            className="font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && integrations.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No integrations yet"
          description="Connect external services to use them from your workflows."
          action={
            <RoleGate minRole="editor">
              <Button onClick={() => setPickerOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Integration
              </Button>
            </RoleGate>
          }
        />
      )}

      {!isLoading && !isError && integrations.length > 0 && (
        <>
          {grouped.org.length > 0 && (
            <Section title="Organization" items={grouped.org} />
          )}
          {grouped.personal.length > 0 && (
            <Section title="Personal" items={grouped.personal} />
          )}
        </>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-4 text-sm text-[hsl(var(--muted-foreground))]">
          <span>
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.totalItems} total
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => updateParam("page", String(pagination.page - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateParam("page", String(pagination.page + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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
