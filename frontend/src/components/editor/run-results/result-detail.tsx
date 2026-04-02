"use client";

import { useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  PauseCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_COLORS, getNodeDefinition } from "@/lib/node-definitions";
import type { NodeResult } from "@/lib/stores/execution-store";
import { getWsClient } from "@/lib/websocket/ws-client";
import { PresentationContent } from "./renderers/presentation-renderers";
import { GenericRenderer } from "./renderers/generic-renderer";
import { DynamicFormUI } from "./dynamic-form-ui";
import { formatDuration } from "./utils";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "running":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300"
        >
          <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
          Running
        </Badge>
      );
    case "completed":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-green-600 border-green-300"
        >
          <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
          Done
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-red-600 border-red-300"
        >
          <XCircle className="h-2.5 w-2.5 mr-0.5" />
          Failed
        </Badge>
      );
    case "skipped":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-gray-500 border-gray-300"
        >
          <MinusCircle className="h-2.5 w-2.5 mr-0.5" />
          Skipped
        </Badge>
      );
    case "waiting_for_input":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300"
        >
          <PauseCircle className="h-2.5 w-2.5 mr-0.5" />
          Waiting
        </Badge>
      );
    default:
      return null;
  }
}

interface ResultDetailProps {
  result: NodeResult | null;
  isWaitingForm: boolean;
  formConfig: unknown;
  executionId: string | null;
  onFormSubmit: () => void;
}

export function ResultDetail({
  result,
  isWaitingForm,
  formConfig,
  executionId,
  onFormSubmit,
}: ResultDetailProps) {
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

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
        Select a node to view details
      </div>
    );
  }

  const definition = getNodeDefinition(result.nodeType);
  const categoryColor =
    CATEGORY_COLORS[result.nodeCategory] ?? "#6B7280";
  const isPresentation = result.nodeCategory === "presentation";

  return (
    <div className="h-full overflow-y-auto p-3">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: categoryColor }}
        />
        <span className="text-sm font-medium">{result.nodeLabel}</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {definition?.label ?? result.nodeType}
        </span>
        <StatusBadge status={result.status} />
        {result.duration != null && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {formatDuration(result.duration)}
          </span>
        )}
      </div>

      {/* Form waiting state */}
      {isWaitingForm && formConfig ? (
        <DynamicFormUI
          formConfig={formConfig as Record<string, unknown>}
          onSubmit={handleFormSubmit}
        />
      ) : isPresentation && result.status === "completed" ? (
        <PresentationContent result={result} />
      ) : (
        <GenericRenderer result={result} />
      )}
    </div>
  );
}
