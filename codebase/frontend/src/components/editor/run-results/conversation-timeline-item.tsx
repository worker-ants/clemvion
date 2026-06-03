"use client";

import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import type { ConversationItem } from "@/lib/stores/execution-store";
import {
  CheckCircle,
  Loader2,
  XCircle,
  Wrench,
  Info,
  AlertCircle,
} from "lucide-react";
import { formatDuration } from "./utils";

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
          {item.toolStatus === "pending" ? (
            <Loader2 className="ml-auto h-3 w-3 shrink-0 animate-spin text-[hsl(var(--muted-foreground))]" />
          ) : item.toolStatus === "success" ? (
            <CheckCircle className="ml-auto h-3 w-3 shrink-0 text-green-500" />
          ) : item.toolStatus === "error" ? (
            <XCircle className="ml-auto h-3 w-3 shrink-0 text-red-500" />
          ) : null}
        </div>
      ) : item.type === "presentation" ? (
        // spec/conventions/conversation-thread.md §9.1 — presentation_user
        // turn 은 timeline 에서도 🧩 + nodeLabel 로 격하 표시.
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">🧩</span>
          <span className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
            {item.presentation?.nodeLabel ?? "Presentation"}
          </span>
        </div>
      ) : item.type === "system" ? (
        <div className="flex items-center gap-1.5">
          <Info size={10} className="text-[hsl(var(--muted-foreground))]" />
          <span className="truncate text-[11px] italic text-[hsl(var(--muted-foreground))]">
            {item.content || "System note"}
          </span>
        </div>
      ) : item.type === "system_error" ? (
        // spec/conventions/conversation-thread.md §9.1 — ❌ system_error 행.
        // 좌측 timeline 은 chip vs full-bubble 두 형태 중 한 줄 컴팩트
        // (Inv-5 — surface 별 시각 형식 차이 허용). 우측 retry 버튼은 본
        // surface 에 노출하지 않고 인스펙터의 SystemErrorRow 에만 둠.
        <div className="flex items-center gap-1.5">
          <AlertCircle size={10} className="text-red-500" />
          <span className="truncate font-mono text-[10px] text-red-700 dark:text-red-400">
            {item.systemError?.code ?? "ERROR"}
          </span>
          <span className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
            {item.content}
          </span>
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
      {/* spec/conventions/conversation-thread.md §9.12 — 요소별 발생 시각(절대)
          + assistant·tool 소요시간. 결측 시 해당 표기 생략. */}
      {(item.timestamp || item.durationMs != null) && (
        <div className="ml-4 flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
          {item.timestamp && (
            <span>{formatDate(item.timestamp, "time-seconds")}</span>
          )}
          {item.timestamp && item.durationMs != null && <span>·</span>}
          {item.durationMs != null && (
            <span>{formatDuration(item.durationMs)}</span>
          )}
        </div>
      )}
    </button>
  );
}
