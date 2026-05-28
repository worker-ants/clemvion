"use client";

import { createContext, useContext } from "react";

/**
 * Whether the workspace has an `isDefault` LLMConfig. Provided once by
 * `WorkflowCanvas` and read by every `CustomNode` to render the AI-node config
 * summary. Replaces a per-node `useQuery(["llm-configs"])` subscription: with N
 * AI nodes that caused N components to re-render on every query state change,
 * whereas a context value only re-renders consumers when the boolean flips.
 *
 * Defaults to `false` so a `CustomNode` rendered outside the provider (e.g. in
 * isolation tests) degrades gracefully to the "no default config" summary.
 */
const HasDefaultLlmConfigContext = createContext(false);

export const HasDefaultLlmConfigProvider = HasDefaultLlmConfigContext.Provider;

export function useHasDefaultLlmConfig(): boolean {
  return useContext(HasDefaultLlmConfigContext);
}
