"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { llmConfigsApi, LLM_CONFIGS_QUERY_KEY } from "@/lib/api/llm-configs";

/**
 * Resolves the LLMConfig id to use when a caller has not pinned an explicit one:
 * the workspace `isDefault` config, falling back to the first available config.
 * Shares the `LLM_CONFIGS_QUERY_KEY` cache with the canvas pre-fill and selector
 * dropdown so the list is fetched once. Returns `undefined` while the list is
 * empty / loading — callers should treat that as "cannot load yet".
 */
export function useDefaultLlmConfigId(): string | undefined {
  const { data: configs = [] } = useQuery({
    queryKey: LLM_CONFIGS_QUERY_KEY,
    queryFn: () => llmConfigsApi.list(),
    staleTime: 30_000,
  });
  return useMemo(
    // Intentional fallback: a workspace with configs but no explicit default
    // still resolves to a usable id (the first) so models can be loaded.
    () => configs.find((c) => c.isDefault)?.id ?? configs[0]?.id,
    [configs],
  );
}
