"use client";

import { cn } from "@/lib/utils/cn";
import type { ConversationItem } from "@/lib/stores/execution-store";
import { CheckCircle, XCircle, Wrench } from "lucide-react";

interface ConversationTimelineItemProps {
  item: ConversationItem;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationTimelineItem({
  item,
  isSelected,
  onClick,
}: ConversationTimelineItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-xs",
        "hover:bg-[hsl(var(--accent))]",
        isSelected && "bg-[hsl(var(--accent))]",
      )}
    >
      {item.type === "tool" ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">🔧</span>
          <span className="truncate font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
            {item.content}
          </span>
          {item.toolStatus === "success" ? (
            <CheckCircle className="ml-auto h-3 w-3 shrink-0 text-green-500" />
          ) : item.toolStatus === "error" ? (
            <XCircle className="ml-auto h-3 w-3 shrink-0 text-red-500" />
          ) : null}
        </div>
      ) : (
        <div className="flex gap-1.5">
          <span className="shrink-0 text-[10px]">
            {item.type === "user" ? "👤" : "🤖"}
          </span>
          <span className="line-clamp-2 text-[hsl(var(--foreground))]">
            {item.content || (item.assistantToolCalls?.length ? (
              <span className="inline-flex items-center gap-0.5 text-[hsl(var(--muted-foreground))]">
                <Wrench size={10} />
                <span className="text-[10px]">
                  {item.assistantToolCalls.length === 1
                    ? "Called 1 tool"
                    : `Called ${item.assistantToolCalls.length} tools`}
                </span>
              </span>
            ) : null)}
          </span>
        </div>
      )}
      {item.type === "assistant" && item.metadata && (
        <div className="ml-4 flex gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
          {(item.metadata.ragChunks ?? 0) > 0 && (
            <span>📚 {item.metadata.ragChunks}</span>
          )}
          {(item.metadata.toolCalls ?? 0) > 0 && (
            <span>🔧 {item.metadata.toolCalls}</span>
          )}
        </div>
      )}
    </button>
  );
}
