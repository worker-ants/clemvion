"use client";

import { useMemo } from "react";
import type { AssistantDisplayMessage } from "@/lib/stores/assistant-store";
import { ToolCallBadge } from "./tool-call-badge";
import { PlanCard } from "./plan-card";
import { MarkdownRenderer } from "./markdown-renderer";
import { sanitizeAssistantText } from "./harmony-filter";

interface AssistantMessageViewProps {
  message: AssistantDisplayMessage;
  onApprovePlan: () => void;
}

export function AssistantMessageView({
  message,
  onApprovePlan,
}: AssistantMessageViewProps) {
  // hooks must run unconditionally — so sanitize/memo before any early
  // return below. user 메시지 경로에서는 displayText 를 사용하지 않지만,
  // React Hooks 규칙을 지키려면 호출 순서가 매 렌더마다 동일해야 한다.
  //
  // harmony 제어 토큰만 leak 된 assistant 메시지(예: commentary/json 블록)는
  // sanitize 후 빈 문자열이 되므로 bubble 자체를 렌더하지 않는다. 스트리밍
  // 중이면 커서 애니메이션을 위해 bubble 을 유지한다. useMemo 로 content
  // 변경 시에만 regex 가 돌도록 캐시한다.
  const displayText = useMemo(
    () => (message.content ? sanitizeAssistantText(message.content) : ""),
    [message.content],
  );

  if (message.role === "user") {
    // User text stays as plain preformatted content — we don't re-interpret
    // the user's own input as markdown (surprising, and their raw words are
    // what they typed).
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-md bg-[hsl(var(--primary))] px-2.5 py-1.5 text-xs text-[hsl(var(--primary-foreground))]">
          {message.content}
        </div>
      </div>
    );
  }

  // assistant — render markdown so LLM-authored **bold**, lists, fenced code
  // blocks, tables, and links display properly. The blinking cursor is a
  // sibling of the markdown block so it's never caught inside a code fence
  // or other inline element during streaming.
  const showBubble = displayText.length > 0 || message.streaming;
  return (
    <div className="flex flex-col gap-1.5">
      {showBubble && (
        <div className="rounded-md bg-[hsl(var(--muted)/0.4)] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))]">
          {displayText && <MarkdownRenderer content={displayText} />}
          {message.streaming && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-current align-[-2px]"
            />
          )}
        </div>
      )}
      {message.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {message.toolCalls.map((call) => (
            <ToolCallBadge key={call.id} call={call} />
          ))}
        </div>
      )}
      {message.plan && (
        <PlanCard plan={message.plan} onApprove={onApprovePlan} canApprove />
      )}
    </div>
  );
}
