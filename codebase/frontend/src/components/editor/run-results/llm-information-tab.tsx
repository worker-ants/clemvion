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
import { useT } from "@/lib/i18n";

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
   * lacks `_turnDebugHistory` (the engine strips `_resumeState` before
   * persisting), but WS event handlers attach per-assistant
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
  const t = useT();
  const aiMeta = useMemo(
    () => extractAiMetadata(result.outputData),
    [result.outputData],
  );

  if (calls.length === 0 && !aiMeta) {
    return (
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        {t("editor.llmInfo.noCallsAggregate")}
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
  rows.push({ label: t("editor.llmInfo.metaModel"), value: model ?? "-" });
  rows.push({
    label: t("editor.llmInfo.metaTotalTokens"),
    value: totalTokens != null ? String(totalTokens) : "-",
  });
  rows.push({
    label: t("editor.llmInfo.metaRequestTokens"),
    value: requestTokens != null ? String(requestTokens) : "-",
  });
  rows.push({
    label: t("editor.llmInfo.metaResponseTokens"),
    value: responseTokens != null ? String(responseTokens) : "-",
  });
  rows.push({
    label: t("editor.llmInfo.metaThinkingTokens"),
    value: thinkingTokens != null ? String(thinkingTokens) : "-",
  });
  if (turnCount != null) {
    rows.push({ label: t("editor.llmInfo.metaTurnCount"), value: String(turnCount) });
  }
  if (toolCalls != null) {
    rows.push({ label: t("editor.llmInfo.metaToolCalls"), value: String(toolCalls) });
  }
  rows.push({ label: t("editor.llmInfo.metaLlmCalls"), value: String(totalCalls) });

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-medium text-[hsl(var(--foreground))]">
        {t("editor.llmInfo.aggregateUsage")}
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
  const t = useT();
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

  const subTabs: { id: SubTabId; label: string }[] = [
    { id: "response", label: t("editor.llmInfo.tabResponse") },
    { id: "request", label: t("editor.llmInfo.tabRequest") },
    { id: "usage", label: t("editor.llmInfo.tabUsage") },
  ];

  if (calls.length === 0) {
    return (
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        {t("editor.llmInfo.noCallsForTurn")}
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
            {t("editor.llmInfo.callSelector")}
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
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                subTab === tab.id
                  ? "border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
              onClick={() => setInternalSubTab(tab.id)}
            >
              {tab.label}
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
  const t = useT();
  if (call.responsePayload == null) {
    return (
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        {t("editor.llmInfo.noResponsePayload")}
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
  const t = useT();
  if (call.requestPayload == null) {
    return (
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        {t("editor.llmInfo.noRequestPayload")}
      </div>
    );
  }
  const parsed = parseRequestPayload(call.requestPayload);
  const systemPromptLabel =
    parsed.systemPrompts.length > 1
      ? t("editor.llmInfo.systemPromptsLabel", {
          count: parsed.systemPrompts.length,
        })
      : t("editor.llmInfo.systemPromptLabel");
  const messagesLabel =
    parsed.nonSystemMessages.length > 0
      ? t("editor.llmInfo.messagesLabelWithCount", {
          count: parsed.nonSystemMessages.length,
        })
      : t("editor.llmInfo.messagesLabel");
  return (
    <div className="space-y-3 text-xs">
      {parsed.systemPrompts.length > 0 && (
        <RequestSection label={systemPromptLabel}>
          <div className="space-y-2">
            {parsed.systemPrompts.map((sp, i) => (
              <pre
                key={i}
                className="rounded bg-[hsl(var(--muted))] p-2 whitespace-pre-wrap break-words"
              >
                {sp}
              </pre>
            ))}
          </div>
        </RequestSection>
      )}
      {parsed.tools.length > 0 && (
        <RequestSection
          label={t("editor.llmInfo.toolsLabel", { count: parsed.tools.length })}
        >
          <div className="space-y-2">
            {parsed.tools.map((tool, i) => (
              <ToolSchemaCard key={`${tool.name}-${i}`} tool={tool} />
            ))}
          </div>
        </RequestSection>
      )}
      <RequestSection label={messagesLabel}>
        {parsed.nonSystemMessages.length === 0 ? (
          <p className="italic text-[hsl(var(--muted-foreground))]">
            {t("editor.llmInfo.noNonSystemMessages")}
          </p>
        ) : (
          <pre className="rounded bg-[hsl(var(--muted))] p-2 overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(parsed.nonSystemMessages, null, 2)}
          </pre>
        )}
      </RequestSection>
      {Object.keys(parsed.params).length > 0 && (
        <RequestSection label={t("editor.llmInfo.parametersLabel")}>
          <pre className="rounded bg-[hsl(var(--muted))] p-2 overflow-x-auto">
            {JSON.stringify(parsed.params, null, 2)}
          </pre>
        </RequestSection>
      )}
    </div>
  );
}

interface ParsedRequestTool {
  name: string;
  description?: string;
  parameters?: unknown;
}
interface ParsedRequest {
  systemPrompts: string[];
  tools: ParsedRequestTool[];
  nonSystemMessages: unknown[];
  params: Record<string, unknown>;
}

function parseRequestPayload(raw: unknown): ParsedRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { systemPrompts: [], tools: [], nonSystemMessages: [], params: {} };
  }
  const r = raw as Record<string, unknown>;
  const messages = Array.isArray(r.messages) ? r.messages : [];
  const systemPrompts: string[] = [];
  const nonSystemMessages: unknown[] = [];
  for (const m of messages) {
    if (
      m &&
      typeof m === "object" &&
      !Array.isArray(m) &&
      (m as Record<string, unknown>).role === "system" &&
      typeof (m as Record<string, unknown>).content === "string"
    ) {
      systemPrompts.push((m as { content: string }).content);
    } else {
      nonSystemMessages.push(m);
    }
  }
  const tools: ParsedRequestTool[] = Array.isArray(r.tools)
    ? (r.tools as unknown[]).flatMap((t) => {
        if (!t || typeof t !== "object" || Array.isArray(t)) return [];
        const obj = t as Record<string, unknown>;
        const name = typeof obj.name === "string" ? obj.name : "";
        if (!name) return [];
        return [
          {
            name,
            description:
              typeof obj.description === "string" ? obj.description : undefined,
            parameters: obj.parameters,
          },
        ];
      })
    : [];
  // 기타 파라미터 (model / temperature / maxTokens / responseFormat / jsonSchema 등)
  const { messages: _m, tools: _t, ...rest } = r;
  void _m;
  void _t;
  return { systemPrompts, tools, nonSystemMessages, params: rest };
}

function RequestSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details open className="rounded border border-[hsl(var(--border))]">
      <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.4)]">
        {label}
      </summary>
      <div className="border-t border-[hsl(var(--border))] p-2">{children}</div>
    </details>
  );
}

function ToolSchemaCard({ tool }: { tool: ParsedRequestTool }) {
  return (
    <div className="rounded bg-[hsl(var(--muted))] p-2">
      <div className="font-mono font-medium">{tool.name}</div>
      {tool.description && (
        <div className="mt-0.5 text-[hsl(var(--muted-foreground))]">
          {tool.description}
        </div>
      )}
      {tool.parameters !== undefined && (
        <pre className="mt-1.5 overflow-x-auto rounded bg-[hsl(var(--background))] p-1.5 text-[10px]">
          {JSON.stringify(tool.parameters, null, 2)}
        </pre>
      )}
    </div>
  );
}

function UsagePane({ call }: { call: LlmCallTrace }) {
  const t = useT();
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
          <div className="text-[hsl(var(--muted-foreground))]">{t("editor.llmInfo.metaModel")}</div>
          <div className="font-mono">{model}</div>
        </>
      )}
      <div className="text-[hsl(var(--muted-foreground))]">{t("editor.llmInfo.metaInputTokens")}</div>
      <div className="font-mono">{usage?.inputTokens ?? 0}</div>
      <div className="text-[hsl(var(--muted-foreground))]">{t("editor.llmInfo.metaOutputTokens")}</div>
      <div className="font-mono">{usage?.outputTokens ?? 0}</div>
      <div className="text-[hsl(var(--muted-foreground))]">{t("editor.llmInfo.metaTotalTokens")}</div>
      <div className="font-mono">
        {usage?.totalTokens ??
          (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)}
      </div>
      {usage?.thinkingTokens != null && (
        <>
          <div className="text-[hsl(var(--muted-foreground))]">
            {t("editor.llmInfo.metaThinkingTokens")}
          </div>
          <div className="font-mono">{usage.thinkingTokens}</div>
        </>
      )}
      {call.durationMs != null && (
        <>
          <div className="text-[hsl(var(--muted-foreground))]">{t("editor.llmInfo.metaLatency")}</div>
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
