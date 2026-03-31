"use client";

import { useState } from "react";
import { useExecutionStore } from "@/lib/stores/execution-store";
import type { NodeResult } from "@/lib/stores/execution-store";
import {
  ChevronUp,
  ChevronDown,
  X,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function ResultContent({ result }: { result: NodeResult }) {
  const data = result.outputData;

  if (result.nodeType === "table" && data && typeof data === "object") {
    const tableData = data as { rows?: unknown[]; columns?: string[] };
    if (tableData.rows && Array.isArray(tableData.rows)) {
      const columns =
        tableData.columns ??
        (tableData.rows[0] && typeof tableData.rows[0] === "object"
          ? Object.keys(tableData.rows[0] as Record<string, unknown>)
          : []);
      return (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                {columns.map((col) => (
                  <th
                    key={String(col)}
                    className="px-3 py-2 text-left font-medium"
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
                    <td key={String(col)} className="px-3 py-1.5">
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
  }

  // Default: JSON view
  return (
    <pre className="overflow-auto whitespace-pre-wrap break-words p-3 text-xs font-mono bg-[hsl(var(--muted))] rounded-md">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function RunResultsDrawer() {
  const [expanded, setExpanded] = useState(true);
  const status = useExecutionStore((s) => s.status);
  const nodeStatuses = useExecutionStore((s) => s.nodeStatuses);
  const nodeResults = useExecutionStore((s) => s.nodeResults);
  const reset = useExecutionStore((s) => s.reset);
  const [activeTab, setActiveTab] = useState(0);

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
    ) : (
      <Clock className="h-4 w-4" />
    );

  return (
    <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Header bar - always visible */}
      <div className="flex h-9 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-sm font-medium">
            {status === "running"
              ? "Running..."
              : status === "completed"
                ? "Completed"
                : status === "failed"
                  ? "Failed"
                  : "Execution"}
          </span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {completedCount}/{totalNodes} nodes
            {failedCount > 0 && ` (${failedCount} failed)`}
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

      {/* Expandable content */}
      {expanded && (
        <div className="h-[200px] overflow-hidden border-t border-[hsl(var(--border))]">
          {nodeResults.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
              {status === "running"
                ? "Waiting for results..."
                : "No presentation output to display"}
            </div>
          ) : (
            <div className="flex h-full">
              {/* Tabs */}
              <div className="w-[180px] shrink-0 overflow-y-auto border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                {nodeResults.map((result, idx) => (
                  <button
                    key={result.nodeId}
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                      activeTab === idx
                        ? "bg-[hsl(var(--card))] font-medium"
                        : "hover:bg-[hsl(var(--accent))]"
                    }`}
                  >
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {result.nodeType}
                    </Badge>
                    <span className="truncate">{result.nodeLabel}</span>
                  </button>
                ))}
              </div>
              {/* Content */}
              <div className="flex-1 overflow-auto p-2">
                {nodeResults[activeTab] && (
                  <ResultContent result={nodeResults[activeTab]} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
