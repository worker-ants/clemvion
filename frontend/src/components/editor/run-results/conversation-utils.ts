import type { ConversationItem } from "@/lib/stores/execution-store";

/**
 * Parse conversation messages from a completed AI Agent node's outputData.
 * Filters out system messages and maps to ConversationItem format.
 */
export function parseHistoryMessages(
  outputData: unknown,
): ConversationItem[] {
  const output = outputData as Record<string, unknown> | null;
  if (!output?.messages) return [];

  const messages = output.messages as Array<{
    role: string;
    content: string;
  }>;

  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m, i) => ({
      type: m.role as "user" | "assistant",
      content: m.content,
      turnIndex: Math.floor(i / 2) + 1,
    }));
}
