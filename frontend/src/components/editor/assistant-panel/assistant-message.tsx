"use client";

import type { AssistantDisplayMessage } from "@/lib/stores/assistant-store";
import { ToolCallBadge } from "./tool-call-badge";
import { PlanCard } from "./plan-card";

interface AssistantMessageViewProps {
  message: AssistantDisplayMessage;
  onApprovePlan: () => void;
}

export function AssistantMessageView({
  message,
  onApprovePlan,
}: AssistantMessageViewProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-md bg-[hsl(var(--primary))] px-2.5 py-1.5 text-xs text-[hsl(var(--primary-foreground))]">
          {message.content}
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex flex-col gap-1.5">
      {message.content && (
        <div className="whitespace-pre-wrap rounded-md bg-[hsl(var(--muted)/0.4)] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))]">
          {message.content}
          {message.streaming && (
            <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-current align-middle" />
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
        <PlanCard
          plan={message.plan}
          onApprove={onApprovePlan}
          canApprove
        />
      )}
    </div>
  );
}
