"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { llmConfigsApi, type ModelInfo } from "@/lib/api/llm-configs";
import { sanitizeLoaderError } from "./sanitize-loader-error";

export interface UseEmbeddingModelLoaderArgs {
  /**
   * LLMConfig id 의 임베딩 모델 목록을 조회. 미지정 (`undefined`) 이면
   * `canLoad = false` — 호출자가 워크스페이스 default 등으로 폴백한 뒤
   * 결정된 id 를 넘긴다.
   */
  configId: string | undefined;
  /** Fallback error message when the server payload cannot be parsed. */
  fallbackErrorMessage: string;
}

export interface UseEmbeddingModelLoaderResult {
  models: ModelInfo[];
  errorMessage: string | null;
  isPending: boolean;
  /** 본 configId 범위에서 사용자가 `load()` 를 한 번이라도 트리거했는지. */
  hasAttemptedLoad: boolean;
  canLoad: boolean;
  load: () => void;
}

/**
 * `useModelLoader` 의 임베딩 변형. preview 경로가 없고 `GET /llm-configs/:id/models?type=embedding`
 * 하나만 호출한다. 상태 관리·에러 sanitize·stale closure 가드·prop 변경 시 리셋 패턴은
 * `useModelLoader` 와 대칭이다.
 */
export function useEmbeddingModelLoader({
  configId,
  fallbackErrorMessage,
}: UseEmbeddingModelLoaderArgs): UseEmbeddingModelLoaderResult {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  // configId 변경 시 이전 config 모델 목록은 더 이상 유효하지 않으므로 render 단계 reset.
  const resetKey = configId ?? "";
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setModels([]);
    setErrorMessage(null);
    setHasAttemptedLoad(false);
  }

  const loadMutation = useMutation({
    mutationFn: async () => {
      if (!configId) {
        // canLoad 가드가 있어 정상 흐름에서는 도달하지 않음. 방어용.
        throw new Error("missing-config-id");
      }
      const snapshot = configId;
      const data = await llmConfigsApi.listModels(snapshot, {
        type: "embedding",
      });
      return { data, snapshot };
    },
    onMutate: () => {
      setErrorMessage(null);
      setHasAttemptedLoad(true);
    },
    onSuccess: ({ data, snapshot }) => {
      // Stale closure 가드 — 응답 도착 시점에 configId 가 바뀌었으면 무시.
      if (snapshot !== configId) return;
      setModels(data);
    },
    onError: (err: unknown) => {
      setErrorMessage(sanitizeLoaderError(err, fallbackErrorMessage));
    },
  });

  return {
    models,
    errorMessage,
    isPending: loadMutation.isPending,
    hasAttemptedLoad,
    canLoad: Boolean(configId),
    load: () => loadMutation.mutate(),
  };
}
