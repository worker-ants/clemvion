"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { modelConfigsApi, MODEL_CONFIGS_EMBEDDING_LIST_QUERY_KEY } from "@/lib/api/model-configs";

/**
 * Resolves the embedding ModelConfig id to use when a caller has not pinned an
 * explicit one: the workspace `isDefault` kind=embedding config, falling back to
 * the first available embedding config. Returns `undefined` while the list is
 * empty / loading — callers should treat that as "no default to preselect" and
 * fall back to the empty (workspace-default) option.
 *
 * Mirrors `use-default-llm-config-id.ts`, but queries `modelConfigsApi.list("embedding")`.
 *
 * NOTE (WARNING #6): This hook is grouped with config-loader hooks and currently lives in
 * `llm-config/` for historical proximity to `use-default-llm-config-id.ts`. It will move
 * to `components/model-config/` when the `llm-config/` directory is removed in PR4.
 * Do not create a new directory now to avoid churn.
 */
export function useDefaultEmbeddingModelConfigId(): string | undefined {
  const { data: configs = [] } = useQuery({
    queryKey: MODEL_CONFIGS_EMBEDDING_LIST_QUERY_KEY,
    queryFn: () => modelConfigsApi.list("embedding"),
    staleTime: 30_000,
  });
  return useMemo(
    // Intentional fallback: a workspace with embedding configs but no explicit
    // default still resolves to a usable id (the first).
    () => configs.find((c) => c.isDefault)?.id ?? configs[0]?.id,
    [configs],
  );
}
