import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { integrationsApi, type IntegrationDto } from "@/lib/api/integrations";
import { useT, type TFunction } from "@/lib/i18n";

interface IntegrationSelectorProps {
  value: string;
  onChange: (value: string) => void;
  /** Service type filter — e.g. `['email']`, `['http']`. */
  serviceTypes: string[];
  label?: string;
  /** Human-readable name for the empty-state CTA (e.g. "Email", "HTTP"). */
  serviceDisplayName?: string;
}

export function IntegrationSelector({
  value,
  onChange,
  serviceTypes,
  label,
  serviceDisplayName,
}: IntegrationSelectorProps) {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["integrations", "list", { serviceTypes }],
    queryFn: () =>
      integrationsApi.list({ serviceType: serviceTypes, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const integrations: IntegrationDto[] = data?.data ?? [];
  const hasSavedButMissing =
    !isLoading &&
    value !== "" &&
    !integrations.some((i) => i.id === value);
  const empty = !isLoading && integrations.length === 0;
  const displayName = serviceDisplayName ?? serviceTypes[0] ?? "integration";
  const createHref = `/integrations/new?service=${encodeURIComponent(
    serviceTypes[0] ?? "",
  )}&step=auth`;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
        {label ?? t("nodeConfigs.integrationSelector.label")}
      </label>
      <select
        className="h-8 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading || empty}
      >
        <option value="">
          {isLoading
            ? t("nodeConfigs.integrationSelector.loading")
            : t("nodeConfigs.integrationSelector.select")}
        </option>
        {integrations.map((i) => (
          <option key={i.id} value={i.id}>
            {optionLabel(i, t)}
          </option>
        ))}
        {hasSavedButMissing && (
          <option value={value}>
            {`${value.slice(0, 8)}${t("nodeConfigs.integrationSelector.missingSuffix")}`}
          </option>
        )}
      </select>
      {empty && (
        <Link
          href={createHref}
          className="mt-1 text-[11px] font-medium text-[hsl(var(--primary))] hover:underline"
        >
          {t("nodeConfigs.integrationSelector.createNew", { name: displayName })}
        </Link>
      )}
    </div>
  );
}

function optionLabel(i: IntegrationDto, t: TFunction): string {
  const base = `${i.name} (${i.authType})`;
  if (i.status === "expired" || i.status === "error") {
    return `${base} — ${t("nodeConfigs.integrationSelector.needsAttention")}`;
  }
  return base;
}
