"use client";

import { llmConfigsApi } from "@/lib/api/llm-configs";
import {
  useBaseModelLoader,
  type UseBaseModelLoaderResult,
} from "./use-base-model-loader";

export interface UseEmbeddingModelLoaderArgs {
  /**
   * LLMConfig id 의 임베딩 모델 목록을 조회. 미지정 (`undefined`) 이면
   * `canLoad = false` — 호출자가 워크스페이스 default 등으로 폴백한 뒤
   * 결정된 id 를 넘긴다.
   */
  configId: string | undefined;
  /** Fallback error message when the error code is unknown / absent. */
  fallbackErrorMessage: string;
  /** Localized message per backend error code (see loader-error-messages). */
  errorMessagesByCode?: Record<string, string>;
}

export type UseEmbeddingModelLoaderResult = UseBaseModelLoaderResult;

/**
 * `useModelLoader` 의 임베딩 변형. preview 경로가 없고
 * `GET /llm-configs/:id/models?type=embedding` 하나만 호출한다. 공통 상태 관리는
 * `useBaseModelLoader` 가 담당한다.
 */
export function useEmbeddingModelLoader({
  configId,
  fallbackErrorMessage,
  errorMessagesByCode,
}: UseEmbeddingModelLoaderArgs): UseEmbeddingModelLoaderResult {
  return useBaseModelLoader<string | undefined>({
    resetKey: configId ?? "",
    canLoad: Boolean(configId),
    fallbackErrorMessage,
    errorMessagesByCode,
    captureSnapshot: () => configId,
    isSnapshotCurrent: (snapshot) => snapshot === configId,
    fetchModels: async () => {
      if (!configId) {
        // canLoad 가드가 있어 정상 흐름에서는 도달하지 않음. 방어용.
        throw new Error("missing-config-id");
      }
      return llmConfigsApi.listModels(configId, { type: "embedding" });
    },
  });
}
