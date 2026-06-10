"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { modelConfigsApi } from "@/lib/api/model-configs";

/**
 * Resolves the embedding ModelConfig id to use when a caller has not pinned an
 * explicit one: the workspace `isDefault` kind=embedding config, falling back to
 * the first available embedding config. Returns `undefined` while the list is
 * empty / loading — callers should treat that as "no default to preselect" and
 * fall back to the empty (workspace-default) option.
 *
 * Mirrors `use-default-llm-config-id.ts`, but queries `modelConfigsApi.list("embedding")`.
 */
export function useDefaultEmbeddingModelConfigId(): string | undefined {
  const { data: configs = [] } = useQuery({
    queryKey: ["model-configs", "embedding", "list"],
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
