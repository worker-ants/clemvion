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
  Workflow,
  Wrench,
} from "lucide-react";
import { getCategoryColor } from "@/lib/node-definitions";
import type {
  NodeResult,
  ConversationItem,
} from "@/lib/stores/execution-store";
import { ConversationTimelineItem } from "./conversation-timeline-item";
import { parseHistoryMessages } from "./conversation-utils";
import { groupToolCallItems } from "@/lib/conversation/conversation-utils";
import { cn } from "@/lib/utils/cn";
import { formatDuration } from "./utils";
import { isConversationOutput } from "./output-shape";
import { buildConvConfigFromStructured } from "@/lib/websocket/apply-execution-snapshot";
import {
  buildTimelineTree,
  countDescendants,
  keyOf,
  sumDescendantDurations,
  type TimelineTreeNode,
} from "./timeline-tree";

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

/** Accent color for a Sub-Workflow card's left border based on aggregate status. */
function statusAccentClass(status: string): string {
  switch (status) {
    case "running":
      return "border-l-blue-500";
    case "completed":
      return "border-l-green-500";
    case "failed":
      return "border-l-red-500";
    case "waiting_for_input":
      return "border-l-amber-500";
    case "skipped":
      return "border-l-gray-400";
    default:
      return "border-l-[hsl(var(--border))]";
  }
}

function isMultiTurnConversation(result: NodeResult): boolean {
  if (isConversationOutput(result.outputData)) return true;
  // Conservative fallback: any AI Agent / Information Extractor row is
  // expandable in the timeline, even when the persisted outputData is sparse
  // (waiting tick saved before the first assistant message, or envelope
  // shape diverges from what isConversationOutput recognises). Expanding an
  // empty conversation is harmless — the user just sees the AI node card
  // with no rows beneath it, which is preferable to a non-expandable row
  // that hides any history (regression reported on PR #272 머지 후).
  //
  // Single-turn AI Agent rows also flow through this fallback; their items
  // array will be empty, so visually the row behaves like the simple
  // non-expandable view from before. The only added affordance is the
  // chevron icon, which is consistent for the whole AI category.
  return (
    result.nodeType === "ai_agent" ||
    result.nodeType === "information_extractor"
  );
}

function isSubWorkflowNode(result: NodeResult): boolean {
  return result.nodeType === "workflow";
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

interface RowCtx {
  selectedId: string | null;
  selectedConversationItemIndex: number | null;
  conversationMessages: ConversationItem[];
  isLiveConversation: boolean;
  expanded: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  handleNodeClick: (id: string) => void;
  handleConversationItemClick: (id: string, index: number) => void;
}

/** Regular (non-card) timeline row. Used for leaf nodes and as the header
 *  body of Sub-Workflow cards. */
function TimelineRow({
  tnode,
  ctx,
  renderAsCardHeader = false,
  cardChildCount,
  cardChildDurationSum,
}: {
  tnode: TimelineTreeNode;
  ctx: RowCtx;
  renderAsCardHeader?: boolean;
  cardChildCount?: number;
  cardChildDurationSum?: number;
}) {
  const { result } = tnode;
  const rowId = keyOf(result);
  const isSelected = ctx.selectedId === rowId;
  const isMultiTurn = isMultiTurnConversation(result);
  const isLiveNode =
    ctx.isLiveConversation &&
    result.status === "waiting_for_input" &&
    isMultiTurn;
  const isExpanded = isLiveNode || (ctx.expanded[rowId] ?? false);
  const isCardHeader = renderAsCardHeader;

  const labelText =
    tnode.totalIterations > 1
      ? `${result.nodeLabel} (iter ${tnode.iterIndex})`
      : result.nodeLabel;

  // Multi-turn conversation items (expanded under AI agent rows)
  const items = isLiveNode
    ? ctx.conversationMessages
    : isMultiTurn
      ? parseHistoryMessages(result.outputData)
      : [];

  // Turn counter derivation for AI multi-turn rows.
  // Structured envelope (`{config, output:{result:{...}}}`) keeps `turnCount`
  // in `output.result.*` and `maxTurns` in `config.*` — the handler never
  // echoes a flattened `output.conversationConfig`, so we merge both via the
  // same helper apply-execution-snapshot uses (legacy shape keeps the fields
  // on a single `conversationConfig` object). Reading `output.conversationConfig`
  // directly always missed `maxTurns` → denominator stuck at 0.
  const rawForConv = result.outputData as Record<string, unknown> | null;
  const isStructuredEnvelope =
    !!rawForConv &&
    typeof rawForConv === "object" &&
    !Array.isArray(rawForConv) &&
    "config" in rawForConv &&
    "output" in rawForConv;
  const convConfig = isStructuredEnvelope
    ? buildConvConfigFromStructured(rawForConv)
    : (rawForConv?.conversationConfig as Record<string, unknown> | undefined);
  const turnCount = (convConfig?.turnCount as number | undefined) ?? 0;
  const maxTurns = (convConfig?.maxTurns as number | undefined) ?? 0;

  const categoryColor = getCategoryColor(result.nodeCategory);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isCardHeader || isMultiTurn || isLiveNode) {
            ctx.toggleExpand(rowId);
          }
          ctx.handleNodeClick(rowId);
        }}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
          isSelected && ctx.selectedConversationItemIndex == null
            ? "bg-[hsl(var(--accent))]"
            : "hover:bg-[hsl(var(--accent))/0.5]"
        }`}
      >
        {/* Leading indicator: chevron for expandable rows (multi-turn or card
            header), Workflow icon for Sub-Workflow leaves, or category dot. */}
        {isCardHeader ? (
          <span className="flex h-3 w-3 shrink-0 items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            ) : (
              <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            )}
          </span>
        ) : isMultiTurn || isLiveNode ? (
          <span className="flex h-3 w-3 shrink-0 items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            ) : (
              <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            )}
          </span>
        ) : isSubWorkflowNode(result) ? (
          <Workflow
            className="h-3 w-3 shrink-0"
            style={{ color: categoryColor }}
          />
        ) : (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: categoryColor }}
          />
        )}
        {isCardHeader && (
          <Workflow
            className="h-3 w-3 shrink-0"
            style={{ color: categoryColor }}
          />
        )}
        {!isCardHeader && (isMultiTurn || isLiveNode) && (
          <span className="shrink-0 text-[10px]">🤖</span>
        )}
        <span className="flex-1 truncate text-xs">{labelText}</span>
        {/* Card header summary: child count + aggregate child duration */}
        {isCardHeader && cardChildCount != null && cardChildCount > 0 && (
          <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
            {cardChildCount} nodes
            {cardChildDurationSum != null && cardChildDurationSum > 0 && (
              <> · {formatDuration(cardChildDurationSum)}</>
            )}
          </span>
        )}
        {!isCardHeader && (isMultiTurn || isLiveNode) && turnCount > 0 && (
          <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
            Turn {turnCount}
            {maxTurns > 0 ? `/${maxTurns}` : ""}
          </span>
        )}
        {result.duration != null && (
          <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
            {formatDuration(result.duration)}
          </span>
        )}
        <StatusIcon status={result.status} />
      </button>

      {/* Multi-turn conversation items (only for AI agent rows, not card headers).
          spec/conventions/conversation-thread.md §9.6 "적용 surface" 표의
          2번째 행 — `ResultTimeline` 도 conversation Preview 와 동일한
          `groupToolCallItems` 결과를 사용해 blank intermediate assistant 를
          `🤖 AI · 🔧 N개 도구 호출` 한 줄 parent row 로 표시하고, 후행 tool
          row 들을 indented children 으로 nest 한다 (Inv-5). */}
      {!isCardHeader && isExpanded && items.length > 0 && (
        <div className="border-l-2 border-[hsl(var(--border))] ml-5 mb-1">
          {(() => {
            const { claimedToolIndices, childrenByParent } =
              groupToolCallItems(items);
            return items.map((item, idx) => {
              if (item.type === "tool" && claimedToolIndices.has(idx)) {
                return null;
              }
              const childIndices = childrenByParent.get(idx);
              const isParent =
                childIndices !== undefined && item.type === "assistant";
              if (isParent) {
                const toolCallCount =
                  item.assistantToolCalls?.length ?? childIndices.length;
                const parentSelected =
                  isSelected && ctx.selectedConversationItemIndex === idx;
                return (
                  <div key={`${rowId}-conv-${idx}-group`}>
                    <button
                      type="button"
                      onClick={() =>
                        ctx.handleConversationItemClick(rowId, idx)
                      }
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs",
                        "hover:bg-[hsl(var(--accent))]",
                        parentSelected && "bg-[hsl(var(--accent))]",
                      )}
                    >
                      <span className="shrink-0 text-[10px]">🤖</span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        AI
                      </span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        ·
                      </span>
                      <Wrench
                        size={10}
                        className="text-[hsl(var(--muted-foreground))]"
                      />
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {toolCallCount}개 도구 호출
                      </span>
                    </button>
                    {childIndices.length > 0 && (
                      <div className="ml-3 border-l border-[hsl(var(--border))] pl-2">
                        {childIndices.map((ci) => (
                          <ConversationTimelineItem
                            key={`${rowId}-conv-${ci}`}
                            item={items[ci]}
                            isSelected={
                              isSelected &&
                              ctx.selectedConversationItemIndex === ci
                            }
                            onClick={() =>
                              ctx.handleConversationItemClick(rowId, ci)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <ConversationTimelineItem
                  key={`${rowId}-conv-${idx}`}
                  item={item}
                  isSelected={
                    isSelected && ctx.selectedConversationItemIndex === idx
                  }
                  onClick={() => ctx.handleConversationItemClick(rowId, idx)}
                />
              );
            });
          })()}
        </div>
      )}
    </>
  );
}

/** Sub-Workflow card — wraps a `workflow`-type row with a styled box and
 *  recursively renders its children underneath when expanded. */
function SubWorkflowCard({
  tnode,
  ctx,
  renderChild,
}: {
  tnode: TimelineTreeNode;
  ctx: RowCtx;
  renderChild: (child: TimelineTreeNode) => React.ReactNode;
}) {
  const rowId = keyOf(tnode.result);
  // Sub-Workflow cards start expanded so users see the inline execution flow
  // immediately. They can be collapsed to hide internals.
  const isExpanded = ctx.expanded[rowId] ?? true;
  const childCount = countDescendants(tnode);
  const childDurationSum = sumDescendantDurations(tnode);
  const accent = statusAccentClass(tnode.result.status);

  return (
    <div
      className={`my-1 mx-2 rounded-md border border-l-2 border-[hsl(var(--border))] ${accent} bg-[hsl(var(--muted))/0.3] overflow-hidden`}
    >
      <div className="bg-[hsl(var(--muted))/0.6]">
        <TimelineRow
          tnode={tnode}
          ctx={{
            ...ctx,
            toggleExpand: ctx.toggleExpand, // header click toggles card
          }}
          renderAsCardHeader
          cardChildCount={childCount}
          cardChildDurationSum={childDurationSum}
        />
      </div>
      {isExpanded && tnode.children.length > 0 && (
        <div className="py-0.5">
          {tnode.children.map((child) => renderChild(child))}
        </div>
      )}
    </div>
  );
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

  // Auto-select first result if nothing selected
  useEffect(() => {
    if (!selectedId && results.length > 0) {
      onSelect(keyOf(results[0]));
    }
  }, [selectedId, results, onSelect]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }));
  }, []);

  // For Sub-Workflow cards the default is expanded — a toggle should flip
  // relative to that default, not to false.
  const toggleCardExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
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

  const tree = useMemo(() => buildTimelineTree(results), [results]);

  const ctx: RowCtx = {
    selectedId,
    selectedConversationItemIndex,
    conversationMessages,
    isLiveConversation,
    expanded,
    toggleExpand,
    handleNodeClick,
    handleConversationItemClick,
  };

  const renderTreeNode = (tnode: TimelineTreeNode): React.ReactNode => {
    const key = keyOf(tnode.result);
    // A Sub-Workflow node with children renders as a card. A Sub-Workflow
    // node without children (async mode, or before children have arrived)
    // renders as a regular row so the user still sees the invocation.
    if (isSubWorkflowNode(tnode.result) && tnode.children.length > 0) {
      return (
        <div key={key}>
          <SubWorkflowCard
            tnode={tnode}
            ctx={{ ...ctx, toggleExpand: toggleCardExpand }}
            renderChild={renderTreeNode}
          />
        </div>
      );
    }
    return (
      <div key={key}>
        <TimelineRow tnode={tnode} ctx={ctx} />
      </div>
    );
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {tree.map((tnode) => renderTreeNode(tnode))}
    </div>
  );
}
