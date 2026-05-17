// Re-export from the canonical lib path. The conversation utility lives in
// `@/lib/conversation/` so it can be consumed by `@/lib/websocket/` without
// inverting the layer hierarchy. Components and tests in this directory
// continue to import from the local path for stability.
export {
  messagesToConversationItems,
  toolStatusMapFromItems,
  parseHistoryMessages,
} from "@/lib/conversation/conversation-utils";
