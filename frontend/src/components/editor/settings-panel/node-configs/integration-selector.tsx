import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { integrationsApi, type IntegrationDto } from "@/lib/api/integrations";

interface IntegrationSelectorProps {
  value: string;
  onChange: (value: string) => void;
  /** Service type filter — e.g. `['email']`, `['slack']`. */
  serviceTypes: string[];
  label?: string;
  /** Human-readable name for the empty-state CTA (e.g. "Email", "Slack"). */
  serviceDisplayName?: string;
}

export function IntegrationSelector({
  value,
  onChange,
  serviceTypes,
  label = "Integration",
  serviceDisplayName,
}: IntegrationSelectorProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["integrations", "list", { serviceTypes }],
    queryFn: () =>
      integrationsApi.list({ serviceType: serviceTypes, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const integrations: IntegrationDto[] = data?.data ?? [];
  // Only flag "missing" once the list has actually loaded — otherwise the
  // option flashes during initial fetch whenever a saved value is present.
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
        {label}
      </label>
      <select
        className="h-8 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading || empty}
      >
        <option value="">
          {isLoading ? "Loading…" : "Select integration"}
        </option>
        {integrations.map((i) => (
          <option key={i.id} value={i.id}>
            {optionLabel(i)}
          </option>
        ))}
        {hasSavedButMissing && (
          <option value={value}>{`${value.slice(0, 8)}… (missing)`}</option>
        )}
      </select>
      {empty && (
        <Link
          href={createHref}
          className="mt-1 text-[11px] font-medium text-[hsl(var(--primary))] hover:underline"
        >
          + Create {displayName} integration
        </Link>
      )}
    </div>
  );
}

function optionLabel(i: IntegrationDto): string {
  const base = `${i.name} (${i.authType})`;
  if (i.status === "expired" || i.status === "error") {
    return `${base} — needs attention`;
  }
  return base;
}
