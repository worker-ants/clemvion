"use client";

import { AlertTriangle } from "lucide-react";
import type { NodeResult } from "@/lib/stores/execution-store";
import { JsonContent } from "./presentation-renderers";
import { formatDuration } from "../utils";

export function GenericRenderer({ result, previewOnly = false }: { result: NodeResult; previewOnly?: boolean }) {
  return (
    <div className="space-y-3">
      {/* Error display */}
      {result.error && (
        <div className="flex items-start gap-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{result.error}</span>
        </div>
      )}

      {/* Status info */}
      <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
        <span>
          Status:{" "}
          <span className="font-medium text-[hsl(var(--foreground))]">
            {result.status}
          </span>
        </span>
        {result.duration != null && (
          <span>
            Duration:{" "}
            <span className="font-medium text-[hsl(var(--foreground))]">
              {formatDuration(result.duration)}
            </span>
          </span>
        )}
      </div>

      {/* Output */}
      {!previewOnly && result.outputData != null && (
        <div>
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
            Output
          </p>
          <JsonContent data={result.outputData} />
        </div>
      )}
    </div>
  );
}
