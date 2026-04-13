"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  MinusCircle,
  PauseCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/node-definitions";
import type {
  NodeResult,
  ConversationItem,
} from "@/lib/stores/execution-store";
import { ConversationTimelineItem } from "./conversation-timeline-item";
import { parseHistoryMessages } from "./conversation-utils";
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

function isMultiTurnAgent(result: NodeResult): boolean {
  if (result.nodeType !== "ai_agent") return false;
  const raw = result.outputData as Record<string, unknown> | null;
  // Support both legacy flat output and new `{ config, output, ... }` wrapper.
  const output =
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "config" in raw &&
    "output" in raw
      ? (raw.output as Record<string, unknown> | null)
      : raw;
  // Live mode: has conversationConfig, or History mode: has messages array
  return !!(
    output?.conversationConfig ||
    output?.messages ||
    output?.interactionType === "ai_conversation"
  );
}

interface ResultTimelineProps {
  results: NodeResult[];
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  conversationMessages: ConversationItem[];
  selectedConversationItemIndex: number | null;
  onSelectConversationItem: (index: number | null) => void;
  isLiveConversation: boolean;
}

export function ResultTimeline({
  results,
  selectedId,
  onSelect,
  conversationMessages,
  selectedConversationItemIndex,
  onSelectConversationItem,
  isLiveConversation,
}: ResultTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const prevMsgCountRef = useRef(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-scroll to bottom when new results or messages arrive
  useEffect(() => {
    const totalCount = results.length + conversationMessages.length;
    const prevTotal = prevCountRef.current + prevMsgCountRef.current;
    if (totalCount > prevTotal && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = results.length;
    prevMsgCountRef.current = conversationMessages.length;
  }, [results.length, conversationMessages.length]);

  /** Identifier used for selection + React keys. Prefers the per-iteration
   *  execution id so Loop/Map body iterations stay distinct rows. */
  const idOf = (r: NodeResult): string => r.nodeExecutionId ?? r.nodeId;

  // Auto-select first result if nothing selected
  useEffect(() => {
    if (!selectedId && results.length > 0) {
      onSelect(idOf(results[0]));
    }
  }, [selectedId, results, onSelect]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleNodeClick = useCallback(
    (id: string) => {
      onSelect(id);
      onSelectConversationItem(null);
    },
    [onSelect, onSelectConversationItem],
  );

  const handleConversationItemClick = useCallback(
    (id: string, index: number) => {
      onSelect(id);
      onSelectConversationItem(index);
    },
    [onSelect, onSelectConversationItem],
  );

  const getHistoryMessages = useCallback(
    (result: NodeResult): ConversationItem[] =>
      parseHistoryMessages(result.outputData),
    [],
  );

  // Build per-nodeId iteration counters so we can append "(iter N)" to the
  // label whenever the same node ran multiple times — the user otherwise
  // can't tell which row corresponds to which Loop/Map iteration.
  const nodeIdCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results) {
      counts.set(r.nodeId, (counts.get(r.nodeId) ?? 0) + 1);
    }
    return counts;
  }, [results]);

  const iterIndices = useMemo(() => {
    const seen = new Map<string, number>();
    const indices = new Map<string, number>();
    for (const r of results) {
      const next = (seen.get(r.nodeId) ?? 0) + 1;
      seen.set(r.nodeId, next);
      indices.set(idOf(r), next);
    }
    return indices;
  }, [results]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {results.map((result) => {
        const rowId = idOf(result);
        const categoryColor =
          CATEGORY_COLORS[result.nodeCategory] ?? "#6B7280";
        const isSelected = selectedId === rowId;
        const isMultiTurn = isMultiTurnAgent(result);
        const isLiveNode =
          isLiveConversation &&
          result.status === "waiting_for_input" &&
          result.nodeType === "ai_agent";
        // Live conversation node is always expanded
        const isExpanded = isLiveNode || (expanded[rowId] ?? false);
        // Append "(iter N)" so multiple iterations of the same body node are
        // distinguishable in the timeline.
        const totalForNode = nodeIdCounts.get(result.nodeId) ?? 1;
        const iterIndex = iterIndices.get(rowId);
        const labelText =
          totalForNode > 1 && iterIndex
            ? `${result.nodeLabel} (iter ${iterIndex})`
            : result.nodeLabel;
        const items = isLiveNode
          ? conversationMessages
          : isMultiTurn
            ? getHistoryMessages(result)
            : [];

        const rawForConv = result.outputData as Record<string, unknown> | null;
        const convPayload =
          rawForConv &&
          typeof rawForConv === "object" &&
          !Array.isArray(rawForConv) &&
          "config" in rawForConv &&
          "output" in rawForConv
            ? (rawForConv.output as Record<string, unknown> | null)
            : rawForConv;
        const convConfig = convPayload?.conversationConfig as
          | Record<string, unknown>
          | undefined;
        const turnCount =
          (convConfig?.turnCount as number) ??
          (convPayload?.turnCount as number | undefined) ??
          0;
        const maxTurns = (convConfig?.maxTurns as number) ?? 0;

        return (
          <div key={rowId}>
            {/* Node row */}
            <button
              type="button"
              onClick={() => {
                if (isMultiTurn || isLiveNode) {
                  toggleExpand(rowId);
                }
                handleNodeClick(rowId);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                isSelected && selectedConversationItemIndex == null
                  ? "bg-[hsl(var(--accent))]"
                  : "hover:bg-[hsl(var(--accent))/0.5]"
              }`}
            >
              {/* Expand/collapse or category dot */}
              {isMultiTurn || isLiveNode ? (
                <span className="flex h-3 w-3 shrink-0 items-center justify-center">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  )}
                </span>
              ) : (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColor }}
                />
              )}
              {(isMultiTurn || isLiveNode) && (
                <span className="shrink-0 text-[10px]">🤖</span>
              )}
              {/* Node label */}
              <span className="flex-1 truncate text-xs">
                {labelText}
              </span>
              {/* Turn counter for multi-turn */}
              {(isMultiTurn || isLiveNode) && turnCount > 0 && (
                <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
                  Turn {turnCount}
                  {maxTurns > 0 ? `/${maxTurns}` : ""}
                </span>
              )}
              {/* Duration */}
              {result.duration != null && (
                <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
                  {formatDuration(result.duration)}
                </span>
              )}
              {/* Status icon */}
              <StatusIcon status={result.status} />
            </button>

            {/* Expanded conversation items */}
            {isExpanded && items.length > 0 && (
              <div className="border-l-2 border-[hsl(var(--border))] ml-5 mb-1">
                {items.map((item, idx) => (
                  <ConversationTimelineItem
                    key={`${rowId}-conv-${idx}`}
                    item={item}
                    isSelected={
                      isSelected && selectedConversationItemIndex === idx
                    }
                    onClick={() =>
                      handleConversationItemClick(rowId, idx)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
