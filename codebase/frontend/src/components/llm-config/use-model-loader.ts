"use client";

import { useMemo } from "react";
import { llmConfigsApi } from "@/lib/api/llm-configs";
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
        ? llmConfigsApi.listModels(configId as string)
        : llmConfigsApi.previewModels({
            provider,
            apiKey: trimmedKey,
            baseUrl: trimmedBaseUrl || undefined,
          });
    },
  });
}
