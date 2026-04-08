"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Square, Wrench, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ConversationItem, ToolCallInfo } from "@/lib/stores/execution-store";
import type { NodeResult } from "@/lib/stores/execution-store";
import { GenericRenderer } from "./renderers/generic-renderer";

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
  selectedItemIndex: number | null;
  isLive: boolean;
  isWaitingAiResponse: boolean;
  conversationConfig: unknown;
  onSendMessage: (message: string) => void;
  onEndConversation: () => void;
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
}: ConversationInspectorProps) {
  const selectedItem =
    selectedItemIndex != null
      ? conversationMessages[selectedItemIndex]
      : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {selectedItem ? (
          <SelectedItemDetail
            key={`${selectedItem.type}-${selectedItem.turnIndex}`}
            item={selectedItem}
          />
        ) : (
          <div className="p-3">
            <SummaryView
              result={result}
              conversationConfig={conversationConfig}
              isLive={isLive}
              conversationMessages={conversationMessages}
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

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

// ── Tab definitions ──

type AssistantTabId = "preview" | "response" | "request" | "usage";

const ASSISTANT_TABS: { id: AssistantTabId; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "response", label: "Response" },
  { id: "request", label: "Request" },
  { id: "usage", label: "Usage" },
];

function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex border-b border-[hsl(var(--border))] px-3 pt-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px",
            active === tab.id
              ? "border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
              : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Selected item detail (tabbed for assistant) ──

function SelectedItemDetail({ item }: { item: ConversationItem }) {
  // Key prop on the parent forces remount when item changes, resetting activeTab
  const [activeTab, setActiveTab] = useState<AssistantTabId>("preview");

  if (item.type === "tool") {
    return <ToolDetail item={item} />;
  }

  if (item.type === "user") {
    return <UserDetail item={item} />;
  }

  return (
    <div className="flex flex-col h-full">
      <TabBar tabs={ASSISTANT_TABS} active={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "preview" && <PreviewTab item={item} />}
        {activeTab === "response" && <ResponseTab item={item} />}
        {activeTab === "request" && <RequestTab item={item} />}
        {activeTab === "usage" && <UsageTab item={item} />}
      </div>
    </div>
  );
}

// ── Assistant tabs ──

function PreviewTab({ item }: { item: ConversationItem }) {
  const hasToolCalls = !!item.assistantToolCalls?.length;
  return (
    <div className="flex flex-col gap-3">
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
    </div>
  );
}

function ResponseTab({ item }: { item: ConversationItem }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="font-medium">Raw Response — Turn {item.turnIndex}</span>
        {item.durationMs != null && (
          <span className="ml-auto font-mono">
            {formatDuration(item.durationMs)}
          </span>
        )}
      </div>
      {item.responsePayload != null ? (
        <pre className="rounded bg-[hsl(var(--muted))] p-2 text-xs overflow-x-auto max-h-[60vh] overflow-y-auto">
          {JSON.stringify(item.responsePayload, null, 2)}
        </pre>
      ) : (
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          No response payload available
        </div>
      )}
    </div>
  );
}

function RequestTab({ item }: { item: ConversationItem }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
        Request Payload — Turn {item.turnIndex}
      </div>
      {item.requestPayload != null ? (
        <pre className="rounded bg-[hsl(var(--muted))] p-2 text-xs overflow-x-auto max-h-[60vh] overflow-y-auto">
          {JSON.stringify(item.requestPayload, null, 2)}
        </pre>
      ) : (
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          No request payload available
        </div>
      )}
    </div>
  );
}

function UsageTab({ item }: { item: ConversationItem }) {
  const meta = item.metadata;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
        Turn {item.turnIndex} Usage
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {meta?.model && (
          <>
            <div className="text-[hsl(var(--muted-foreground))]">Model</div>
            <div className="font-mono">{meta.model}</div>
          </>
        )}
        <div className="text-[hsl(var(--muted-foreground))]">Input Tokens</div>
        <div className="font-mono">{meta?.inputTokens ?? 0}</div>
        <div className="text-[hsl(var(--muted-foreground))]">Output Tokens</div>
        <div className="font-mono">{meta?.outputTokens ?? 0}</div>
        <div className="text-[hsl(var(--muted-foreground))]">Total Tokens</div>
        <div className="font-mono">
          {(meta?.inputTokens ?? 0) + (meta?.outputTokens ?? 0)}
        </div>
        {item.durationMs != null && (
          <>
            <div className="text-[hsl(var(--muted-foreground))]">Latency</div>
            <div className="font-mono">
              {item.durationMs < 1000
                ? `${item.durationMs}ms`
                : `${(item.durationMs / 1000).toFixed(2)}s`}
            </div>
          </>
        )}
        {(meta?.toolCalls ?? 0) > 0 && (
          <>
            <div className="text-[hsl(var(--muted-foreground))]">Tool Calls</div>
            <div className="font-mono">{meta?.toolCalls}</div>
          </>
        )}
        {(meta?.ragChunks ?? 0) > 0 && (
          <>
            <div className="text-[hsl(var(--muted-foreground))]">RAG Chunks</div>
            <div className="font-mono">{meta?.ragChunks}</div>
          </>
        )}
      </div>
      {item.timestamp && (
        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {new Date(item.timestamp).toLocaleString()}
        </div>
      )}
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
}: {
  result: NodeResult;
  conversationConfig: unknown;
  isLive: boolean;
  conversationMessages: ConversationItem[];
}) {
  const config = conversationConfig as Record<string, unknown> | null;
  const output = result.outputData as Record<string, unknown> | null;

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
          {items.map((item, i) => (
            <div
              key={`${item.type}-${item.turnIndex}-${i}`}
              className={cn(
                "rounded px-3 py-2 text-xs whitespace-pre-wrap",
                item.type === "user"
                  ? "bg-[hsl(var(--accent))] ml-6"
                  : "bg-[hsl(var(--muted))] mr-6",
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
            </div>
          ))}
        </div>
      )}

      {/* History mode: metadata + raw output */}
      {!isLive && output && (
        <>
          {output.metadata && (
            <div className="grid grid-cols-2 gap-2 text-xs border-t border-[hsl(var(--border))] pt-3">
              <div className="text-[hsl(var(--muted-foreground))]">Model</div>
              <div>
                {(output.metadata as Record<string, unknown>).model as string}
              </div>
              <div className="text-[hsl(var(--muted-foreground))]">Tokens</div>
              <div>
                {(output.metadata as Record<string, unknown>).totalTokens as number}
              </div>
            </div>
          )}
          <div>
            <div className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Output Data
            </div>
            <GenericRenderer result={result} />
          </div>
        </>
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
