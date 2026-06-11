"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  modelConfigsApi,
  MODEL_CONFIGS_CHAT_LIST_QUERY_KEY,
} from "@/lib/api/model-configs";

/**
 * Resolves the chat ModelConfig id to use when a caller has not pinned an
 * explicit one: the workspace `isDefault` config, falling back to the first
 * available config. Shares the `MODEL_CONFIGS_CHAT_LIST_QUERY_KEY` cache with
 * the canvas pre-fill and selector dropdown so the list is fetched once.
 * Returns `undefined` while the list is empty / loading — callers should treat
 * that as "cannot load yet".
 */
export function useDefaultLlmConfigId(): string | undefined {
  const { data: configs = [] } = useQuery({
    queryKey: MODEL_CONFIGS_CHAT_LIST_QUERY_KEY,
    queryFn: () => modelConfigsApi.list("chat"),
    staleTime: 30_000,
  });
  return useMemo(
    // Intentional fallback: a workspace with configs but no explicit default
    // still resolves to a usable id (the first) so models can be loaded.
    () => configs.find((c) => c.isDefault)?.id ?? configs[0]?.id,
    [configs],
  );
}
