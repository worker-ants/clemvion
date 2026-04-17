"use client";

import { cn } from "@/lib/utils/cn";

export interface ExtractedFieldSchema {
  name: string;
  type?: string;
  description?: string;
  required?: boolean;
}

interface ExtractedFieldsCardProps {
  fields: Record<string, unknown>;
  schema?: ExtractedFieldSchema[];
  retryInfo?: {
    count: number;
    max: number;
  };
}

function formatValue(value: unknown): {
  display: string;
  missing: boolean;
} {
  if (value === null || value === undefined || value === "") {
    return { display: "—", missing: true };
  }
  if (typeof value === "string") return { display: value, missing: false };
  if (typeof value === "number" || typeof value === "boolean") {
    return { display: String(value), missing: false };
  }
  return { display: JSON.stringify(value), missing: false };
}

/**
 * 2-column label/value grid for Information Extractor's collected fields.
 * Renders identically whether the caller passes a final `output.extracted`
 * payload or the in-progress `conversationConfig.extracted` payload — fields
 * without values show a dim "—" placeholder so the user can see at a glance
 * what has already been gathered and what is still pending.
 */
export function ExtractedFieldsCard({
  fields,
  schema,
  retryInfo,
}: ExtractedFieldsCardProps) {
  const orderedKeys = schema?.length
    ? schema.map((s) => s.name)
    : Object.keys(fields);
  const schemaByName = new Map(schema?.map((s) => [s.name, s]) ?? []);

  const showRetry =
    retryInfo != null &&
    (retryInfo.count > 0 || (retryInfo.max > 0 && retryInfo.count > 0));

  return (
    <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-[hsl(var(--foreground))]">
          Extracted Fields
        </span>
        {showRetry && (
          <span className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
            재수집 {retryInfo.count}
            {retryInfo.max > 0 ? ` / ${retryInfo.max}` : " (무제한)"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-xs">
        {orderedKeys.map((key) => {
          const fieldSchema = schemaByName.get(key);
          const { display, missing } = formatValue(fields[key]);
          const isRequired = fieldSchema?.required !== false;
          return (
            <div key={key} className="contents">
              <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                <span>{key}</span>
                {isRequired && (
                  <span className="text-[9px] uppercase tracking-wide text-[hsl(var(--destructive))] opacity-70">
                    req
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "break-words",
                  missing
                    ? "italic text-[hsl(var(--muted-foreground))]"
                    : "text-[hsl(var(--foreground))]",
                )}
              >
                {display}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
