"use client";

import { useMemo, useState } from "react";
import type {
  ConversationItem,
  NodeResult,
} from "@/lib/stores/execution-store";
import {
  countCallsPerTurn,
  extractLlmCalls,
  labelForCall,
  type LlmCallTrace,
} from "./llm-call-trace";
import { extractAiMetadata } from "./output-shape";

type LlmInfoMode = "aggregate" | "single-call";

interface LlmInformationTabProps {
  result: NodeResult;
  /**
   * `aggregate` — node-level view. Sums tokens across every LLM call the node
   * issued and renders a compact Usage grid (no Response / Request panes).
   * This is the default when no conversation message is selected.
   *
   * `single-call` — message-level view. Renders Response / Request / Usage
   * sub-tabs for the specific call identified by `targetTurnIndex`. The caller
   * is expected to remount the component (via `key`) when the target turn
   * changes, so we can derive a clean default sub-tab without an effect.
   */
  mode?: LlmInfoMode;
  /** Required when `mode === 'single-call'` — the conversation turn whose
   *  LLM call(s) should be shown. When a turn contains multiple calls (tool
   *  loop, retry), a small selector appears inside the tab. */
  targetTurnIndex?: number;
  /**
   * Fallback data source. During live waiting sessions, `result.outputData`
   * lacks `_turnDebugHistory` (engine strips `_multiTurnState` from WS
   * events), but WS event handlers attach per-assistant
   * `requestPayload`/`responsePayload` directly onto these items. When the
   * primary extraction returns no calls, traces are derived from here.
   */
  conversationMessages?: ConversationItem[];
  /**
   * When supplied, the component skips its internal sub-tab bar and renders
   * only the requested pane. Used by `result-detail.tsx` after the flatten —
   * Response / Request / LLM Usage live as top-level tabs in the parent,
   * each mounting this component with a fixed pane.
   */
  forcedSubTab?: SubTabId;
  /**
   * Controlled call-selector index. Lifted to the parent so the selection
   * persists when the user switches between the flattened top-level tabs
   * (Response ↔ Request ↔ LLM Usage), which would otherwise unmount this
   * component and reset internal state.
   */
  selectedCallIndex?: number;
  onSelectCallIndex?: (index: number) => void;
}

type SubTabId = "response" | "request" | "usage";

const SUB_TABS: { id: SubTabId; label: string }[] = [
  { id: "response", label: "Response" },
  { id: "request", label: "Request" },
  { id: "usage", label: "Usage" },
];

export function LlmInformationTab({
  result,
  mode = "aggregate",
  targetTurnIndex,
  conversationMessages,
  forcedSubTab,
  selectedCallIndex,
  onSelectCallIndex,
}: LlmInformationTabProps) {
  const allCalls = useMemo(
    () => extractLlmCalls(result.outputData, conversationMessages),
    [result.outputData, conversationMessages],
  );

  if (mode === "aggregate") {
    return <AggregateUsage result={result} calls={allCalls} />;
  }

  const turnCalls = allCalls.filter((c) => c.turnIndex === targetTurnIndex);
  return (
    <SingleCallView
      calls={turnCalls}
      allCalls={allCalls}
      forcedSubTab={forcedSubTab}
      selectedCallIndex={selectedCallIndex}
      onSelectCallIndex={onSelectCallIndex}
    />
  );
}

/**
 * Node-level view: sums token usage across every call in the node's run and
 * renders the same grid the Output tab already uses. This is deliberately
 * read-only — the user navigates to a specific message (via timeline or
 * Preview) to inspect per-call Response / Request.
 */
function AggregateUsage({
  result,
  calls,
}: {
  result: NodeResult;
  calls: LlmCallTrace[];
}) {
  const aiMeta = useMemo(
    () => extractAiMetadata(result.outputData),
    [result.outputData],
  );

  if (calls.length === 0 && !aiMeta) {
    return (
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        LLM 호출 정보가 저장되어 있지 않습니다. (이전 버전 실행 기록 또는
        아직 호출이 이루어지지 않은 상태일 수 있습니다.)
      </div>
    );
  }

  // Prefer the handler-reported aggregate (covers the Info Extractor +
  // AI Agent metadata grid fields); fall back to per-call sums when the
  // handler didn't surface totals.
  const totalCalls = calls.length;
  const perCallSum = calls.reduce(
    (acc, c) => {
      const resp = c.responsePayload as
        | { usage?: { inputTokens?: number; outputTokens?: number; thinkingTokens?: number } }
        | undefined;
      const usage = resp?.usage;
      acc.request += usage?.inputTokens ?? 0;
      acc.response += usage?.outputTokens ?? 0;
      acc.thinking += usage?.thinkingTokens ?? 0;
      return acc;
    },
    { request: 0, response: 0, thinking: 0 },
  );
  const requestTokens = aiMeta?.requestTokens ?? perCallSum.request;
  const responseTokens = aiMeta?.responseTokens ?? perCallSum.response;
  const totalTokens = aiMeta?.totalTokens ?? requestTokens + responseTokens;
  const thinkingTokens = aiMeta?.thinkingTokens ?? perCallSum.thinking;
  const model = aiMeta?.model ?? extractFirstModel(calls);
  const turnCount = aiMeta?.turnCount;
  const toolCalls = aiMeta?.toolCalls;

  const rows: Array<{ label: string; value: string }> = [];
  rows.push({ label: "Model", value: model ?? "-" });
  rows.push({
    label: "Total Tokens",
    value: totalTokens != null ? String(totalTokens) : "-",
  });
  rows.push({
    label: "Request Tokens",
    value: requestTokens != null ? String(requestTokens) : "-",
  });
  rows.push({
    label: "Response Tokens",
    value: responseTokens != null ? String(responseTokens) : "-",
  });
  rows.push({
    label: "Thinking Tokens",
    value: thinkingTokens != null ? String(thinkingTokens) : "-",
  });
  if (turnCount != null) {
    rows.push({ label: "Turn Count", value: String(turnCount) });
  }
  if (toolCalls != null) {
    rows.push({ label: "Tool Calls", value: String(toolCalls) });
  }
  rows.push({ label: "LLM Calls", value: String(totalCalls) });

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-medium text-[hsl(var(--foreground))]">
        Usage
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <div className="text-[hsl(var(--muted-foreground))]">{r.label}</div>
            <div className="font-mono text-[hsl(var(--foreground))]">
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function extractFirstModel(calls: LlmCallTrace[]): string | null {
  for (const c of calls) {
    const resp = c.responsePayload as { model?: string } | undefined;
    if (resp?.model) return resp.model;
  }
  return null;
}

/**
 * Message-level view: renders the Response / Request / Usage pane for the
 * call(s) of a specific turn. When the turn emitted multiple calls (tool
 * loop, collection retry) the user can switch between them.
 *
 * Two modes:
 *  - `forcedSubTab` omitted → renders the internal sub-tab bar (legacy).
 *  - `forcedSubTab` provided → renders only that pane; sub-tab bar hidden.
 *    The parent drives the pane selection via its own top-level tab bar.
 *
 * The call selector is always rendered (when calls.length > 1). Its state
 * can be lifted out via `selectedCallIndex` / `onSelectCallIndex` so that
 * selection persists across parent-driven remounts.
 */
function SingleCallView({
  calls,
  allCalls,
  forcedSubTab,
  selectedCallIndex,
  onSelectCallIndex,
}: {
  calls: LlmCallTrace[];
  allCalls: LlmCallTrace[];
  forcedSubTab?: SubTabId;
  selectedCallIndex?: number;
  onSelectCallIndex?: (index: number) => void;
}) {
  const turnCounts = useMemo(() => countCallsPerTurn(allCalls), [allCalls]);
  const [internalIndex, setInternalIndex] = useState(0);
  const [internalSubTab, setInternalSubTab] = useState<SubTabId>("response");

  const isControlled = selectedCallIndex !== undefined;
  const rawIndex = isControlled ? selectedCallIndex! : internalIndex;
  const setIndex = (i: number) => {
    if (isControlled) onSelectCallIndex?.(i);
    else setInternalIndex(i);
  };
  const subTab: SubTabId = forcedSubTab ?? internalSubTab;

  if (calls.length === 0) {
    return (
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        해당 턴에 대한 LLM 호출 정보가 저장되어 있지 않습니다.
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(rawIndex, 0), calls.length - 1);
  const active = calls[safeIndex];

  return (
    <div className="flex h-full flex-col gap-3">
      {calls.length > 1 && (
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Call
          </label>
          <select
            className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs"
            value={safeIndex}
            onChange={(e) => setIndex(Number(e.target.value))}
          >
            {calls.map((c, i) => (
              <option key={i} value={i}>
                {labelForCall(c, turnCounts)}
              </option>
            ))}
          </select>
        </div>
      )}
      {forcedSubTab === undefined && (
        <div className="flex gap-1 border-b border-[hsl(var(--border))]">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                subTab === t.id
                  ? "border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
              onClick={() => setInternalSubTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {subTab === "response" && <ResponsePane call={active} />}
        {subTab === "request" && <RequestPane call={active} />}
        {subTab === "usage" && <UsagePane call={active} />}
      </div>
    </div>
  );
}

function ResponsePane({ call }: { call: LlmCallTrace }) {
  if (call.responsePayload == null) {
    return (
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        응답 페이로드 없음
      </div>
    );
  }
  return (
    <pre className="rounded bg-[hsl(var(--muted))] p-2 text-xs overflow-x-auto max-h-[60vh] overflow-y-auto">
      {JSON.stringify(call.responsePayload, null, 2)}
    </pre>
  );
}

function RequestPane({ call }: { call: LlmCallTrace }) {
  if (call.requestPayload == null) {
    return (
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        요청 페이로드 없음
      </div>
    );
  }
  return (
    <pre className="rounded bg-[hsl(var(--muted))] p-2 text-xs overflow-x-auto max-h-[60vh] overflow-y-auto">
      {JSON.stringify(call.requestPayload, null, 2)}
    </pre>
  );
}

function UsagePane({ call }: { call: LlmCallTrace }) {
  const response = call.responsePayload as
    | { model?: string; usage?: Record<string, unknown> }
    | undefined;
  const model = response?.model;
  const usage = response?.usage as
    | {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        thinkingTokens?: number;
      }
    | undefined;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
      {model && (
        <>
          <div className="text-[hsl(var(--muted-foreground))]">Model</div>
          <div className="font-mono">{model}</div>
        </>
      )}
      <div className="text-[hsl(var(--muted-foreground))]">Input Tokens</div>
      <div className="font-mono">{usage?.inputTokens ?? 0}</div>
      <div className="text-[hsl(var(--muted-foreground))]">Output Tokens</div>
      <div className="font-mono">{usage?.outputTokens ?? 0}</div>
      <div className="text-[hsl(var(--muted-foreground))]">Total Tokens</div>
      <div className="font-mono">
        {usage?.totalTokens ??
          (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)}
      </div>
      {usage?.thinkingTokens != null && (
        <>
          <div className="text-[hsl(var(--muted-foreground))]">
            Thinking Tokens
          </div>
          <div className="font-mono">{usage.thinkingTokens}</div>
        </>
      )}
      {call.durationMs != null && (
        <>
          <div className="text-[hsl(var(--muted-foreground))]">Latency</div>
          <div className="font-mono">
            {call.durationMs < 1000
              ? `${call.durationMs}ms`
              : `${(call.durationMs / 1000).toFixed(2)}s`}
          </div>
        </>
      )}
    </div>
  );
}
