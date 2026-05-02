"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Square, Wrench, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ConversationItem, ToolCallInfo } from "@/lib/stores/execution-store";
import type { NodeResult } from "@/lib/stores/execution-store";
import { resolveResultField } from "./resolve-result-field";
import { MarkdownRenderer } from "@/components/editor/assistant-panel/markdown-renderer";

function ToolCallBadge({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
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
        <span>Tool Call</span>
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span>{count} tool{count > 1 ? "s" : ""} called</span>
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
}: ConversationInspectorProps) {
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
                ← Back to conversation
              </button>
            )}
            <SelectedItemDetail
              key={`${selectedItem.type}-${selectedItem.turnIndex}`}
              item={selectedItem}
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

function SelectedItemDetail({ item }: { item: ConversationItem }) {
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

  const hasToolCalls = !!item.assistantToolCalls?.length;
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <span>🤖</span>
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          {hasToolCalls && !item.content
            ? `Tool Call — Turn ${item.turnIndex}`
            : `AI Response — Turn ${item.turnIndex}`}
        </span>
      </div>
      {item.content && (
        <div className="text-sm">
          <MarkdownRenderer content={item.content} />
        </div>
      )}
      {hasToolCalls && (
        <ToolCallBadge toolCalls={item.assistantToolCalls!} />
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
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <span>🔧</span>
        <span className="font-mono text-sm font-medium">{item.content}</span>
      </div>
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
            {new Date(item.timestamp).toLocaleString()}
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
}: {
  result: NodeResult;
  conversationConfig: unknown;
  isLive: boolean;
  conversationMessages: ConversationItem[];
  onSelectItem?: (index: number) => void;
}) {
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
    const msgs = msgsRaw as Array<{ role: string; content: string }>;
    let turnCounter = 0;
    const out: ConversationItem[] = [];
    for (const m of msgs) {
      if (m.role === "user") {
        turnCounter++;
        out.push({
          type: "user",
          content: m.content,
          turnIndex: turnCounter,
        });
      } else if (m.role === "assistant") {
        out.push({
          type: "assistant",
          content: m.content,
          turnIndex: turnCounter,
        });
      } else if (m.role === "system" && isRagContextContent(m.content)) {
        // RAG context 는 직전 user message 의 turn 에 속하도록 turnCounter 사용 (이미
        // user 가 처리되며 증가). 타입을 store 표준 외 "rag" 로 표시.
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
            return `Turn ${(config?.turnCount as number) ?? items.filter((m) => m.type === "user").length} / ${(config?.maxTurns as number) || "∞"}`;
          }
          if (!output) return "Conversation";
          const turnCount = resolveResultField<number>(output, "turnCount");
          const endReason = resolveResultField<string>(output, "endReason");
          return `${turnCount ?? "?"} turns — ${endReason ?? ""}`;
        })()}
      </div>

      {/* Full conversation thread */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item, i) => {
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
            const ragSourceCount = isRag
              ? (item.content.match(/\[Source: /g) ?? []).length
              : 0;
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
                {item.content ? (
                  isAssistant ? (
                    <MarkdownRenderer content={item.content} />
                  ) : isRag ? (
                    <RagBubbleSummary content={item.content} />
                  ) : (
                    item.content
                  )
                ) : item.assistantToolCalls?.length ? (
                  <ToolCallBadge toolCalls={item.assistantToolCalls} />
                ) : (
                  <span className="italic text-[hsl(var(--muted-foreground))]">
                    (empty)
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
            isDisabled ? "Waiting for AI response..." : "Type a message..."
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
            title="End conversation"
          >
            <Square className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
