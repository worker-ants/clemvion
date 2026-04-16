export interface FieldRow {
  name: string;
  required?: boolean;
  type: string;
  description: React.ReactNode;
  default?: React.ReactNode;
}

export function FieldTable({ rows }: { rows: FieldRow[] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-md border border-[hsl(var(--border))]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.4]">
            <th className="px-3 py-2 text-left font-semibold">이름</th>
            <th className="px-3 py-2 text-left font-semibold">필수</th>
            <th className="px-3 py-2 text-left font-semibold">타입</th>
            <th className="px-3 py-2 text-left font-semibold">설명</th>
            <th className="px-3 py-2 text-left font-semibold">기본값</th>
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
