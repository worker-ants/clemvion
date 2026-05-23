"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Send,
  Square,
  Wrench,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  Info,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ConversationItem, ToolCallInfo } from "@/lib/stores/execution-store";
import type { NodeResult } from "@/lib/stores/execution-store";
import type { RagSource } from "./output-shape";
import { resolveResultField } from "./resolve-result-field";
import { MarkdownRenderer } from "@/components/editor/assistant-panel/markdown-renderer";
import { AssistantPresentationsBlock } from "./renderers/assistant-presentations-block";
import { tryParseJson } from "@/lib/utils/parse-json";
import { formatDate } from "@/lib/utils/date";
import { useT } from "@/lib/i18n";
import {
  groupToolCallItems,
  isAssistantContentBlank,
  stripInlineMarkers,
} from "@/lib/conversation/conversation-utils";
import type { TranslationKey } from "@/lib/i18n/core";

// spec/conventions/conversation-thread.md §9.1 — `presentation_user` source
// 의 시각 신호 ①. ConversationItem 의 카드 헤더와 SelectedItemDetail 양쪽에
// 공유해 이모지 변경 시 한 곳만 수정한다.
const PRESENTATION_ICON = "🧩";

/**
 * Map a `presentation_user` turn's interactionType to the i18n key for the
 * card header verb ("button clicked" / "form submitted" / "link continue").
 * Shared between `SummaryView` (timeline card) and `PresentationDetail`
 * (selected-item detail) so adding a new interaction kind only requires
 * touching this function. Returns `TranslationKey` (not generic string) so
 * the `useT()` typed key check at call sites stays sound.
 */
function getInteractionLabelKey(
  interactionType?: "button_click" | "form_submitted" | "button_continue",
): TranslationKey {
  if (interactionType === "form_submitted") return "editor.conversation.cardFormSubmitted";
  if (interactionType === "button_continue") return "editor.conversation.cardLinkContinue";
  return "editor.conversation.cardButtonClicked";
}

/** Chip 한 줄에 inline 으로 보일 최대 문서명 개수 (나머지는 `+N` 으로 축약). */
const MAX_VISIBLE_DOC_NAMES = 2;
/** Tool 결과 요약: 문자열·객체값 truncate 임계값 (테스트와 공유) */
export const SUMMARY_STRING_MAX = 80;
export const SUMMARY_VALUE_MAX = 40;

/**
 * 한 assistant 응답에서 사용된 KB 청크 요약 chip — 클릭 시 References 탭의
 * 해당 turn 그룹으로 점프. 문서명은 dedup 후 {@link MAX_VISIBLE_DOC_NAMES} 개
 * 까지 inline, 나머지는 `+N` 으로 축약. `sources` 가 비면 미렌더 (chrome
 * 노이즈 방지).
 *
 * - `compact`: SummaryView 의 인라인 버블용 (padding / font-weight 축소). 기본
 *   값은 SelectedItemDetail 의 standalone chip 용.
 */
function ReferencesChip({
  sources,
  onClick,
  compact,
}: {
  sources: RagSource[];
  onClick: () => void;
  compact?: boolean;
}) {
  const t = useT();
  if (sources.length === 0) return null;
  const docNames = Array.from(new Set(sources.map((s) => s.documentName)));
  const shown = docNames.slice(0, MAX_VISIBLE_DOC_NAMES);
  const extra = docNames.length - shown.length;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={t("editor.conversation.viewInReferences")}
      className={cn(
        "inline-flex items-center gap-1 rounded bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]/80 transition-colors",
        compact ? "px-1 py-0 text-[10px]" : "px-1.5 py-0.5 text-[10px] font-medium",
      )}
    >
      <span>📚</span>
      <span className="font-mono">{shown.join(" · ")}</span>
      {extra > 0 && <span>+{extra}</span>}
    </button>
  );
}

function ToolCallBadge({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const count = toolCalls.length;
  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded bg-[hsl(var(--accent))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]/80 transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        <Wrench size={10} />
        <span>{t("editor.conversation.toolCall")}</span>
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span>{t("editor.conversation.toolsCalled", { count })}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {toolCalls.map((tc, i) => (
            <div key={i} className="rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))] px-2 py-1 text-[10px] font-mono">
              <div className="font-medium">{tc.name}</div>
              {tc.arguments && (
                <div className="mt-0.5 text-[hsl(var(--muted-foreground))] break-all">
                  {tc.arguments}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ConversationInspectorProps {
  result: NodeResult;
  /** Live: store 가 직접 주입. History: SummaryView 내 useMemo 가 outputData.messages 에서 재가공. */
  conversationMessages: ConversationItem[];
  /**
   * Index into `conversationMessages` for the currently-selected message, or
   * `null` when no message is selected (node-level view). Driven by the
   * shared execution-store so timeline clicks and Preview clicks agree on a
   * single source of truth.
   */
  selectedItemIndex: number | null;
  isLive: boolean;
  isWaitingAiResponse: boolean;
  conversationConfig: unknown;
  onSendMessage: (message: string) => void;
  onEndConversation: () => void;
  /**
   * Called when the user picks a message inside SummaryView. Parent relays
   * this to the store's `selectConversationItem(index)`.
   */
  onSelectMessage?: (index: number) => void;
  /**
   * Called when the user clicks "← Back to conversation" in the selected
   * message detail view. Parent relays this to `selectConversationItem(null)`
   * so the entire surface (timeline highlight, detail tabs) returns to the
   * node-level view.
   */
  onBackToConversation?: () => void;
  /**
   * turnIndex → 그 턴에서 호출된 KB 청크. assistant 메시지마다 자기 turnIndex
   * 로 lookup 해 ReferencesChip 을 렌더한다. 비어있으면 chip 미노출.
   */
  turnRefIndex?: Map<number, RagSource[]>;
  /**
   * chip 클릭 시 부모(`ResultDetail`)에 References 탭 점프 + 해당 turn 강조를
   * 요청하는 콜백.
   */
  onJumpToReferences?: (turnIndex: number) => void;
  /**
   * spec/conventions/conversation-thread.md §9.10 CT-S11 — `system_error`
   * 항목의 `[다시 시도]` 버튼 클릭 → execution.retry_last_turn 매핑.
   * 부모 ResultDetail (또는 호출자) 가 useExecutionInteractionCommands 의
   * retryLastTurn 을 prop drill. 미정 시 retry 버튼 자동 suppress.
   */
  onRetryLastTurn?: (nodeExecutionId: string) => void;
  /**
   * spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii — `render_form` 활성 form 의
   * UI 단일 진실 (assistant turn timeline 인라인). store selector
   * `waitingConversationConfig.pendingFormToolCall.toolCallId` 를 부모
   * (ResultDetail / ExecutionDetailPage) 가 가져와 prop drill —
   * SummaryView / SelectedItemDetail 양쪽이 동일 selector 사용 (Inv-5 동형).
   */
  pendingFormToolCallId?: string | null;
  /**
   * Active render_form 제출 콜백. 부모가 `commands.submitForm(data)` +
   * `resumeFromAiRenderForm()` 호출 책임. 미전달 시 active 분기 회피
   * (FormSubmittedContent 로 fallback) — assistant-presentations-block 의
   * defensive guard 와 평행.
   */
  onSubmitForm?: (data: Record<string, unknown>) => void;
}

export function ConversationInspector({
  result,
  conversationMessages,
  selectedItemIndex,
  isLive,
  isWaitingAiResponse,
  conversationConfig,
  onSendMessage,
  onEndConversation,
  onSelectMessage,
  onBackToConversation,
  turnRefIndex,
  onJumpToReferences,
  onRetryLastTurn,
  pendingFormToolCallId,
  onSubmitForm,
}: ConversationInspectorProps) {
  const t = useT();
  const selectedItem =
    selectedItemIndex != null
      ? conversationMessages[selectedItemIndex]
      : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {selectedItem ? (
          <div className="flex flex-col h-full">
            {onBackToConversation && (
              <button
                type="button"
                className="flex items-center gap-1 px-3 pt-2 pb-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                onClick={onBackToConversation}
              >
                {t("editor.conversation.backToConversation")}
              </button>
            )}
            <SelectedItemDetail
              key={`${selectedItem.type}-${selectedItem.turnIndex}`}
              item={selectedItem}
              turnRefIndex={turnRefIndex}
              onJumpToReferences={onJumpToReferences}
              onSendMessage={onSendMessage}
              pendingFormToolCallId={pendingFormToolCallId}
              onSubmitForm={onSubmitForm}
            />
          </div>
        ) : (
          <div className="p-3">
            <SummaryView
              result={result}
              conversationConfig={conversationConfig}
              isLive={isLive}
              conversationMessages={conversationMessages}
              onSelectItem={onSelectMessage}
              turnRefIndex={turnRefIndex}
              onJumpToReferences={onJumpToReferences}
              onSendMessage={onSendMessage}
              onRetryLastTurn={onRetryLastTurn}
              pendingFormToolCallId={pendingFormToolCallId}
              onSubmitForm={onSubmitForm}
            />
          </div>
        )}
      </div>

      {isLive && (
        <MessageInput
          isDisabled={isWaitingAiResponse}
          onSend={onSendMessage}
          onEnd={onEndConversation}
        />
      )}
    </div>
  );
}

// ── Selected item detail ──
//
// Raw Response / Request / per-call usage live in sibling top-level tabs
// (Response / Request / LLM Usage — see `result-detail.tsx` and
// `llm-information-tab.tsx`). Preview here stays focused on the
// conversation content for the selected message.

// AI Agent 의 system role RAG context 메시지를 detect 하는 마커.
// `RagSearchService.buildContext` (backend) 가 동일 prefix 로 만들어 보낸다.
const RAG_CONTEXT_MARKER = "### Relevant Knowledge";

function isRagContextContent(content: unknown): content is string {
  return typeof content === "string" && content.includes(RAG_CONTEXT_MARKER);
}

/** SummaryView 컴팩트 라인용 결과 요약 — 전체 본문은 ToolDetail 에서 노출. */
export function summarizeToolResult(result: unknown): string {
  if (result == null) return "";
  if (Array.isArray(result)) {
    return `${result.length} item${result.length === 1 ? "" : "s"}`;
  }
  if (typeof result === "string") {
    return result.length > SUMMARY_STRING_MAX
      ? `${result.slice(0, SUMMARY_STRING_MAX)}…`
      : result;
  }
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    const v = obj[keys[0]];
    let vStr: string;
    if (v == null) vStr = String(v);
    else if (typeof v === "object") vStr = Array.isArray(v) ? "[…]" : "{…}";
    else {
      const raw = String(v);
      vStr = raw.length > SUMMARY_VALUE_MAX
        ? `${raw.slice(0, SUMMARY_VALUE_MAX)}…`
        : raw;
    }
    return `{${keys[0]}: ${vStr}${keys.length > 1 ? `, +${keys.length - 1}` : ""}}`;
  }
  return String(result).slice(0, SUMMARY_STRING_MAX);
}

function ToolStatusIcon({
  status,
}: {
  status: ConversationItem["toolStatus"];
}) {
  if (status === "pending") {
    return (
      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[hsl(var(--muted-foreground))]" />
    );
  }
  if (status === "success") {
    return <CheckCircle className="h-3 w-3 shrink-0 text-green-500" />;
  }
  if (status === "error") {
    return <XCircle className="h-3 w-3 shrink-0 text-red-500" />;
  }
  return null;
}

function SelectedItemDetail({
  item,
  turnRefIndex,
  onJumpToReferences,
  onSendMessage,
  pendingFormToolCallId,
  onSubmitForm,
}: {
  item: ConversationItem;
  turnRefIndex?: Map<number, RagSource[]>;
  onJumpToReferences?: (turnIndex: number) => void;
  /**
   * spec/4-nodes/3-ai/1-ai-agent.md §4.1 — AssistantPresentationsBlock 의
   * 버튼 클릭이 user 메시지로 LLM 에 전달되도록 ConversationInspector 의
   * onSendMessage 를 그대로 prop drill.
   */
  onSendMessage?: (message: string) => void;
  /**
   * spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii — render_form active 분기용
   * store selector 값. 본 컴포넌트는 AssistantPresentationsBlock 에 그대로
   * pass-through.
   */
  pendingFormToolCallId?: string | null;
  onSubmitForm?: (data: Record<string, unknown>) => void;
}) {
  // "rag" 타입은 store 의 ConversationItem 타입에는 없지만 SummaryView 가 system role
  // 메시지를 담아 합성한다. 런타임 분기로 처리.
  if ((item.type as string) === "rag") {
    return <RagDetail item={item} />;
  }
  if (item.type === "tool") {
    return <ToolDetail item={item} />;
  }
  if (item.type === "user") {
    return <UserDetail item={item} />;
  }
  if (item.type === "presentation") {
    return <PresentationDetail item={item} />;
  }
  if (item.type === "system") {
    return <SystemDetail item={item} />;
  }
  if (item.type === "system_error") {
    return <SystemErrorDetail item={item} />;
  }

  const hasToolCalls = !!item.assistantToolCalls?.length;
  const isContentBlank = isAssistantContentBlank(item.content);
  const turnSources = turnRefIndex?.get(item.turnIndex) ?? [];
  const presentations = item.presentations ?? [];
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <span>🤖</span>
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          {hasToolCalls && isContentBlank
            ? `Tool Call — Turn ${item.turnIndex}`
            : `AI Response — Turn ${item.turnIndex}`}
        </span>
      </div>
      {!isContentBlank && (
        <div className="text-sm">
          <MarkdownRenderer content={item.content} />
        </div>
      )}
      {hasToolCalls && (
        <ToolCallBadge toolCalls={item.assistantToolCalls!} />
      )}
      {presentations.length > 0 && (
        <AssistantPresentationsBlock
          presentations={presentations}
          onSendMessage={onSendMessage}
          pendingFormToolCallId={pendingFormToolCallId}
          onSubmitForm={onSubmitForm}
        />
      )}
      {turnSources.length > 0 && onJumpToReferences && (
        <ReferencesChip
          sources={turnSources}
          onClick={() => onJumpToReferences(item.turnIndex)}
        />
      )}
      <p className="text-[10px] italic text-[hsl(var(--muted-foreground))]">
        원문 요청 / 응답 / 사용량은 상단의 &ldquo;Request&rdquo; /
        &ldquo;Response&rdquo; / &ldquo;LLM Usage&rdquo; 탭에서 확인할 수
        있습니다.
      </p>
    </div>
  );
}

// ── Tool / User detail ──

function ToolDetail({ item }: { item: ConversationItem }) {
  const statusBadge =
    item.toolStatus === "pending"
      ? { label: "Pending", className: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]" }
      : item.toolStatus === "success"
        ? { label: "Success", className: "bg-green-500/15 text-green-700 dark:text-green-300" }
        : item.toolStatus === "error"
          ? { label: "Error", className: "bg-red-500/15 text-red-700 dark:text-red-300" }
          : null;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <span>🔧</span>
        <span className="font-mono text-sm font-medium">{item.content}</span>
        {statusBadge && (
          <span
            className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadge.className}`}
          >
            {statusBadge.label}
            {item.durationMs != null ? ` · ${item.durationMs}ms` : ""}
          </span>
        )}
      </div>
      {item.error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
          {item.error}
        </div>
      )}
      {item.toolArgs != null && (
        <div>
          <div className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Arguments
          </div>
          <pre className="rounded bg-[hsl(var(--muted))] p-2 text-xs overflow-x-auto">
            {typeof item.toolArgs === "string"
              ? item.toolArgs
              : JSON.stringify(item.toolArgs, null, 2)}
          </pre>
        </div>
      )}
      {item.toolResult != null && (
        <div>
          <div className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Result
          </div>
          <pre className="rounded bg-[hsl(var(--muted))] p-2 text-xs overflow-x-auto">
            {typeof item.toolResult === "string"
              ? item.toolResult
              : JSON.stringify(item.toolResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Body of a `presentation_user` card (spec/conventions/conversation-thread.md
 * §9.1). Uses structured `interaction.data` (1급 필드, node-output §4.5) to
 * compose the body without parsing `content` — so the visible string is the
 * clean label/URL/form-fields and never a verb prefix like `clicked:`.
 *
 *   - `button_click` → buttonLabel (fallback buttonId)
 *   - `button_continue` → URL
 *   - `form_submitted` → key-value rows (data is itself the flat field map)
 */
function PresentationCardBody({ item }: { item: ConversationItem }) {
  const p = item.presentation;
  if (!p) {
    return (
      <div className="whitespace-pre-wrap text-xs text-[hsl(var(--foreground))]">
        {item.content || ""}
      </div>
    );
  }
  const data = p.data ?? {};
  if (p.interactionType === "button_click") {
    const label =
      (data.buttonLabel as string | undefined) ??
      (data.buttonId as string | undefined) ??
      "";
    return (
      <div className="text-xs text-[hsl(var(--foreground))]">{label}</div>
    );
  }
  if (p.interactionType === "button_continue") {
    const url = (data.url as string | undefined) ?? "";
    return (
      <div className="break-all font-mono text-[11px] text-[hsl(var(--foreground))]">
        {url}
      </div>
    );
  }
  // form_submitted — flat key-value map (node-output §4.5 form_submitted shape).
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <div className="text-xs italic text-[hsl(var(--muted-foreground))]">
        (no fields)
      </div>
    );
  }
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[hsl(var(--muted-foreground))]">{k}</dt>
          <dd className="break-all text-[hsl(var(--foreground))]">
            {typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RagDetail({ item }: { item: ConversationItem }) {
  // content 첫 줄에서 chunk 개수 힌트, [Source: …] 패턴 빈도로 대략 회수 chunk 수 표시.
  const sourceCount = (item.content.match(/\[Source: /g) ?? []).length;
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <span>🔎</span>
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          KB Reference — Turn {item.turnIndex}
          {sourceCount > 0 ? ` · ${sourceCount} chunk(s)` : ""}
        </span>
      </div>
      <div className="text-sm">
        <MarkdownRenderer content={item.content} />
      </div>
      <p className="text-[10px] italic text-[hsl(var(--muted-foreground))]">
        지식베이스에서 검색한 청크가 시스템 메시지로 LLM 에 주입되었습니다.
      </p>
    </div>
  );
}

/**
 * Shared header used by detail views for `presentation_user` and `system`
 * turns. Keeps icon + label + optional timestamp in a single row so the
 * two detail components don't drift apart visually.
 */
function CardHeader({
  icon,
  label,
  timestamp,
}: {
  icon: React.ReactNode;
  label: string;
  timestamp?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      {timestamp && (
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {formatDate(timestamp, "datetime")}
        </span>
      )}
    </div>
  );
}

/**
 * SelectedItemDetail variant for a `presentation_user` turn.
 * spec/conventions/conversation-thread.md §9.1 — full-width grey system
 * card; chip header carries `nodeLabel + interaction verb`, body is
 * extracted from structured `interaction.data` (node-output §4.5), never
 * from parsing `text`.
 */
function PresentationDetail({ item }: { item: ConversationItem }) {
  const t = useT();
  const p = item.presentation;
  return (
    <div className="flex flex-col gap-3 p-3">
      <CardHeader
        icon={<span>{PRESENTATION_ICON}</span>}
        label={`${p?.nodeLabel ?? "Presentation"} · ${t(getInteractionLabelKey(p?.interactionType))}`}
        timestamp={item.timestamp}
      />
      <PresentationCardBody item={item} />
    </div>
  );
}

/**
 * SelectedItemDetail variant for a `system` turn. spec
 * conversation-thread.md §9.1 reserves this row for future workflow-level
 * manual push; v1 backend doesn't emit it but the renderer is in place.
 */
function SystemDetail({ item }: { item: ConversationItem }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 p-3">
      <CardHeader
        icon={<Info size={14} className="text-[hsl(var(--muted-foreground))]" />}
        label={t("editor.conversation.cardSystemNote")}
        timestamp={item.timestamp}
      />
      {item.content && (
        <div className="whitespace-pre-wrap text-xs italic text-[hsl(var(--foreground))]">
          {item.content}
        </div>
      )}
    </div>
  );
}

/**
 * SelectedItemDetail variant for a `system_error` turn.
 *
 * spec/conventions/conversation-thread.md §9.1 매핑표:
 * - icon: ❌ / AlertCircle
 * - 컨테이너 형식: 가운데정렬 얇은 빨간 full-width 라인 (chat bubble 아님)
 * - chip 헤더: `<nodeLabel> · <code>` (§9.2 3중 시각 신호)
 * - 본문: `data.message`
 * - 우측 액션 영역: `retryable === true` 시 `[다시 시도]` 버튼 + 카운트다운
 *
 * 본 detail panel 은 selected 상태에서 같은 정보 + 더 자세한 메타를 표시.
 */
function SystemErrorDetail({ item }: { item: ConversationItem }) {
  const t = useT();
  const se = item.systemError;
  if (!se) return null;
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <AlertCircle size={14} className="text-red-500" aria-hidden />
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          {se.nodeLabel
            ? `${se.nodeLabel} · ${se.code}`
            : se.code}
        </span>
        {item.timestamp && (
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {formatDate(item.timestamp, "datetime")}
          </span>
        )}
      </div>
      <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        <div className="whitespace-pre-wrap">{se.message}</div>
        {!se.retryable && (
          <div className="mt-2 text-[10px] uppercase tracking-wide text-red-700/70 dark:text-red-400/70">
            {t("editor.conversation.systemErrorNonRetryable")}
          </div>
        )}
        {se.retryable && se.retryAfterSec !== undefined && (
          <div className="mt-2 text-[10px] text-red-700/70 dark:text-red-400/70">
            {t("editor.conversation.systemErrorRetryAfter", {
              seconds: se.retryAfterSec,
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Inline-row renderer for a `system_error` turn used inside SummaryView's
 * conversation timeline. Matches §9.1 매핑표:
 *
 * - 컨테이너: 가운데정렬 얇은 빨간 full-width 라인
 * - chip: `<nodeLabel> · <code>`
 * - 본문: `data.message`
 * - 우측: `[다시 시도]` button (retryable=true) + retryAfterSec 카운트다운
 *
 * `onRetry` is the parent-supplied callback that wires `execution.retry_last_turn`
 * via `useExecutionInteractionCommands`. When undefined the retry button is
 * suppressed (history / disconnected view).
 */
function SystemErrorRow({
  item,
  onRetry,
  isClickable,
  onClick,
  onKeyDown,
}: {
  item: ConversationItem;
  onRetry?: (nodeExecutionId: string) => void;
  isClickable?: boolean;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const t = useT();
  const se = item.systemError;
  if (!se) return null;
  // `nodeExecutionId` 가 있어야 retry_last_turn 호출 가능. live view 는 WS
  // payload 의 nodeExecutionId 를 받고, history view 는 빈 fallback 으로 button
  // 자동 suppress (Inv-6 fallback 정책 — §9.1).
  const showRetry =
    se.retryable && !!onRetry && !!se.nodeExecutionId;
  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        "flex w-full items-center gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
        isClickable &&
          "cursor-pointer transition-colors hover:bg-red-100 focus:outline-none focus:ring-1 focus:ring-red-300 dark:hover:bg-red-900",
      )}
    >
      <AlertCircle size={12} className="shrink-0 text-red-500" aria-hidden />
      <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-200">
        {se.nodeLabel ? `${se.nodeLabel} · ${se.code}` : se.code}
      </span>
      <span className="min-w-0 flex-1 truncate" title={se.message}>
        {se.message}
      </span>
      {showRetry && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry!(se.nodeExecutionId!);
          }}
          className="shrink-0 rounded bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-300"
        >
          {se.retryAfterSec !== undefined
            ? `${t("editor.conversation.systemErrorRetry")} · ${t(
                "editor.conversation.systemErrorRetryAfterShort",
                { seconds: se.retryAfterSec },
              )}`
            : t("editor.conversation.systemErrorRetry")}
        </button>
      )}
    </div>
  );
}

function UserDetail({ item }: { item: ConversationItem }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <span>👤</span>
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          User Message — Turn {item.turnIndex}
        </span>
        {item.timestamp && (
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {formatDate(item.timestamp, "datetime")}
          </span>
        )}
      </div>
      <div className="whitespace-pre-wrap text-sm">{item.content}</div>
    </div>
  );
}

// ── Summary view (AI Agent parent node clicked) ──

function SummaryView({
  result,
  conversationConfig,
  isLive,
  conversationMessages,
  onSelectItem,
  turnRefIndex,
  onJumpToReferences,
  onSendMessage,
  onRetryLastTurn,
  pendingFormToolCallId,
  onSubmitForm,
}: {
  result: NodeResult;
  conversationConfig: unknown;
  isLive: boolean;
  conversationMessages: ConversationItem[];
  onSelectItem?: (index: number) => void;
  turnRefIndex?: Map<number, RagSource[]>;
  onJumpToReferences?: (turnIndex: number) => void;
  /**
   * spec/4-nodes/3-ai/1-ai-agent.md §4.1 — AssistantPresentationsBlock 의
   * 버튼 클릭이 user 메시지로 흡수되도록 prop drilled.
   */
  onSendMessage?: (message: string) => void;
  /**
   * spec/conventions/conversation-thread.md §9.10 CT-S11 — system_error
   * 항목의 `[다시 시도]` 버튼이 execution.retry_last_turn 으로 매핑되도록
   * useExecutionInteractionCommands.retryLastTurn 을 prop drill. 미정 시
   * SystemErrorRow 가 버튼 자동 suppress (history view 등).
   */
  onRetryLastTurn?: (nodeExecutionId: string) => void;
  /** spec §6.1.d.ii — render_form active 분기용. assistant row 의
   * AssistantPresentationsBlock 에 pass-through. */
  pendingFormToolCallId?: string | null;
  onSubmitForm?: (data: Record<string, unknown>) => void;
}) {
  const t = useT();
  const config = conversationConfig as Record<string, unknown> | null;
  const rawOutput = result.outputData as Record<string, unknown> | null;
  // Support new `{ config, output, ... }` wrapper and legacy flat shape.
  const output =
    rawOutput &&
    typeof rawOutput === "object" &&
    !Array.isArray(rawOutput) &&
    "config" in rawOutput &&
    "output" in rawOutput
      ? (rawOutput.output as Record<string, unknown> | null)
      : rawOutput;

  // Full conversation thread (shown in both Live and History). Post-Stage-5
  // ai_agent writes messages at `output.result.messages`; legacy runs kept
  // them at `output.messages`. `resolveResultField` handles both paths.
  // system role 메시지 중 RAG 컨텍스트(`### Relevant Knowledge`) 는 별도 "rag"
  // 항목으로 노출해 KB 호출이 timeline 에 보이게 한다.
  const items = useMemo(() => {
    if (isLive) return conversationMessages;
    const msgsRaw = resolveResultField<unknown[]>(output, "messages");
    if (!Array.isArray(msgsRaw)) return conversationMessages;
    const msgs = msgsRaw as Array<{
      role: string;
      content: string;
      toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
      toolCallId?: string;
    }>;
    let turnCounter = 0;
    const out: ConversationItem[] = [];
    // toolCallId → name 매핑 (직전 assistant.toolCalls[].id 로 lookup).
    const callNameById = new Map<string, string>();
    for (const m of msgs) {
      if (m.role === "user") {
        turnCounter++;
        out.push({
          type: "user",
          content: stripInlineMarkers(m.content),
          turnIndex: turnCounter,
        });
      } else if (m.role === "assistant") {
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            if (tc.id) callNameById.set(tc.id, tc.name ?? "");
          }
        }
        out.push({
          type: "assistant",
          content: stripInlineMarkers(m.content),
          turnIndex: turnCounter,
          assistantToolCalls: m.toolCalls?.length
            ? m.toolCalls.map((tc) => ({
                name: tc.name ?? "",
                arguments: tc.arguments,
              }))
            : undefined,
        });
      } else if (m.role === "tool") {
        const name = m.toolCallId
          ? callNameById.get(m.toolCallId)
          : undefined;
        out.push({
          type: "tool",
          content: name ?? "(unknown tool)",
          turnIndex: turnCounter || 1,
          toolCallId: m.toolCallId,
          toolResult: tryParseJson(m.content),
        });
      } else if (m.role === "system" && isRagContextContent(m.content)) {
        // RAG context 는 직전 user 의 turnCounter 에 속하도록 표시한다.
        out.push({
          type: "rag" as ConversationItem["type"],
          content: m.content,
          turnIndex: turnCounter,
        });
      }
    }
    return out;
  }, [isLive, conversationMessages, output]);

  return (
    <div className="flex flex-col gap-4">
      {/* Turn counter */}
      <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
        {(() => {
          if (isLive) {
            const current =
              (config?.turnCount as number) ??
              items.filter((m) => m.type === "user").length;
            const max = (config?.maxTurns as number) || "∞";
            return t("editor.conversation.turnProgress", { current, max });
          }
          if (!output) return t("editor.conversation.conversationHeader");
          const turnCount = resolveResultField<number>(output, "turnCount");
          const endReason = resolveResultField<string>(output, "endReason");
          return t("editor.conversation.turnsEndReason", {
            turns: turnCount ?? "?",
            reason: endReason ?? "",
          });
        })()}
      </div>

      {/* Full conversation thread */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {(() => {
            // tool-only intermediate assistant 와 그 호출 결과를 부모-자식 tree
            // 로 묶기 위한 사전 계산. spec/conventions/conversation-thread.md
            // §9.1 의 ai_tool 라인은 본래 ai_assistant 와 별도 row 인데, 본문이
            // 비어있는 intermediate assistant 는 직후 tool row 들과 의미가
            // 같아 timeline 에 두 row 가 중복으로 노출돼 왔다 (PR #206→#208→
            // #210 의 회귀 history). 본 PR 은 사용자 요청에 따라 그 의미를
            // "도구 호출 그룹" 단일 unit 으로 묶어 부모(🤖 + 도구 호출 헤더)
            // 직하에 자식(🔧)을 indent 표시한다.
            //
            // spec §9.6 의 단일 결정 함수 `groupToolCallItems` 가 conversation
            // Preview 와 좌측 실행 트리 timeline 양쪽에 동일 결과를 공급한다
            // (Inv-5, §9.9). 분류 정책 변경은 본 함수의 동작 갱신만으로 두
            // surface 에 자동 전파된다.
            const { claimedToolIndices, childrenByParent } =
              groupToolCallItems(items);
            return items.map((item, i) => {
            const isClickable = !!onSelectItem;
            // ReactMarkdown 출력은 block 요소를 포함할 수 있으므로 button 안에 nest 시
            // HTML 무효 — div + role="button" 으로 keyboard 접근성 유지하며 block 요소 허용.
            const handleClick = isClickable
              ? () => onSelectItem(i)
              : undefined;
            const handleKeyDown = isClickable
              ? (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectItem(i);
                  }
                }
              : undefined;
            const isAssistant = item.type === "assistant";
            const isRag = (item.type as string) === "rag";
            const isTool = item.type === "tool";
            const isPresentation = item.type === "presentation";
            const isSystem = item.type === "system";
            const isSystemError = item.type === "system_error";
            // 부모(intermediate assistant) 에 흡수된 tool row 는 본 위치에서
            // 표준 렌더 대신 부모 분기 안의 tree children 으로만 보여준다.
            if (isTool && claimedToolIndices.has(i)) return null;
            // tool-only intermediate assistant 는 부모-자식 그룹으로 렌더 한다.
            // 🤖 "도구 호출 N개" 헤더 + 직하 indented children (🔧 tool row).
            // 자식 tool row 자체는 위에서 claimed 으로 처리되어 standalone 위치
            // 에서 재렌더하지 않는다 (중복 방지). store data 는 보존되어 LLM
            // 디버그 탭에서 intermediate LLM 호출 payload 를 그대로 확인 가능.
            const isToolCallGroupParent =
              isAssistant &&
              !!item.assistantToolCalls?.length &&
              isAssistantContentBlank(item.content);
            if (isToolCallGroupParent) {
              const childIndices = childrenByParent.get(i) ?? [];
              const toolCallCount = item.assistantToolCalls!.length;
              return (
                <div
                  key={`tool-call-group-${item.turnIndex}-${i}`}
                  className="flex flex-col gap-1"
                >
                  <div
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    className={cn(
                      "inline-flex items-center gap-1.5 self-start rounded bg-[hsl(var(--muted))] px-2 py-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))]",
                      isClickable &&
                        "cursor-pointer transition-colors hover:bg-[hsl(var(--accent))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]",
                    )}
                  >
                    <span aria-hidden>🤖</span>
                    <span>AI</span>
                    <span>·</span>
                    <Wrench size={10} aria-hidden />
                    <span>
                      {t("editor.conversation.toolsCalled", {
                        count: toolCallCount,
                      })}
                    </span>
                  </div>
                  {childIndices.length > 0 && (
                    <div className="ml-3 flex flex-col gap-1 border-l-2 border-[hsl(var(--border))] pl-3">
                      {childIndices.map((ci) => {
                        const child = items[ci];
                        if (child.type !== "tool") return null;
                        const summary = summarizeToolResult(child.toolResult);
                        const handleChildClick = onSelectItem
                          ? () => onSelectItem(ci)
                          : undefined;
                        const handleChildKeyDown = onSelectItem
                          ? (e: React.KeyboardEvent) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelectItem(ci);
                              }
                            }
                          : undefined;
                        return (
                          <div
                            key={`tool-child-${ci}`}
                            role={onSelectItem ? "button" : undefined}
                            tabIndex={onSelectItem ? 0 : undefined}
                            onClick={handleChildClick}
                            onKeyDown={handleChildKeyDown}
                            className={cn(
                              "flex items-center gap-2 py-1 text-[11px] text-[hsl(var(--muted-foreground))]",
                              onSelectItem &&
                                "cursor-pointer rounded-sm transition-colors hover:bg-[hsl(var(--accent))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]",
                            )}
                          >
                            <span aria-hidden className="text-[10px]">
                              🔧
                            </span>
                            <span className="truncate font-mono text-[11px] text-[hsl(var(--foreground))]">
                              {child.content}
                            </span>
                            <ToolStatusIcon status={child.toolStatus} />
                            {summary && (
                              <span className="truncate text-[10px]">
                                · {summary}
                              </span>
                            )}
                            {child.error && (
                              <span className="truncate text-[10px] text-red-500">
                                · {child.error}
                              </span>
                            )}
                            {child.durationMs != null && (
                              <span className="ml-auto shrink-0 text-[10px]">
                                {child.durationMs}ms
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            // spec/conventions/conversation-thread.md §9.1 — `presentation_user`
            // turn 은 chat bubble 이 아닌 회색 시스템 카드로 렌더. 3중 신호
            // (아이콘 🧩 + full-width 카드 컨테이너 + nodeLabel chip) 동시 적용.
            if (isPresentation) {
              const p = item.presentation;
              return (
                <div
                  key={`${item.type}-${i}`}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  className={cn(
                    "rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-xs text-left",
                    isClickable &&
                      "cursor-pointer transition-shadow hover:ring-1 hover:ring-[hsl(var(--primary))/0.3] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]",
                  )}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                    <span aria-hidden>{PRESENTATION_ICON}</span>
                    <span className="rounded bg-[hsl(var(--background))] px-1.5 py-0.5 font-mono">
                      {p?.nodeLabel ?? "Presentation"}
                    </span>
                    <span>· {t(getInteractionLabelKey(p?.interactionType))}</span>
                  </div>
                  <PresentationCardBody item={item} />
                </div>
              );
            }
            // §9.1 system note — v1 자동 push 없음이라 실제 호출은 드물지만,
            // 향후 수동 push 또는 v2 자동 push 도입 시점에 별도 PR 없이 보이도록
            // UI 형식은 미리 구현 (spec §9.1 의 "UI 는 본 행 형식을 미리 구현해
            // 두기만 한다" 명시).
            if (isSystem) {
              return (
                <div
                  key={`${item.type}-${i}`}
                  className="mx-auto flex max-w-full items-center justify-center gap-1.5 py-1 text-[10px] italic text-[hsl(var(--muted-foreground))]"
                >
                  <Info size={10} aria-hidden />
                  <span className="font-medium">{t("editor.conversation.cardSystemNote")}</span>
                  {item.content && <span>· {item.content}</span>}
                </div>
              );
            }
            // spec §9.1 system_error — ❌ 빨간 라인 + chip + [다시 시도]. 본
            // surface 의 retry 는 부모 prop drill (`onRetryLastTurn`) — 인스펙터
            // 의 SummaryView 가 호스트라 onRetry 가 set 안된 경우 (history view)
            // 는 SystemErrorRow 내부에서 button 자동 suppress.
            if (isSystemError) {
              return (
                <SystemErrorRow
                  key={`${item.type}-${i}`}
                  item={item}
                  onRetry={onRetryLastTurn}
                  isClickable={isClickable}
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                />
              );
            }
            // Tool 은 시스템 이벤트로 buble 이 아닌 컴팩트 한 줄로 분리.
            if (isTool) {
              const summary = summarizeToolResult(item.toolResult);
              return (
                <div
                  key={`${item.type}-${item.turnIndex}-${i}`}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  className={cn(
                    "mx-3 flex items-center gap-2 border-l-2 border-dashed border-[hsl(var(--border))] py-1 pl-3 pr-2 text-[11px] text-[hsl(var(--muted-foreground))]",
                    isClickable &&
                      "cursor-pointer rounded-sm transition-colors hover:bg-[hsl(var(--accent))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]",
                  )}
                >
                  <span aria-hidden className="text-[10px]">🔧</span>
                  <span className="truncate font-mono text-[11px] text-[hsl(var(--foreground))]">
                    {item.content}
                  </span>
                  <ToolStatusIcon status={item.toolStatus} />
                  {summary && (
                    <span className="truncate text-[10px]">· {summary}</span>
                  )}
                  {item.error && (
                    <span className="truncate text-[10px] text-red-500">
                      · {item.error}
                    </span>
                  )}
                  {item.durationMs != null && (
                    <span className="ml-auto shrink-0 text-[10px]">
                      {item.durationMs}ms
                    </span>
                  )}
                </div>
              );
            }
            const ragSourceCount = isRag
              ? (item.content.match(/\[Source: /g) ?? []).length
              : 0;
            // assistant 한정으로 whitespace-only content 를 비어있음으로 취급.
            // user / rag 등 비-assistant 는 원본 content 그대로 (plain text 줄바꿈
            // 보존이 의도). SelectedItemDetail 과 동일 기준을 SummaryView 에도
            // 적용해 두 surface 의 시각이 어긋나지 않도록 한다.
            const hasContent = isAssistant
              ? !isAssistantContentBlank(item.content)
              : !!item.content;
            const hasAssistantToolCalls =
              isAssistant && !!item.assistantToolCalls?.length;
            return (
              <div
                key={`${item.type}-${item.turnIndex}-${i}`}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className={cn(
                  "rounded px-3 py-2 text-xs text-left",
                  // user 메시지는 plain text 줄바꿈 보존; AI/RAG 메시지는 markdown / 요약으로 처리.
                  !isAssistant && !isRag && "whitespace-pre-wrap",
                  item.type === "user"
                    ? "bg-[hsl(var(--accent))] ml-6"
                    : isRag
                      ? "bg-[hsl(var(--muted)/0.5)] border border-dashed border-[hsl(var(--border))] mx-3 italic"
                      : "bg-[hsl(var(--muted))] mr-6",
                  isClickable &&
                    "cursor-pointer transition-shadow hover:ring-1 hover:ring-[hsl(var(--primary))/0.3] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]",
                )}
              >
                <div className="mb-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                  {item.type === "user"
                    ? "👤 User"
                    : isRag
                      ? `🔎 KB Reference${ragSourceCount > 0 ? ` · ${ragSourceCount} chunk(s)` : ""}`
                      : "🤖 AI"}
                </div>
                {hasContent &&
                  (isAssistant ? (
                    <MarkdownRenderer content={item.content} />
                  ) : isRag ? (
                    <RagBubbleSummary content={item.content} />
                  ) : (
                    item.content
                  ))}
                {hasAssistantToolCalls && (
                  <div className={cn(hasContent && "mt-1.5")}>
                    <ToolCallBadge toolCalls={item.assistantToolCalls!} />
                  </div>
                )}
                {isAssistant && item.presentations && item.presentations.length > 0 && (
                  <AssistantPresentationsBlock
                    presentations={item.presentations}
                    onSendMessage={onSendMessage}
                    pendingFormToolCallId={pendingFormToolCallId}
                    onSubmitForm={onSubmitForm}
                  />
                )}
                {!hasContent && !hasAssistantToolCalls && !item.presentations?.length && (
                  <span className="italic text-[hsl(var(--muted-foreground))]">
                    (empty)
                  </span>
                )}
                {(() => {
                  if (!isAssistant || !onJumpToReferences) return null;
                  const turnSources =
                    turnRefIndex?.get(item.turnIndex) ?? [];
                  if (turnSources.length === 0) return null;
                  return (
                    <div className="mt-1.5">
                      <ReferencesChip
                        sources={turnSources}
                        onClick={() => onJumpToReferences(item.turnIndex)}
                        compact
                      />
                    </div>
                  );
                })()}
              </div>
            );
          });
          })()}
        </div>
      )}

    </div>
  );
}

/**
 * RAG bubble 의 짧은 요약 — 회수된 chunk 들의 문서명만 chip 으로 보여줘 한눈에 파악.
 * 클릭하면 SelectedItemDetail 의 RagDetail 에서 본문 markdown 렌더 전체 노출.
 */
function RagBubbleSummary({ content }: { content: string }) {
  const docNames = Array.from(
    new Set(
      Array.from(content.matchAll(/\[Source: ([^\]]+)\]/g), (m) => m[1].trim()),
    ),
  ).slice(0, 5);
  if (docNames.length === 0) {
    return (
      <span className="text-[hsl(var(--muted-foreground))]">
        (KB context retrieved)
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {docNames.map((n) => (
        <span
          key={n}
          className="rounded bg-[hsl(var(--background))] px-1.5 py-0.5 font-mono text-[10px] not-italic"
        >
          {n}
        </span>
      ))}
    </div>
  );
}

// ── Message input ──

function MessageInput({
  isDisabled,
  onSend,
  onEnd,
}: {
  isDisabled: boolean;
  onSend: (message: string) => void;
  onEnd: () => void;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isDisabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isDisabled]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isDisabled) return;
    onSend(trimmed);
    setText("");
  }, [text, isDisabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="border-t border-[hsl(var(--border))] p-2">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          placeholder={
            isDisabled
              ? t("editor.conversation.composerWaitingPlaceholder")
              : t("editor.conversation.composerPlaceholder")
          }
          className="flex-1 resize-none rounded border border-[hsl(var(--input))] bg-transparent px-2 py-1.5 text-xs placeholder:text-[hsl(var(--muted-foreground))] disabled:opacity-50"
          rows={1}
        />
        <div className="flex flex-col gap-1">
          <Button
            size="icon"
            className="h-7 w-7"
            disabled={isDisabled || !text.trim()}
            onClick={handleSend}
          >
            {isDisabled ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={onEnd}
            title={t("editor.conversation.endConversation")}
          >
            <Square className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
