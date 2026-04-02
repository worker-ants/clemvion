"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { useExecutionStore } from "@/lib/stores/execution-store";
import type { NodeResult } from "@/lib/stores/execution-store";
import { getWsClient } from "@/lib/websocket/ws-client";
import {
  ChevronUp,
  ChevronDown,
  X,
  CheckCircle,
  XCircle,
  Loader2,
  PauseCircle,
  BarChart3,
  Table2,
  LayoutGrid,
  FileText,
  FileDown,
  FormInput,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Node type icon mapping
// ---------------------------------------------------------------------------
function isHttpUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}

function NodeTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  switch (type) {
    case "chart":
      return <BarChart3 className={className} />;
    case "table":
      return <Table2 className={className} />;
    case "carousel":
      return <LayoutGrid className={className} />;
    case "template":
      return <FileText className={className} />;
    case "pdf":
      return <FileDown className={className} />;
    case "form":
      return <FormInput className={className} />;
    default:
      return <FileText className={className} />;
  }
}

// ---------------------------------------------------------------------------
// Presentation result renderers
// ---------------------------------------------------------------------------
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
  const outputFormat = data.outputFormat as string | undefined;
  const rendered = data.rendered as string | undefined;
  if (!rendered) return <JsonContent data={data} />;

  if (outputFormat === "html") {
    return (
      <div
        className="prose prose-sm max-w-none overflow-auto text-xs"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(rendered) }}
      />
    );
  }
  return (
    <pre className="overflow-auto whitespace-pre-wrap break-words text-xs font-mono bg-[hsl(var(--muted))] rounded p-2">
      {rendered}
    </pre>
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

function JsonContent({ data }: { data: unknown }) {
  return (
    <pre className="overflow-auto whitespace-pre-wrap break-words text-xs font-mono bg-[hsl(var(--muted))] rounded p-2">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function ResultContent({ result }: { result: NodeResult }) {
  const data = result.outputData as Record<string, unknown>;
  if (!data || typeof data !== "object") return <JsonContent data={data} />;

  switch (result.nodeType) {
    case "table":
      return <TableContent data={data} />;
    case "carousel":
      return <CarouselContent data={data} />;
    case "chart":
      return <ChartContent data={data} />;
    case "template":
      return <TemplateContent data={data} />;
    case "pdf":
      return <PdfContent data={data} />;
    case "form":
      return <FormSubmittedContent data={data} />;
    default:
      return <JsonContent data={data} />;
  }
}

// ---------------------------------------------------------------------------
// Dynamic Form UI for Form nodes in waiting state
// ---------------------------------------------------------------------------
interface FormField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: unknown;
}

function DynamicFormUI({
  formConfig,
  onSubmit,
}: {
  formConfig: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const fields = (formConfig.fields ?? []) as FormField[];
  const title = formConfig.title as string | undefined;
  const description = formConfig.description as string | undefined;
  const submitLabel = (formConfig.submitLabel as string) ?? "Submit";

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const f of fields) {
      initial[f.name] =
        f.defaultValue ?? (f.type === "checkbox" ? false : "");
    }
    return initial;
  });

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {title && <p className="text-sm font-medium">{title}</p>}
      {description && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {description}
        </p>
      )}
      {fields.map((field) => (
        <div key={field.name} className="space-y-1">
          <Label className="text-xs">
            {field.label}
            {field.required && (
              <span className="text-red-500 ml-0.5">*</span>
            )}
          </Label>
          {renderField(field, values[field.name], (v) =>
            handleChange(field.name, v),
          )}
        </div>
      ))}
      <Button type="submit" size="sm" className="mt-2">
        {submitLabel}
      </Button>
    </form>
  );
}

function renderField(
  field: FormField,
  value: unknown,
  onChange: (v: unknown) => void,
) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          className="w-full rounded border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-xs resize-y min-h-[60px]"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          className="h-7 text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChange(Number(e.target.value))}
          required={field.required}
        />
      );
    case "email":
      return (
        <Input
          type="email"
          className="h-7 text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          className="h-7 text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case "select":
      return (
        <select
          className="w-full rounded border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-xs h-7"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        >
          <option value="">Select...</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-3">
          {field.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                name={field.name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                required={field.required}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
      );
    default:
      return (
        <Input
          type="text"
          className="h-7 text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// History entry component
// ---------------------------------------------------------------------------
function HistoryEntry({
  result,
  isWaiting,
  formConfig,
  executionId,
  onFormSubmit,
}: {
  result?: NodeResult;
  isWaiting: boolean;
  formConfig?: unknown;
  executionId: string | null;
  onFormSubmit: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const nodeType = result?.nodeType ?? "form";

  const handleFormSubmit = useCallback(
    (data: Record<string, unknown>) => {
      if (!executionId) return;
      const client = getWsClient();
      client.emit("execution.submit_form", {
        executionId,
        formData: data,
      });
      onFormSubmit();
    },
    [executionId, onFormSubmit],
  );

  return (
    <div className="border-b border-[hsl(var(--border))] last:border-b-0">
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[hsl(var(--accent))] transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 transition-transform ${
            collapsed ? "" : "rotate-90"
          }`}
        />
        <NodeTypeIcon type={nodeType} className="h-3.5 w-3.5 shrink-0 text-[#EC4899]" />
        <span className="text-xs font-medium truncate flex-1">
          {result?.nodeLabel ?? nodeType}
        </span>
        {isWaiting ? (
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 text-amber-600 border-amber-300"
          >
            <PauseCircle className="h-2.5 w-2.5 mr-0.5" />
            Waiting
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 text-green-600 border-green-300"
          >
            <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
            Done
          </Badge>
        )}
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="px-3 pb-3 pl-[34px]">
          {isWaiting && formConfig ? (
            <DynamicFormUI
              formConfig={formConfig as Record<string, unknown>}
              onSubmit={handleFormSubmit}
            />
          ) : result ? (
            <ResultContent result={result} />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Drawer
// ---------------------------------------------------------------------------
export function RunResultsDrawer() {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevResultCountRef = useRef(0);

  const status = useExecutionStore((s) => s.status);
  const executionId = useExecutionStore((s) => s.executionId);
  const nodeStatuses = useExecutionStore((s) => s.nodeStatuses);
  const nodeResults = useExecutionStore((s) => s.nodeResults);
  const waitingNodeId = useExecutionStore((s) => s.waitingNodeId);
  const waitingFormConfig = useExecutionStore((s) => s.waitingFormConfig);
  const reset = useExecutionStore((s) => s.reset);
  const resumeFromForm = useExecutionStore((s) => s.resumeFromForm);

  // Auto-scroll to bottom when new results arrive
  const resultCount = nodeResults.length + (waitingNodeId ? 1 : 0);
  useEffect(() => {
    if (resultCount > prevResultCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevResultCountRef.current = resultCount;
  }, [resultCount]);

  if (status === "idle") return null;

  const completedNodes = Array.from(nodeStatuses.entries()).filter(
    ([key]) => key !== "__execution__",
  );
  const totalNodes = completedNodes.length;
  const completedCount = completedNodes.filter(
    ([, info]) => info.status === "completed",
  ).length;
  const failedCount = completedNodes.filter(
    ([, info]) => info.status === "failed",
  ).length;

  const statusIcon =
    status === "running" ? (
      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    ) : status === "completed" ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : status === "failed" ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : status === "waiting_for_input" ? (
      <PauseCircle className="h-4 w-4 text-amber-500" />
    ) : (
      <Loader2 className="h-4 w-4" />
    );

  const statusLabel =
    status === "running"
      ? "Running..."
      : status === "completed"
        ? "Completed"
        : status === "failed"
          ? "Failed"
          : status === "waiting_for_input"
            ? "Waiting for input..."
            : "Execution";

  // Build the list of entries to display:
  // 1. All completed presentation node results (in order)
  // 2. If waiting, the form entry at the bottom
  const hasWaitingFormEntry =
    status === "waiting_for_input" &&
    waitingNodeId &&
    !nodeResults.some((r) => r.nodeId === waitingNodeId);

  return (
    <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Header bar */}
      <div className="flex h-9 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-sm font-medium">{statusLabel}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {completedCount}/{totalNodes} nodes
            {failedCount > 0 && ` (${failedCount} failed)`}
            {nodeResults.length > 0 &&
              ` · ${nodeResults.length} result${nodeResults.length > 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={reset}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Chat-style history */}
      {expanded && (
        <div
          ref={scrollRef}
          className="h-[240px] overflow-y-auto border-t border-[hsl(var(--border))]"
        >
          {nodeResults.length === 0 && !hasWaitingFormEntry ? (
            <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
              {status === "running"
                ? "Waiting for results..."
                : "No presentation output to display"}
            </div>
          ) : (
            <div>
              {nodeResults.map((result) => (
                <HistoryEntry
                  key={result.nodeId}
                  result={result}
                  isWaiting={false}
                  executionId={executionId}
                  onFormSubmit={resumeFromForm}
                />
              ))}
              {hasWaitingFormEntry && (
                <HistoryEntry
                  key={`waiting-${waitingNodeId}`}
                  isWaiting={true}
                  formConfig={waitingFormConfig}
                  executionId={executionId}
                  onFormSubmit={resumeFromForm}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
