"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Square, Wrench, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ConversationItem, ToolCallInfo } from "@/lib/stores/execution-store";
import type { NodeResult } from "@/lib/stores/execution-store";

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

function SelectedItemDetail({ item }: { item: ConversationItem }) {
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
        <div className="whitespace-pre-wrap text-sm">{item.content}</div>
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

  // Full conversation thread (shown in both Live and History)
  const items = useMemo(() => {
    if (isLive) return conversationMessages;
    if (!output?.messages) return conversationMessages;
    const msgs = output.messages as Array<{ role: string; content: string }>;
    let turnCounter = 0;
    return msgs
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m): ConversationItem => {
        if (m.role === "user") turnCounter++;
        return {
          type: m.role as "user" | "assistant",
          content: m.content,
          turnIndex: turnCounter,
        };
      });
  }, [isLive, conversationMessages, output]);

  return (
    <div className="flex flex-col gap-4">
      {/* Turn counter */}
      <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
        {isLive
          ? `Turn ${(config?.turnCount as number) ?? items.filter((m) => m.type === "user").length} / ${(config?.maxTurns as number) || "∞"}`
          : output
            ? `${output.turnCount as number} turns — ${output.endReason as string}`
            : "Conversation"}
      </div>

      {/* Full conversation thread */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item, i) => {
            const isClickable = !!onSelectItem;
            const Wrapper = isClickable ? "button" : "div";
            return (
            <Wrapper
              key={`${item.type}-${item.turnIndex}-${i}`}
              type={isClickable ? "button" : undefined}
              onClick={isClickable ? () => onSelectItem(i) : undefined}
              className={cn(
                "rounded px-3 py-2 text-xs whitespace-pre-wrap text-left",
                item.type === "user"
                  ? "bg-[hsl(var(--accent))] ml-6"
                  : "bg-[hsl(var(--muted))] mr-6",
                isClickable && "cursor-pointer transition-shadow hover:ring-1 hover:ring-[hsl(var(--primary))/0.3]",
              )}
            >
              <div className="mb-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                {item.type === "user" ? "👤 User" : "🤖 AI"}
              </div>
              {item.content ? (
                item.content
              ) : item.assistantToolCalls?.length ? (
                <ToolCallBadge toolCalls={item.assistantToolCalls} />
              ) : (
                <span className="italic text-[hsl(var(--muted-foreground))]">
                  (empty)
                </span>
              )}
            </Wrapper>
            );
          })}
        </div>
      )}

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
