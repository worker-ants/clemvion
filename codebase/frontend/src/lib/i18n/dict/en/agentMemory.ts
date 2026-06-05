import type { Dict } from "../types";

export const agentMemory: Dict["agentMemory"] = {
  title: "Agent Memory",
  description: "Browse and clean up AI Agent persistent memory by scope",
  refresh: "Refresh",
  scopes: {
    title: "Scopes",
    searchPlaceholder: "Search scopes...",
    count: "{{count}}",
    loadFailed: "Failed to load scopes",
    empty: "No memories yet",
    emptyHint:
      "Set an AI Agent node's memoryStrategy to persistent to accumulate memory across executions.",
    emptyHintLink: "Read the agent memory setup guide",
    delete: "Delete entire scope",
  },
  memories: {
    selectScope: "Select a scope on the left to view its memories",
    empty: "This scope has no memories",
    loadFailed: "Failed to load memories",
    count: "{{count}}",
    expiresAt: "Expires",
    updatedAt: "Updated",
    delete: "Delete memory",
  },
  kind: {
    filterLabel: "kind",
    all: "All",
    fact: "Fact",
    preference: "Preference",
    entity: "Entity",
  },
  loadMore: "Load more",
  deleteMemory: {
    title: "Delete memory",
    message: "Delete this memory? This cannot be undone.",
    success: "Memory deleted",
    failed: "Failed to delete memory",
  },
  clearScope: {
    title: "Delete entire scope",
    message:
      "Delete all {{count}} memories in scope '{{scopeKey}}'? This cannot be undone.",
    success: "All memories in the scope were deleted",
    failed: "Failed to delete scope",
  },
};
