import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { readLocaleCookie } from "@/lib/i18n/server-locale";
import { translate } from "@/lib/i18n/core";

export interface FieldRow {
  name: string;
  required?: boolean;
  type: string;
  description: React.ReactNode;
  default?: React.ReactNode;
}

export async function FieldTable({ rows }: { rows: FieldRow[] }) {
  const locale = (await readLocaleCookie()) ?? DEFAULT_LOCALE;
  return (
    <div className="my-4 overflow-x-auto rounded-md border border-[hsl(var(--border))]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.4]">
            <th className="px-3 py-2 text-left font-semibold">
              {translate(locale, "docs.fieldTable.name")}
            </th>
            <th className="px-3 py-2 text-left font-semibold">
              {translate(locale, "docs.fieldTable.required")}
            </th>
            <th className="px-3 py-2 text-left font-semibold">
              {translate(locale, "docs.fieldTable.type")}
            </th>
            <th className="px-3 py-2 text-left font-semibold">
              {translate(locale, "docs.fieldTable.description")}
            </th>
            <th className="px-3 py-2 text-left font-semibold">
              {translate(locale, "docs.fieldTable.default")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.name}
              className="border-b border-[hsl(var(--border))] last:border-b-0"
            >
              <td className="px-3 py-2 font-mono text-xs">{row.name}</td>
              <td className="px-3 py-2">{row.required ? "✓" : ""}</td>
              <td className="px-3 py-2 font-mono text-xs">{row.type}</td>
              <td className="px-3 py-2">{row.description}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {row.default ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
