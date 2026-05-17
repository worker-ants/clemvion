"use client";

import DOMPurify from "dompurify";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NodeResult } from "@/lib/stores/execution-store";
import { cn } from "@/lib/utils/cn";

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function isHttpUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// W-3: `style` 속성은 DOMPurify 의 ALLOWED_ATTR 에서 제거.
//
// 사유: inline `style` 은 화이트리스트 CSS 속성을 따로 제한하기 어려워
// (DOMPurify 는 CSS 파서를 갖지 않음) clickjacking·CSS 누출·data: URL 등의
// 우회 벡터를 막기 까다롭다. presentation 노드의 스타일링은 미리 정의된
// 클래스만 허용하는 `class` 기반 접근으로 한정 — 신규 스타일이 필요하면
// Tailwind 유틸리티 클래스 또는 globals.css 에 정의된 컴포넌트 클래스를 사용.
//
// SVG presentation 속성 (`fill`, `stroke`, `transform`, ...) 은 element-level
// 속성이지 CSS 속성이 아니므로 그대로 유지 — 이 값들은 SVG attribute parser 가
// 검증해 잘못된 값은 무시된다.
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "div", "span", "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tr", "th", "td",
    "strong", "em", "b", "i", "u", "code", "pre", "blockquote",
    "svg", "path", "g", "rect", "circle", "line", "polyline", "polygon", "text",
  ],
  ALLOWED_ATTR: [
    "class", "href", "src", "alt", "width", "height",
    "target", "rel", "colspan", "rowspan",
    "viewBox", "d", "fill", "stroke", "stroke-width", "transform",
    "x", "y", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2",
    "font-size", "text-anchor", "dominant-baseline", "points",
  ],
};

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/** Basic markdown to HTML conversion for template preview */
function markdownToHtml(md: string): string {
  return md
    // Headers
    .replace(/^######\s+(.+)$/gm, "<h6>$1</h6>")
    .replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>")
    .replace(/^####\s+(.+)$/gm, "<h4>$1</h4>")
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr>")
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(.+)/, "<p>$1")
    .replace(/(.+)$/, "$1</p>");
}

export function JsonContent({ data }: { data: unknown }) {
  return (
    <pre className="overflow-auto whitespace-pre-wrap break-words text-xs font-mono bg-[hsl(var(--muted))] rounded p-2 max-h-[400px]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

interface ColumnDef {
  field: string;
  label: string;
}

function normalizeColumns(raw: unknown, firstRow: unknown): ColumnDef[] {
  if (Array.isArray(raw) && raw.length > 0) {
    // columns can be objects { field, label } or plain strings
    return raw.map((col) => {
      if (typeof col === "object" && col !== null && "field" in col) {
        const c = col as Record<string, unknown>;
        return { field: String(c.field ?? ""), label: String(c.label ?? c.field ?? "") };
      }
      return { field: String(col), label: String(col) };
    });
  }
  // Fallback: infer from first row keys
  if (firstRow && typeof firstRow === "object") {
    return Object.keys(firstRow as Record<string, unknown>).map((k) => ({ field: k, label: k }));
  }
  return [];
}

function TableContent({ data }: { data: Record<string, unknown> }) {
  const rows = data.rows as unknown[] | undefined;
  if (!rows || !Array.isArray(rows)) {
    return <JsonContent data={data} />;
  }
  const columns = normalizeColumns(data.columns, rows[0]);
  if (columns.length === 0) return <JsonContent data={data} />;

  return (
    <div className="overflow-auto rounded border border-[hsl(var(--border))]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
            {columns.map((col) => (
              <th
                key={col.field}
                className="px-3 py-1.5 text-left font-medium"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, i) => (
            <tr
              key={i}
              className="border-b border-[hsl(var(--border))] last:border-b-0"
            >
              {columns.map((col) => (
                <td key={col.field} className="px-3 py-1">
                  {String(
                    (row as Record<string, unknown>)[col.field] ?? "",
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CarouselContentProps {
  data: Record<string, unknown>;
  config?: Record<string, unknown>;
  selectedButtonId?: string;
  onPortButtonClick?: (buttonId: string) => void;
  onLinkButtonClick?: (url: string) => void;
}

function CarouselContent({ data, config, selectedButtonId, onPortButtonClick, onLinkButtonClick }: CarouselContentProps) {
  // dynamic 모드: backend 가 `output.items` 채움.
  // static 모드: backend 가 `output: {}` 반환 — 슬라이드 정의는 `config.items` (Principle 1.1 직교).
  const items = ((data.items as
    | Array<{ title?: string; description?: string; image?: string; buttons?: Array<{ id: string; label: string; type?: string; url?: string; style?: string }> }>
    | undefined) ??
    (config?.items as
      | Array<{ title?: string; description?: string; image?: string; buttons?: Array<{ id: string; label: string; type?: string; url?: string; style?: string }> }>
      | undefined)) as
    | Array<{ title?: string; description?: string; image?: string; buttons?: Array<{ id: string; label: string; type?: string; url?: string; style?: string }> }>
    | undefined;

  if (!items || items.length === 0) {
    return (
      <div className="rounded border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
        No items
      </div>
    );
  }

  const isInteractive = !!(onPortButtonClick || onLinkButtonClick);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item, i) => (
        <div
          key={i}
          className="shrink-0 w-[180px] rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2 flex flex-col"
        >
          {isHttpUrl(item.image) && (
            <div className="h-20 rounded bg-[hsl(var(--accent))] mb-1.5 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={item.title ?? ""}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <p className="text-xs font-medium truncate">{item.title}</p>
          {item.description && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] line-clamp-2 mt-0.5">
              {item.description}
            </p>
          )}
          {item.buttons && item.buttons.length > 0 && (
            <div className="mt-auto pt-1.5 flex flex-col gap-1">
              {item.buttons.map((btn) => {
                const isSelected = selectedButtonId === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    disabled={!isInteractive && !isSelected}
                    className={cn(
                      "w-full rounded px-2 py-0.5 text-[10px] transition-colors truncate",
                      isSelected
                        ? "border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : isInteractive
                          ? "border border-[hsl(var(--input))] bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80 cursor-pointer"
                          : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
                    )}
                    onClick={() => {
                      if (isSelected) return;
                      if (btn.type === "link" && isHttpUrl(btn.url)) {
                        onLinkButtonClick?.(btn.url);
                      } else {
                        onPortButtonClick?.(btn.id);
                      }
                    }}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChartContent({
  data,
  config,
}: {
  data: Record<string, unknown>;
  config?: Record<string, unknown>;
}) {
  // 차트 시각화는 client-side recharts 로 렌더링 (Principle 1.1 직교 — chartType/title 은 config 리터럴).
  // backend `output.rendered` (SVG snapshot) 의존은 폐기됨 — `output.data` (런타임 집계) + `config.{chartType, title}` 로 재구성.
  const chartType = (config?.chartType as string) ?? "bar";
  const title = config?.title as string | undefined;
  const points = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];

  if (points.length === 0) return <JsonContent data={data} />;

  const renderChart = () => {
    switch (chartType) {
      case "line":
        return (
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="y" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="y" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.3} />
          </AreaChart>
        );
      case "pie":
      case "donut":
        return (
          <PieChart>
            <Tooltip />
            <Pie
              data={points}
              dataKey="y"
              nameKey="x"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={chartType === "donut" ? 50 : 0}
              label={(entry: { x: unknown; y: unknown }) => String(entry.x)}
            >
              {points.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        );
      case "bar":
      default:
        return (
          <BarChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="y" fill={CHART_COLORS[0]} />
          </BarChart>
        );
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {title && <div className="text-sm font-medium">{title}</div>}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Renders the bordered preview fragment for a Template node (html / markdown
 * / text). The "Preview (format)" header, Output Data section, and global
 * button bar are owned by `PresentationContent` — keep this component pure so
 * the shared flow stays consistent with Carousel/Table/Chart.
 *
 * Spec refs:
 *  - presentation 0-common.md §1, §6.5 (Template supports ButtonDef and the
 *    button bar renders below the content)
 *  - presentation 5-template.md §1, §5.4 (`buttons` field, waiting payload)
 *
 * Returns `null` when `rendered` is missing so the parent's Output Data
 * section surfaces the raw payload while the button bar still appears.
 */
function TemplateContent({
  data,
  config,
}: {
  data: Record<string, unknown>;
  config?: Record<string, unknown>;
}) {
  // Principle 1.1 직교: outputFormat 은 config 리터럴, rendered 는 expression resolver 평가 결과.
  // 옛 `data.format` / `data.content` 잔재는 폐기됨 (Principle 1.1.4, presentation 0-common §4).
  const outputFormat = config?.outputFormat as string | undefined;
  const content = data.rendered as string | undefined;

  if (!content) return null;

  if (outputFormat === "html") {
    return (
      <div className="rounded border border-[hsl(var(--border))] p-3">
        <div
          className="prose prose-sm max-w-none overflow-auto text-xs"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
        />
      </div>
    );
  }
  if (outputFormat === "markdown") {
    return (
      <div className="rounded border border-[hsl(var(--border))] p-3">
        <div
          className="prose prose-sm max-w-none overflow-auto text-xs"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(content)) }}
        />
      </div>
    );
  }
  return (
    <div className="rounded border border-[hsl(var(--border))] p-3">
      <pre className="overflow-auto whitespace-pre-wrap break-words text-xs font-mono bg-[hsl(var(--muted))] rounded p-2">
        {content}
      </pre>
    </div>
  );
}

function FormSubmittedContent({ data }: { data: Record<string, unknown> }) {
  // Form submission payload lives at `output.interaction.data` per
  // CONVENTIONS §4.5 (Stage 3 of the node-specs-improvement rollout,
  // completed). Legacy executions may still carry `submittedData`
  // (pre-migration) or `formData` (earliest drafts); fall through those
  // paths so historical run records render without a migration backfill.
  const interaction = data.interaction as
    | { data?: unknown }
    | undefined;
  const interactionData =
    interaction && typeof interaction === "object"
      ? (interaction.data as Record<string, unknown> | undefined)
      : undefined;
  const legacyData = (data.submittedData ?? data.formData) as
    | Record<string, unknown>
    | undefined;
  const submittedData = interactionData ?? legacyData;
  if (!submittedData) return <JsonContent data={data} />;
  return (
    <div className="space-y-1 text-xs">
      {Object.entries(submittedData).map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <span className="font-medium text-[hsl(var(--muted-foreground))]">
            {key}:
          </span>
          <span>{String(value)}</span>
        </div>
      ))}
    </div>
  );
}

interface PresentationContentProps {
  result: NodeResult;
  onPortButtonClick?: (buttonId: string) => void;
  onLinkButtonClick?: (url: string) => void;
  /** When true, only render the visual preview without the raw Output Data JSON section */
  previewOnly?: boolean;
}

export function PresentationContent({
  result,
  onPortButtonClick,
  onLinkButtonClick,
  previewOnly = false,
}: PresentationContentProps) {
  // Accept both the legacy flat output and the new
  // `{ config, output, meta?, port?, status? }` shape — payload lives under
  // `output` in the latter.
  const rawInput = result.outputData as Record<string, unknown>;
  const isStructured =
    rawInput !== null &&
    typeof rawInput === "object" &&
    !Array.isArray(rawInput) &&
    "config" in rawInput &&
    "output" in rawInput;
  const envelopeConfig = isStructured
    ? (rawInput.config as Record<string, unknown> | undefined)
    : undefined;
  const unwrapped = isStructured
    ? (rawInput.output as Record<string, unknown>)
    : rawInput;
  const raw = unwrapped;
  if (!raw || typeof raw !== "object") return <JsonContent data={raw} />;

  // Unwrap interaction wrappers so renderers see the original payload fields.
  // Two cases to handle:
  //   (a) Legacy resume flat shape: `{ type: 'button_click', buttonId, nodeOutput }`
  //   (b) Structured resume shape: `{ interaction: {interactionType, buttonId, ...},
  //       selectedItem?, previousOutput }`
  let data = raw;
  let selectedButtonId: string | undefined;

  if (
    raw.type === "button_click" &&
    raw.nodeOutput &&
    typeof raw.nodeOutput === "object"
  ) {
    data = raw.nodeOutput as Record<string, unknown>;
    selectedButtonId = raw.buttonId as string | undefined;
  } else if (
    raw.interaction &&
    typeof raw.interaction === "object" &&
    raw.previousOutput &&
    typeof raw.previousOutput === "object"
  ) {
    data = raw.previousOutput as Record<string, unknown>;
    const interaction = raw.interaction as Record<string, unknown>;
    selectedButtonId =
      typeof interaction.buttonId === "string" ? interaction.buttonId : undefined;
  }

  let preview: React.ReactNode;
  switch (result.nodeType) {
    case "table":
      preview = <TableContent data={data} />;
      break;
    case "carousel":
      preview = (
        <CarouselContent
          data={data}
          config={envelopeConfig}
          selectedButtonId={selectedButtonId}
          onPortButtonClick={onPortButtonClick}
          onLinkButtonClick={onLinkButtonClick}
        />
      );
      break;
    case "chart":
      preview = <ChartContent data={data} config={envelopeConfig} />;
      break;
    case "form":
      preview = <FormSubmittedContent data={data} />;
      break;
    case "template":
      // Template joins the shared preview + button bar + Output Data flow so
      // that ButtonDef (spec 4-nodes/6-presentation/0-common.md §1, §6.5 and
      // 5-template.md §1, §5.4) renders below the rendered content.
      preview = <TemplateContent data={data} config={envelopeConfig} />;
      break;
    default:
      return <JsonContent data={data} />;
  }

  // Extract global buttons (exclude item-level buttons using buttonItemMap).
  // Prefer the new envelope `config.buttonConfig`; fall back to the legacy
  // flat location `data.buttonConfig` so pre-migration payloads keep working.
  const btnConfig = ((envelopeConfig?.buttonConfig as
    | Record<string, unknown>
    | undefined) ??
    (data.buttonConfig as Record<string, unknown> | undefined)) as
    | Record<string, unknown>
    | undefined;
  const allButtons = (btnConfig?.buttons ?? []) as Array<{
    id: string;
    label: string;
    type?: "link" | "port";
    url?: string;
    style?: string;
  }>;
  const buttonItemMap = btnConfig?.buttonItemMap as Record<string, number> | undefined;
  const buttons = buttonItemMap
    ? allButtons.filter((btn) => !(btn.id in buttonItemMap))
    : allButtons;
  const isInteractive = !!(onPortButtonClick || onLinkButtonClick);

  // Template gets a format suffix in the Preview header so html/markdown/text
  // rendering mode is visible at a glance (parity with the pre-refactor UX).
  // Legacy flat shape pre-dates the envelope migration — fall back to the
  // top-level `outputFormat` so historic Template runs still surface the
  // correct format.
  const templateFormat =
    (envelopeConfig?.outputFormat as string | undefined) ??
    (rawInput?.outputFormat as string | undefined) ??
    "text";
  const previewHeader =
    result.nodeType === "template" ? `Preview (${templateFormat})` : "Preview";

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div>
        {!previewOnly && (
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
            {previewHeader}
          </p>
        )}
        {preview}
        {buttons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {buttons.map((btn) => {
              const isSelected = selectedButtonId === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  disabled={!isInteractive && !isSelected}
                  className={cn(
                    "inline-flex items-center rounded-md px-3 py-1 text-xs transition-colors",
                    isSelected
                      ? "border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : isInteractive
                        ? "border border-[hsl(var(--input))] bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80 cursor-pointer"
                        : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
                  )}
                  onClick={() => {
                    if (isSelected) return;
                    if (btn.type === "link" && isHttpUrl(btn.url)) {
                      onLinkButtonClick?.(btn.url);
                    } else {
                      onPortButtonClick?.(btn.id);
                    }
                  }}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* Debug data */}
      {!previewOnly && (
        <div>
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
            Output Data
          </p>
          <JsonContent data={data} />
        </div>
      )}
    </div>
  );
}
