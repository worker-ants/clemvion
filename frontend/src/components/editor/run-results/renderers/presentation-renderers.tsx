"use client";

import DOMPurify from "dompurify";
import { FileDown } from "lucide-react";
import type { NodeResult } from "@/lib/stores/execution-store";

function isHttpUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "div", "span", "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tr", "th", "td",
    "strong", "em", "b", "i", "u", "code", "pre", "blockquote",
    "svg", "path", "g", "rect", "circle", "line", "polyline", "polygon", "text",
  ],
  ALLOWED_ATTR: [
    "class", "style", "href", "src", "alt", "width", "height",
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

function TableContent({ data }: { data: Record<string, unknown> }) {
  const tableData = data as { rows?: unknown[]; columns?: string[] };
  if (!tableData.rows || !Array.isArray(tableData.rows)) {
    return <JsonContent data={data} />;
  }
  const columns =
    tableData.columns ??
    (tableData.rows[0] && typeof tableData.rows[0] === "object"
      ? Object.keys(tableData.rows[0] as Record<string, unknown>)
      : []);
  return (
    <div className="overflow-auto rounded border border-[hsl(var(--border))]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
            {columns.map((col) => (
              <th
                key={String(col)}
                className="px-3 py-1.5 text-left font-medium"
              >
                {String(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.rows.slice(0, 50).map((row, i) => (
            <tr
              key={i}
              className="border-b border-[hsl(var(--border))] last:border-b-0"
            >
              {columns.map((col) => (
                <td key={String(col)} className="px-3 py-1">
                  {String(
                    (row as Record<string, unknown>)[String(col)] ?? "",
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

function CarouselContent({ data }: { data: Record<string, unknown> }) {
  const items = data.items as
    | Array<{ title?: string; description?: string; image?: string }>
    | undefined;
  if (!items || items.length === 0) return <JsonContent data={data} />;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item, i) => (
        <div
          key={i}
          className="shrink-0 w-[180px] rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2"
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
        </div>
      ))}
    </div>
  );
}

function ChartContent({ data }: { data: Record<string, unknown> }) {
  if (data.rendered && typeof data.rendered === "string") {
    return (
      <div
        className="overflow-auto"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.rendered) }}
      />
    );
  }
  return <JsonContent data={data} />;
}

function TemplateContent({ data }: { data: Record<string, unknown> }) {
  // Backend returns { type, format, content }
  const outputFormat = (data.format ?? data.outputFormat) as string | undefined;
  const content = (data.content ?? data.rendered) as string | undefined;

  if (!content) return <JsonContent data={data} />;

  let preview: React.ReactNode;

  if (outputFormat === "html") {
    preview = (
      <div
        className="prose prose-sm max-w-none overflow-auto text-xs"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    );
  } else if (outputFormat === "markdown") {
    // Convert basic markdown to HTML for preview
    preview = (
      <div
        className="prose prose-sm max-w-none overflow-auto text-xs"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(content)) }}
      />
    );
  } else {
    preview = (
      <pre className="overflow-auto whitespace-pre-wrap break-words text-xs font-mono bg-[hsl(var(--muted))] rounded p-2">
        {content}
      </pre>
    );
  }

  return (
    <div className="space-y-3">
      {/* Rendered preview */}
      <div>
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
          Preview ({outputFormat ?? "text"})
        </p>
        <div className="rounded border border-[hsl(var(--border))] p-3">
          {preview}
        </div>
      </div>
      {/* Debug data */}
      <div>
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
          Output Data
        </p>
        <JsonContent data={data} />
      </div>
    </div>
  );
}

function PdfContent({ data }: { data: Record<string, unknown> }) {
  const url = data.url as string | undefined;
  return (
    <div className="flex items-center gap-2 p-2">
      <FileDown className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
      <span className="text-xs">
        {(data.fileName as string) ?? "document.pdf"}
      </span>
      {isHttpUrl(url) && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-500 underline ml-2"
        >
          Open
        </a>
      )}
    </div>
  );
}

function FormSubmittedContent({ data }: { data: Record<string, unknown> }) {
  const submittedData = (data.submittedData ?? data.formData) as
    | Record<string, unknown>
    | undefined;
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

export function PresentationContent({ result }: { result: NodeResult }) {
  const data = result.outputData as Record<string, unknown>;
  if (!data || typeof data !== "object") return <JsonContent data={data} />;

  // Template already includes its own debug data section
  if (result.nodeType === "template") {
    return <TemplateContent data={data} />;
  }

  let preview: React.ReactNode;
  switch (result.nodeType) {
    case "table":
      preview = <TableContent data={data} />;
      break;
    case "carousel":
      preview = <CarouselContent data={data} />;
      break;
    case "chart":
      preview = <ChartContent data={data} />;
      break;
    case "pdf":
      preview = <PdfContent data={data} />;
      break;
    case "form":
      preview = <FormSubmittedContent data={data} />;
      break;
    default:
      return <JsonContent data={data} />;
  }

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div>
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
          Preview
        </p>
        {preview}
      </div>
      {/* Debug data */}
      <div>
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
          Output Data
        </p>
        <JsonContent data={data} />
      </div>
    </div>
  );
}
