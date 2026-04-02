"use client";

import { useRef, useEffect } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  MinusCircle,
  PauseCircle,
} from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/node-definitions";
import type { NodeResult } from "@/lib/stores/execution-store";
import { formatDuration } from "./utils";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    case "completed":
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-red-500" />;
    case "skipped":
      return <MinusCircle className="h-3 w-3 text-gray-400" />;
    case "waiting_for_input":
      return <PauseCircle className="h-3 w-3 text-amber-500" />;
    default:
      return <Loader2 className="h-3 w-3 text-gray-400" />;
  }
}

interface ResultTimelineProps {
  results: NodeResult[];
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}

export function ResultTimeline({
  results,
  selectedId,
  onSelect,
}: ResultTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Auto-scroll to bottom when new results arrive
  useEffect(() => {
    if (results.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = results.length;
  }, [results.length]);

  // Auto-select first result if nothing selected
  useEffect(() => {
    if (!selectedId && results.length > 0) {
      onSelect(results[0].nodeId);
    }
  }, [selectedId, results, onSelect]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {results.map((result) => {
        const categoryColor =
          CATEGORY_COLORS[result.nodeCategory] ?? "#6B7280";
        const isSelected = selectedId === result.nodeId;
        return (
          <button
            key={result.nodeId}
            type="button"
            onClick={() => onSelect(result.nodeId)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
              isSelected
                ? "bg-[hsl(var(--accent))]"
                : "hover:bg-[hsl(var(--accent))/0.5]"
            }`}
          >
            {/* Category color dot */}
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
            {/* Node label */}
            <span className="flex-1 truncate text-xs">{result.nodeLabel}</span>
            {/* Duration */}
            {result.duration != null && (
              <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
                {formatDuration(result.duration)}
              </span>
            )}
            {/* Status icon */}
            <StatusIcon status={result.status} />
          </button>
        );
      })}
    </div>
  );
}
