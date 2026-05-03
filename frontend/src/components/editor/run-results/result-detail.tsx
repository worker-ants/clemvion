import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  PauseCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { getCategoryColor, getNodeDefinition } from "@/lib/node-definitions";
import type {
  NodeResult,
  ConversationItem,
} from "@/lib/stores/execution-store";
import { useExecutionInteractionCommands } from "@/lib/websocket/use-execution-interaction-commands";
import { PresentationContent, JsonContent } from "./renderers/presentation-renderers";
import { GenericRenderer } from "./renderers/generic-renderer";
import {
  unwrapNodeOutput,
  isConversationOutput,
  extractAiMetadata,
  extractIeSnapshot,
  type AiMetadata,
  type RagSource,
  type RagDiagnostics,
} from "./output-shape";
import { ExtractedFieldsCard } from "./extracted-fields-card";
import { LlmInformationTab } from "./llm-information-tab";
import { DynamicFormUI } from "./dynamic-form-ui";
import { ButtonBar } from "./button-bar";
import { ConversationInspector } from "./conversation-inspector";
import { parseHistoryMessages } from "./conversation-utils";
import { formatDuration } from "./utils";
import { parseButtonConfig, openExternalLink } from "./button-config";

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

type DetailTab =
  | "preview"
  | "input"
  | "output"
  | "meta"
  | "port"
  | "status"
  | "llm_usage"
  | "response"
  | "request"
  | "config"
  | "references"
  | "error";

const AI_NODE_TYPES = new Set([
  "ai_agent",
  "information_extractor",
  "text_classifier",
]);

function isAiNode(nodeType: string): boolean {
  return AI_NODE_TYPES.has(nodeType);
}

interface NodeDetailTabsProps {
  result: NodeResult;
  /** Custom preview content (e.g. interactive buttons/form). When provided, overrides the default PresentationContent preview. */
  previewContent?: React.ReactNode;
  /** Whether to show the preview tab. Defaults to: presentation node with outputData, or previewContent provided. */
  hasPreview?: boolean;
  /**
   * Currently-selected conversation message (from store) — drives the
   * "message-level" view where only a reduced set of tabs applies:
   *   - user / tool → Preview only
   *   - assistant → Preview + Response + Request + LLM Usage
   * When `null` we render the node-level view (all tabs, incl. LLM Usage).
   */
  selectedMessage?: ConversationItem | null;
  /**
   * Conversation items to feed `LlmInformationTab` as a fallback for live
   * waiting sessions (where outputData lacks `_turnDebugHistory`).
   */
  conversationMessages?: ConversationItem[];
  /** Lifted active tab — Preview chip 의 References 점프와 동기화하기 위해 controlled. */
  activeTab: DetailTab;
  onActiveTabChange: (tab: DetailTab) => void;
  /** chip 점프 시 References 탭 안에서 자동 스크롤 + 강조할 turn. */
  highlightTurnIndex: number | null;
  /** 미리 계산된 AI 메타데이터 — Preview chip 과 References 탭이 동일 객체 공유. */
  aiMetadata: AiMetadata | null;
}

function NodeDetailTabs({
  result,
  previewContent,
  hasPreview,
  selectedMessage,
  conversationMessages,
  activeTab,
  onActiveTabChange,
  highlightTurnIndex,
  aiMetadata,
}: NodeDetailTabsProps) {
  const isPresentation = result.nodeCategory === "presentation";
  const showPreview = hasPreview ?? (isPresentation && !!result.outputData);
  const aiNode = isAiNode(result.nodeType);
  const messageLevel = selectedMessage != null;
  const isAssistantSelected =
    messageLevel && selectedMessage?.type === "assistant";

  const unwrapped = unwrapNodeOutput(result.outputData);

  // Tab visibility:
  //   - Preview is always available when hasPreview (works for both levels).
  //   - Input / Output / Config are node-level concepts — hidden for
  //     message-level selections.
  //   - Response / Request: flattened single-call panes; only when an
  //     assistant message is selected (user / tool messages have no LLM call).
  //   - LLM Usage: node-level aggregate for AI nodes, plus per-call usage
  //     when an assistant message is selected.
  //   - References: AI 노드에서 KB 가 시도된 경우만 (단일/멀티 모두). 메시지
  //     선택 상태와 무관하게 항상 노출되어 chip 점프 후에도 사라지지 않는다.
  //   - Error: only when result.error is set — node-level only.
  const hasMeta = !messageLevel && !!unwrapped.meta && Object.keys(unwrapped.meta).length > 0;
  const hasPort = !messageLevel && unwrapped.port != null;
  const hasStatus = !messageLevel && unwrapped.status != null;
  const hasReferences =
    aiNode &&
    !!aiMetadata &&
    (aiMetadata.ragSources.length > 0 ||
      !!aiMetadata.ragDiagnostics?.attempted ||
      aiMetadata.turnDebug.some(
        (t) => t.ragSources.length > 0 || !!t.ragDiagnostics?.attempted,
      ));

  const detailTabs: { id: DetailTab; label: string; show: boolean }[] = [
    { id: "preview", label: "Preview", show: showPreview },
    { id: "input", label: "Input", show: !messageLevel },
    { id: "output", label: "Output", show: !messageLevel },
    { id: "response", label: "Response", show: aiNode && isAssistantSelected },
    { id: "request", label: "Request", show: aiNode && isAssistantSelected },
    {
      id: "llm_usage",
      label: "LLM Usage",
      show: aiNode && (!messageLevel || isAssistantSelected),
    },
    { id: "references", label: "References", show: hasReferences },
    { id: "config", label: "Config", show: !messageLevel },
    { id: "meta", label: "Meta", show: hasMeta },
    { id: "port", label: "Port", show: hasPort },
    { id: "status", label: "Status", show: hasStatus },
    { id: "error", label: "Error", show: !messageLevel && !!result.error },
  ];
  const visibleIds = new Set(
    detailTabs.filter((t) => t.show).map((t) => t.id),
  );

  // If the active tab disappears (e.g. user clicks a message and Output
  // hides), fall back through: hasPreview → "preview", else "output" if
  // visible (default for non-presentation nodes that lack a preview), else
  // the first visible tab. Keeps the lifted activeTab="preview" default
  // working for both presentation and data-only nodes.
  const effectiveActiveTab: DetailTab = visibleIds.has(activeTab)
    ? activeTab
    : showPreview
      ? "preview"
      : visibleIds.has("output")
        ? "output"
        : (detailTabs.find((t) => t.show)?.id ?? activeTab);

  // Lifted call-selector state — keeps the chosen call in sync across
  // Response ↔ Request ↔ LLM Usage tab switches (each mounts/unmounts
  // LlmInformationTab, so internal state would otherwise reset). Resets to
  // 0 when the selected assistant message changes via the "adjusting state
  // while rendering" pattern (avoids a setState-in-effect cascade).
  const selectedTurnIndex = isAssistantSelected
    ? selectedMessage!.turnIndex
    : null;
  const [callTurnKey, setCallTurnKey] = useState<number | null>(
    selectedTurnIndex,
  );
  const [selectedCallIndex, setSelectedCallIndex] = useState(0);
  if (selectedTurnIndex !== callTurnKey) {
    setCallTurnKey(selectedTurnIndex);
    setSelectedCallIndex(0);
  }

  return (
    <>
      {/* Tab bar */}
      <div className="shrink-0 flex gap-2 border-b border-[hsl(var(--border))] px-3">
        {detailTabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                "py-1.5 text-xs font-medium transition-colors",
                effectiveActiveTab === t.id
                  ? "border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
              onClick={() => onActiveTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
      </div>
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {effectiveActiveTab === "preview" && (
          previewContent ?? (isPresentation && <PresentationContent result={result} previewOnly />)
        )}
        {effectiveActiveTab === "input" && (
          result.inputData != null
            ? <JsonContent data={result.inputData} />
            : <span className="text-xs text-[hsl(var(--muted-foreground))]">Loading input data...</span>
        )}
        {effectiveActiveTab === "output" && (
          <OutputTabContent
            unwrapped={unwrapped}
            aiMetadata={aiMetadata}
            ieSnapshot={extractIeSnapshot(result.outputData)}
          />
        )}
        {effectiveActiveTab === "response" && isAssistantSelected && (
          <LlmInformationTab
            key={`msg-${selectedMessage!.turnIndex}`}
            result={result}
            mode="single-call"
            targetTurnIndex={selectedMessage!.turnIndex}
            conversationMessages={conversationMessages}
            forcedSubTab="response"
            selectedCallIndex={selectedCallIndex}
            onSelectCallIndex={setSelectedCallIndex}
          />
        )}
        {effectiveActiveTab === "request" && isAssistantSelected && (
          <LlmInformationTab
            key={`msg-${selectedMessage!.turnIndex}`}
            result={result}
            mode="single-call"
            targetTurnIndex={selectedMessage!.turnIndex}
            conversationMessages={conversationMessages}
            forcedSubTab="request"
            selectedCallIndex={selectedCallIndex}
            onSelectCallIndex={setSelectedCallIndex}
          />
        )}
        {effectiveActiveTab === "llm_usage" && (
          isAssistantSelected ? (
            <LlmInformationTab
              key={`msg-${selectedMessage!.turnIndex}`}
              result={result}
              mode="single-call"
              targetTurnIndex={selectedMessage!.turnIndex}
              conversationMessages={conversationMessages}
              forcedSubTab="usage"
              selectedCallIndex={selectedCallIndex}
              onSelectCallIndex={setSelectedCallIndex}
            />
          ) : (
            <LlmInformationTab
              key="aggregate"
              result={result}
              mode="aggregate"
              conversationMessages={conversationMessages}
            />
          )
        )}
        {effectiveActiveTab === "references" && aiMetadata && (
          <ReferencesTabContent
            meta={aiMetadata}
            highlightTurnIndex={highlightTurnIndex}
          />
        )}
        {effectiveActiveTab === "config" && (
          <ConfigTabContent unwrapped={unwrapped} />
        )}
        {effectiveActiveTab === "meta" && (
          <MetaTabContent
            meta={unwrapped.meta}
            aiMetadata={aiMetadata}
          />
        )}
        {effectiveActiveTab === "port" && (
          <SingleValueTab
            label="Port"
            value={unwrapped.port}
            hint="Emitted output port id. Downstream edges attached to this port will fire."
          />
        )}
        {effectiveActiveTab === "status" && (
          <SingleValueTab
            label="Status"
            value={unwrapped.status}
            hint="Engine directive from the handler (e.g. waiting_for_input, requires_integration)."
          />
        )}
        {effectiveActiveTab === "error" && (
          <JsonContent data={result.error} />
        )}
      </div>
    </>
  );
}

/**
 * Output tab — shows the actual produced value. `meta`, `port`, and `status`
 * are surfaced as dedicated tabs (see `MetaTabContent` / `SingleValueTab`)
 * rather than pills here, so each is inspectable as a first-class variable.
 * For AI nodes, a 2-column metadata grid (Model / Tokens / Turn Count / Tool
 * Calls) still anchors the top of this tab for scanability.
 */
function OutputTabContent({
  unwrapped,
  aiMetadata,
  ieSnapshot,
}: {
  unwrapped: ReturnType<typeof unwrapNodeOutput>;
  aiMetadata: AiMetadata | null;
  ieSnapshot: ReturnType<typeof extractIeSnapshot>;
}) {
  return (
    <div className="space-y-3">
      {aiMetadata && <AiMetadataGrid meta={aiMetadata} />}
      {ieSnapshot && (
        <ExtractedFieldsCard
          fields={ieSnapshot.fields}
          schema={ieSnapshot.schema}
          retryInfo={ieSnapshot.retry}
        />
      )}
      <JsonContent data={unwrapped.output} />
      {!unwrapped.isStructured && (
        <p className="text-[10px] italic text-[hsl(var(--muted-foreground))]">
          Legacy output shape — config/meta not separately recorded.
        </p>
      )}
    </div>
  );
}

/**
 * Meta tab — shows observability metadata (durationMs, statusCode, token
 * counts, etc.). For AI nodes, surfaces the same 2-column grid as the Output
 * tab so users who open Meta first still see canonical fields. The full raw
 * JSON always renders below to expose every field handlers emit.
 */
function MetaTabContent({
  meta,
  aiMetadata,
}: {
  meta: Record<string, unknown> | null;
  aiMetadata: AiMetadata | null;
}) {
  if (!meta) {
    return (
      <span className="text-xs text-[hsl(var(--muted-foreground))]">
        This node didn&apos;t record meta — it may be a handler still on the
        legacy output shape.
      </span>
    );
  }
  return (
    <div className="space-y-3">
      {aiMetadata && <AiMetadataGrid meta={aiMetadata} />}
      <JsonContent data={meta} />
    </div>
  );
}

/** Simple label + value card for single-scalar tabs (Port, Status). */
function SingleValueTab({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          {label}
        </span>
        <code className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--foreground))]">
          {value ?? "—"}
        </code>
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{hint}</p>
    </div>
  );
}

/**
 * 2-column label-value grid of canonical AI metadata. Hides rows whose value
 * is missing and is only optional for that node type (turnCount / toolCalls),
 * so Text Classifier's grid stays compact.
 */
function AiMetadataGrid({ meta }: { meta: AiMetadata }) {
  const rows: Array<{ label: string; value: string }> = [];
  rows.push({ label: "Model", value: meta.model ?? "-" });
  rows.push({
    label: "Total Tokens",
    value: meta.totalTokens != null ? String(meta.totalTokens) : "-",
  });
  rows.push({
    label: "Request Tokens",
    value: meta.requestTokens != null ? String(meta.requestTokens) : "-",
  });
  rows.push({
    label: "Response Tokens",
    value: meta.responseTokens != null ? String(meta.responseTokens) : "-",
  });
  rows.push({
    label: "Thinking Tokens",
    value: meta.thinkingTokens != null ? String(meta.thinkingTokens) : "-",
  });
  if (meta.turnCount != null) {
    rows.push({ label: "Turn Count", value: String(meta.turnCount) });
  }
  if (meta.toolCalls != null) {
    rows.push({ label: "Tool Calls", value: String(meta.toolCalls) });
  }

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <div className="text-[hsl(var(--muted-foreground))]">{r.label}</div>
          <div className="text-[hsl(var(--foreground))]">{r.value}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * RAG references — AI Agent 응답 생성에 활용된 KB 청크 목록과 진단을 한눈에 보여준다.
 * 백엔드는 meta.ragSources / meta.ragDiagnostics 로 항상 채워서 보내므로, 사용자는
 * "왜 KB 가 안 잡혔는지" 또는 "어떤 문서를 참조했는지" 를 즉시 확인할 수 있다.
 */
function RagReferencesSection({
  sources,
  diagnostics,
}: {
  sources: RagSource[];
  diagnostics: RagDiagnostics | null;
}) {
  // 한 번도 RAG 가 시도되지 않았고 sources 도 없으면 섹션 숨김 (KB 미사용 노드).
  if (!diagnostics && sources.length === 0) return null;
  if (diagnostics && !diagnostics.attempted && sources.length === 0) {
    return (
      <div className="rounded border border-dashed border-[hsl(var(--border))] p-2 text-xs text-[hsl(var(--muted-foreground))]">
        <div className="font-medium">References</div>
        <div className="mt-1">
          {ragSkipReasonLabel(diagnostics.skipReason)}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded border border-[hsl(var(--border))] p-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">References</span>
        <span className="text-[hsl(var(--muted-foreground))]">
          {sources.length} chunk(s)
          {diagnostics ? ` · ${diagnostics.searchedKbCount} KB` : ""}
        </span>
      </div>
      {diagnostics && diagnostics.queriesUsed.length > 0 && (
        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Queries used:{" "}
          {diagnostics.queriesUsed.map((q, i) => (
            <span
              key={`${q}-${i}`}
              className="ml-1 inline-block rounded bg-[hsl(var(--muted))] px-1 py-0.5 font-mono"
            >
              {q}
            </span>
          ))}
        </div>
      )}
      {sources.length === 0 && diagnostics?.skipReason === "no_results" && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {ragSkipReasonLabel("no_results")}
        </p>
      )}
      {sources.length > 0 && (
        <ul className="space-y-1.5">
          {sources.map((s) => (
            <li
              key={s.chunkId}
              className="rounded bg-[hsl(var(--muted)/0.4)] p-1.5 text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{s.documentName}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                  {s.score.toFixed(2)}
                </span>
                {s.origin && (
                  <span className="shrink-0 rounded bg-[hsl(var(--background))] px-1 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                    {s.origin}
                  </span>
                )}
              </div>
              <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-[hsl(var(--muted-foreground))]">
                {s.content}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ragSkipReasonLabel(
  reason: RagDiagnostics["skipReason"] | undefined,
): string {
  switch (reason) {
    case "empty_kb_list":
      return "No knowledge bases configured for this node.";
    case "empty_user_prompt":
      return "User message was empty — RAG search skipped.";
    case "no_results":
      return "No matching chunks found above threshold.";
    default:
      return "RAG search did not run.";
  }
}

/**
 * References 탭 — AI Agent / Information Extractor 응답 생성에 사용된 KB 청크를
 * "노드 전체 누적 요약 + turn 단위 그룹" 으로 보여준다. Preview 탭 chip 에서
 * 점프해 오는 진입점이며, `highlightTurnIndex` 가 주어지면 그 turn 그룹을
 * 자동 스크롤 + 강조 outline 으로 사용자 시선을 안내한다.
 */
function ReferencesTabContent({
  meta,
  highlightTurnIndex,
}: {
  meta: AiMetadata;
  highlightTurnIndex: number | null;
}) {
  const turnEntries = meta.turnDebug.filter(
    (t) => t.ragSources.length > 0 || !!t.ragDiagnostics?.attempted,
  );
  const refMap = useRef(new Map<number, HTMLLIElement | null>());

  useEffect(() => {
    if (highlightTurnIndex == null) return;
    const el = refMap.current.get(highlightTurnIndex);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlightTurnIndex]);

  // turnDebug 가 비어있는 (legacy / 단일턴) 경우엔 노드 전체 누적만 단일 카드로.
  if (turnEntries.length === 0) {
    return (
      <div className="space-y-3">
        <RagReferencesSection
          sources={meta.ragSources}
          diagnostics={meta.ragDiagnostics}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <NodeAggregateRagSummary
        sources={meta.ragSources}
        diagnostics={meta.ragDiagnostics}
        turnCount={turnEntries.length}
      />
      <ul className="space-y-2">
        {turnEntries.map((entry) => (
          <li
            key={entry.turnIndex}
            ref={(el) => {
              refMap.current.set(entry.turnIndex, el);
            }}
            className={cn(
              "rounded border border-[hsl(var(--border))] p-2 transition-shadow",
              highlightTurnIndex === entry.turnIndex &&
                "border-[hsl(var(--primary))] shadow-[0_0_0_1px_hsl(var(--primary))]",
            )}
          >
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium">Turn {entry.turnIndex}</span>
              <span className="text-[hsl(var(--muted-foreground))]">
                {entry.ragSources.length} chunk(s)
                {entry.ragDiagnostics
                  ? ` · ${entry.ragDiagnostics.searchedKbCount} KB`
                  : ""}
              </span>
            </div>
            <RagReferencesSection
              sources={entry.ragSources}
              diagnostics={entry.ragDiagnostics}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 노드 전체 누적 RAG 요약 — References 탭의 상단 헤더 카드. */
function NodeAggregateRagSummary({
  sources,
  diagnostics,
  turnCount,
}: {
  sources: RagSource[];
  diagnostics: RagDiagnostics | null;
  turnCount: number;
}) {
  const totalChunks = sources.length;
  return (
    <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Node total</span>
        <span className="text-[hsl(var(--muted-foreground))]">
          {totalChunks} chunk(s) across {turnCount} turn(s)
          {diagnostics ? ` · ${diagnostics.searchedKbCount} KB` : ""}
        </span>
      </div>
      {diagnostics && diagnostics.queriesUsed.length > 0 && (
        <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
          Queries:{" "}
          {diagnostics.queriesUsed.map((q, i) => (
            <span
              key={`${q}-${i}`}
              className="ml-1 inline-block rounded bg-[hsl(var(--background))] px-1 py-0.5 font-mono"
            >
              {q}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Config tab — shows the resolved settings the node actually executed with.
 * Uses the handler-echoed `config` when the new shape is in effect; otherwise
 * reports that no config was captured (the node is still on the legacy shape).
 */
function ConfigTabContent({
  unwrapped,
}: {
  unwrapped: ReturnType<typeof unwrapNodeOutput>;
}) {
  const echo = unwrapped.config;
  if (!echo || Object.keys(echo).length === 0) {
    return (
      <span className="text-xs text-[hsl(var(--muted-foreground))]">
        This node didn&apos;t record a config — it may be a handler still on
        the legacy output shape.
      </span>
    );
  }
  return <JsonContent data={echo} />;
}

interface ResultDetailProps {
  result: NodeResult | null;
  isWaitingForm: boolean;
  formConfig: unknown;
  isWaitingButtons: boolean;
  buttonConfig: unknown;
  isWaitingConversation: boolean;
  conversationConfig: unknown;
  conversationMessages: ConversationItem[];
  selectedConversationItemIndex: number | null;
  isWaitingAiResponse: boolean;
  executionId: string | null;
  onFormSubmit: () => void;
  onButtonClick: () => void;
  onConversationEnd: () => void;
  /**
   * Dispatches a change to the shared conversation-item selection. Called
   * when the user clicks a message inside the Preview-tab conversation or
   * hits "← Back to conversation". The drawer wires this to the execution
   * store's `selectConversationItem` so timeline and detail stay in sync.
   */
  onSelectConversationItem?: (index: number | null) => void;
}

export function ResultDetail({
  result,
  isWaitingForm,
  formConfig,
  isWaitingButtons,
  buttonConfig,
  isWaitingConversation,
  conversationConfig,
  conversationMessages,
  selectedConversationItemIndex,
  isWaitingAiResponse,
  executionId,
  onFormSubmit,
  onButtonClick,
  onConversationEnd,
  onSelectConversationItem,
}: ResultDetailProps) {
  const commands = useExecutionInteractionCommands(executionId);

  const handleSelectMessage = useCallback(
    (index: number) => onSelectConversationItem?.(index),
    [onSelectConversationItem],
  );
  const handleBackToConversation = useCallback(
    () => onSelectConversationItem?.(null),
    [onSelectConversationItem],
  );

  const handleFormSubmit = useCallback(
    (data: Record<string, unknown>) => {
      if (!executionId) return;
      commands.submitForm(data);
      onFormSubmit();
    },
    [executionId, commands, onFormSubmit],
  );

  const handlePortButtonClick = useCallback(
    (buttonId: string) => {
      if (!executionId) return;
      commands.clickButton(buttonId);
      onButtonClick();
    },
    [executionId, commands, onButtonClick],
  );

  const handleContinueClick = useCallback(() => {
    if (!executionId) return;
    commands.clickContinue();
    onButtonClick();
  }, [executionId, commands, onButtonClick]);

  const handleLinkButtonClick = useCallback((url: string) => {
    openExternalLink(url);
  }, []);

  const handleSendMessage = useCallback(
    (message: string) => {
      if (!executionId || !result) return;
      commands.sendMessage(result.nodeId, message);
    },
    [executionId, result, commands],
  );

  const handleEndConversation = useCallback(() => {
    if (!executionId || !result) return;
    commands.endConversation(result.nodeId);
    onConversationEnd();
  }, [executionId, result, commands, onConversationEnd]);

  // Lifted active tab + highlight — Preview chip 의 References 탭 점프와
  // 동기화하기 위해 ResultDetail 이 단일 source-of-truth 역할.
  const [activeTab, setActiveTab] = useState<DetailTab>("preview");
  const [activeTabNodeId, setActiveTabNodeId] = useState<string | null>(null);
  const [highlightTurnIndex, setHighlightTurnIndex] = useState<number | null>(
    null,
  );
  // 노드가 바뀌면 탭/하이라이트 초기화 (선택 노드별 독립).
  if (result && activeTabNodeId !== result.nodeId) {
    setActiveTabNodeId(result.nodeId);
    setActiveTab(result.error ? "error" : "preview");
    setHighlightTurnIndex(null);
  }
  const handleActiveTabChange = useCallback((tab: DetailTab) => {
    setActiveTab(tab);
    if (tab !== "references") setHighlightTurnIndex(null);
  }, []);
  const handleJumpToReferences = useCallback((turnIndex: number) => {
    setActiveTab("references");
    setHighlightTurnIndex(turnIndex);
  }, []);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
        Select a node to view details
      </div>
    );
  }

  const definition = getNodeDefinition(result.nodeType);
  const categoryColor = getCategoryColor(result.nodeCategory);
  const isPresentation = result.nodeCategory === "presentation";

  const aiMetadata = extractAiMetadata(result.outputData);
  // turnIndex → 그 턴에서 사용된 KB 청크. ConversationInspector 의 chip 이
  // assistant 메시지마다 자기 turnIndex 로 lookup 한다.
  const turnRefIndex = new Map<number, RagSource[]>(
    aiMetadata?.turnDebug.map((t) => [t.turnIndex, t.ragSources]) ?? [],
  );

  const isCompletedConversation =
    result.status === "completed" && isConversationOutput(result.outputData);

  const isConversationNode = isWaitingConversation || isCompletedConversation;

  // Conversation nodes (AI Agent / Information Extractor) used to take over
  // the entire detail panel — losing access to Output/Config tabs. Now they
  // share NodeDetailTabs and the conversation view lives inside the Preview
  // tab so the user can still inspect the raw output.
  const showTabs =
    isConversationNode ||
    result.status === "completed" ||
    result.status === "failed" ||
    result.status === "waiting_for_input";

  const historyMessages = isCompletedConversation
    ? parseHistoryMessages(result.outputData)
    : [];
  const effectiveConversationMessages = isWaitingConversation
    ? conversationMessages
    : historyMessages;

  const conversationPreview = isWaitingConversation ? (
    <ConversationInspector
      result={result}
      conversationMessages={conversationMessages}
      selectedItemIndex={selectedConversationItemIndex}
      isLive={true}
      isWaitingAiResponse={isWaitingAiResponse}
      conversationConfig={conversationConfig}
      onSendMessage={handleSendMessage}
      onEndConversation={handleEndConversation}
      onSelectMessage={handleSelectMessage}
      onBackToConversation={handleBackToConversation}
      turnRefIndex={turnRefIndex}
      onJumpToReferences={handleJumpToReferences}
    />
  ) : isCompletedConversation ? (
    <ConversationInspector
      result={result}
      conversationMessages={historyMessages}
      selectedItemIndex={selectedConversationItemIndex}
      isLive={false}
      isWaitingAiResponse={false}
      conversationConfig={null}
      onSendMessage={() => {}}
      onEndConversation={() => {}}
      onSelectMessage={handleSelectMessage}
      onBackToConversation={handleBackToConversation}
      turnRefIndex={turnRefIndex}
      onJumpToReferences={handleJumpToReferences}
    />
  ) : null;

  const selectedMessage =
    isConversationNode && selectedConversationItemIndex != null
      ? (effectiveConversationMessages[selectedConversationItemIndex] ?? null)
      : null;

  const formPreview =
    isWaitingForm && formConfig ? (
      <DynamicFormUI
        formConfig={formConfig as Record<string, unknown>}
        onSubmit={handleFormSubmit}
      />
    ) : null;

  const buttonsPreview = isWaitingButtons
    ? isPresentation
      ? (
          <PresentationContent
            result={result}
            onPortButtonClick={handlePortButtonClick}
            onLinkButtonClick={handleLinkButtonClick}
            previewOnly
          />
        )
      : (() => {
          const parsed = parseButtonConfig(buttonConfig);
          if (!parsed) return null;
          return (
            <ButtonBar
              buttons={parsed.buttons}
              onPortButtonClick={handlePortButtonClick}
              onLinkButtonClick={handleLinkButtonClick}
              onContinueClick={handleContinueClick}
            />
          );
        })()
    : null;

  const previewContent =
    conversationPreview ?? formPreview ?? buttonsPreview ?? undefined;

  // Preview tab is shown when there's any custom content to render in it
  // (conversation, form, buttons) or when this is a presentation node.
  const hasPreview =
    !!conversationPreview ||
    !!formPreview ||
    !!buttonsPreview ||
    (isPresentation && !!result.outputData);

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center gap-2">
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

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {showTabs ? (
          <NodeDetailTabs
            key={result.nodeId}
            result={result}
            hasPreview={hasPreview}
            previewContent={previewContent}
            selectedMessage={selectedMessage}
            conversationMessages={effectiveConversationMessages}
            activeTab={activeTab}
            onActiveTabChange={handleActiveTabChange}
            highlightTurnIndex={highlightTurnIndex}
            aiMetadata={aiMetadata}
          />
        ) : (
          <div className="h-full overflow-y-auto p-3">
            {isPresentation && result.outputData ? (
              <PresentationContent result={result} />
            ) : (
              <GenericRenderer result={result} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
