"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Square } from "lucide-react";
import type { ConversationItem } from "@/lib/stores/execution-store";
import type { NodeResult } from "@/lib/stores/execution-store";
import { GenericRenderer } from "./renderers/generic-renderer";

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
      {/* Inspector content */}
      <div className="flex-1 overflow-y-auto p-3">
        {selectedItem ? (
          <SelectedItemDetail item={selectedItem} />
        ) : (
          <SummaryView
            result={result}
            conversationConfig={conversationConfig}
            isLive={isLive}
            conversationMessages={conversationMessages}
          />
        )}
      </div>

      {/* Input area (Live mode only) */}
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

function SelectedItemDetail({ item }: { item: ConversationItem }) {
  if (item.type === "tool") {
    return (
      <div className="flex flex-col gap-3">
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span>{item.type === "user" ? "👤" : "🤖"}</span>
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          {item.type === "user" ? "User Message" : "AI Response"} — Turn{" "}
          {item.turnIndex}
        </span>
      </div>
      <div className="whitespace-pre-wrap text-sm">{item.content}</div>
      {item.type === "assistant" && item.metadata && (
        <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-2">
          {item.metadata.inputTokens != null && (
            <span>
              Tokens: {item.metadata.inputTokens} in /{" "}
              {item.metadata.outputTokens} out
            </span>
          )}
          {(item.metadata.toolCalls ?? 0) > 0 && (
            <span>🔧 {item.metadata.toolCalls} tool calls</span>
          )}
          {(item.metadata.ragChunks ?? 0) > 0 && (
            <span>📚 {item.metadata.ragChunks} RAG chunks</span>
          )}
        </div>
      )}
    </div>
  );
}

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

  if (isLive) {
    // Show latest AI response
    const lastAssistant = [...conversationMessages]
      .reverse()
      .find((m) => m.type === "assistant");

    return (
      <div className="flex flex-col gap-3">
        <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Turn {(config?.turnCount as number) ?? conversationMessages.filter((m) => m.type === "user").length} /
          {(config?.maxTurns as number) || "∞"}
        </div>
        {lastAssistant && (
          <div className="whitespace-pre-wrap text-sm">
            {lastAssistant.content}
          </div>
        )}
      </div>
    );
  }

  // History mode: show summary + final response + raw JSON
  return (
    <div className="flex flex-col gap-4">
      {output && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {output.metadata && (
              <>
                <div className="text-[hsl(var(--muted-foreground))]">Model</div>
                <div>
                  {(output.metadata as Record<string, unknown>).model as string}
                </div>
                <div className="text-[hsl(var(--muted-foreground))]">Turns</div>
                <div>{output.turnCount as number}</div>
                <div className="text-[hsl(var(--muted-foreground))]">
                  End Reason
                </div>
                <div>{output.endReason as string}</div>
                <div className="text-[hsl(var(--muted-foreground))]">
                  Tokens
                </div>
                <div>
                  {
                    (output.metadata as Record<string, unknown>)
                      .totalTokens as number
                  }
                </div>
              </>
            )}
          </div>
          {output.response && (
            <div>
              <div className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Final Response
              </div>
              <div className="whitespace-pre-wrap rounded bg-[hsl(var(--muted))] p-2 text-sm">
                {output.response as string}
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

  // Auto-focus when enabled
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
          placeholder={isDisabled ? "Waiting for AI response..." : "Type a message..."}
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
