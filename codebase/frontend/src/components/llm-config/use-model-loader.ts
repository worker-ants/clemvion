"use client";

import { useMemo } from "react";
import { llmConfigsApi, type ModelInfo } from "@/lib/api/llm-configs";

/**
 * preview/listModels 만 추상화한 모델-로더 API 계약. llmConfigsApi(구 /llm-configs alias)
 * 와 modelConfigsApi(/model-configs) 가 모두 만족한다 — /models 통합 페이지·KB 임베딩
 * select 는 modelConfigsApi 를, 기존 호출부는 default llmConfigsApi 를 쓴다.
 */
export interface ModelLoaderApi {
  listModels(id: string, opts?: { type?: "chat" | "embedding" }): Promise<ModelInfo[]>;
  previewModels(payload: { provider: string; apiKey: string; baseUrl?: string }): Promise<ModelInfo[]>;
}
import {
  LOCAL_PROVIDER,
  PROVIDERS_REQUIRING_BASE_URL,
} from "@/lib/llm-providers";
import {
  useBaseModelLoader,
  type UseBaseModelLoaderResult,
} from "./use-base-model-loader";

function providerRequiresApiKey(provider: string) {
  return provider !== "" && provider !== LOCAL_PROVIDER;
}

interface LoadSnapshot {
  provider: string;
  configId: string | undefined;
}

export interface UseModelLoaderArgs {
  provider: string;
  /**
   * Plain API key from the form. Empty in edit mode when the user keeps the
   * existing saved key; the loader then falls back to the saved-config
   * `:id/models` endpoint instead of the preview endpoint.
   */
  apiKey: string;
  baseUrl?: string;
  /**
   * Present in edit mode. Enables fetching via the saved config when apiKey
   * is empty. Unused when apiKey is re-entered.
   */
  configId?: string;
  /** Fallback error message when the error code is unknown / absent. */
  fallbackErrorMessage: string;
  /** Localized message per backend error code (see loader-error-messages). */
  errorMessagesByCode?: Record<string, string>;
  /** 모델 조회에 쓸 API (default llmConfigsApi — /models 페이지는 modelConfigsApi 주입). */
  api?: ModelLoaderApi;
}

export type UseModelLoaderResult = UseBaseModelLoaderResult;

/**
 * Encapsulates the chat "load models" concerns: network routing (preview vs.
 * saved config) and the can-load gate. Shared state-machine behavior (reset,
 * stale-closure guard, error sanitization) lives in `useBaseModelLoader`.
 */
export function useModelLoader({
  provider,
  apiKey,
  baseUrl,
  configId,
  fallbackErrorMessage,
  errorMessagesByCode,
  api = llmConfigsApi,
}: UseModelLoaderArgs): UseModelLoaderResult {
  const canLoad = useMemo(() => {
    if (!provider) return false;
    if (PROVIDERS_REQUIRING_BASE_URL.has(provider) && !baseUrl?.trim()) {
      return false;
    }
    if (providerRequiresApiKey(provider)) {
      if (configId && !apiKey.trim()) return true;
      return apiKey.trim().length > 0;
    }
    return true;
  }, [provider, apiKey, baseUrl, configId]);

  return useBaseModelLoader<LoadSnapshot>({
    // apiKey 변경은 사용자가 타이핑하는 중간 단계라 의도적으로 reset 하지 않는다.
    resetKey: `${provider}|${configId ?? ""}`,
    canLoad,
    fallbackErrorMessage,
    errorMessagesByCode,
    captureSnapshot: () => ({ provider, configId }),
    isSnapshotCurrent: (s) =>
      s.provider === provider && s.configId === configId,
    fetchModels: async () => {
      const trimmedKey = apiKey.trim();
      const trimmedBaseUrl = baseUrl?.trim();
      const useSavedConfig = Boolean(configId) && !trimmedKey;
      return useSavedConfig
        ? api.listModels(configId as string)
        : api.previewModels({
            provider,
            apiKey: trimmedKey,
            baseUrl: trimmedBaseUrl || undefined,
          });
    },
  });
}
