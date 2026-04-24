"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { llmConfigsApi, type ModelInfo } from "@/lib/api/llm-configs";
import {
  LOCAL_PROVIDER,
  PROVIDERS_REQUIRING_BASE_URL,
} from "@/lib/llm-providers";

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
  /** Fallback error message when the server payload cannot be parsed. */
  fallbackErrorMessage: string;
}

export interface UseModelLoaderResult {
  models: ModelInfo[];
  errorMessage: string | null;
  isPending: boolean;
  isSuccess: boolean;
  canLoad: boolean;
  load: () => void;
}

/**
 * Encapsulates the "load models" concerns: network routing (preview vs. saved
 * config), mutation state, error sanitization, stale-closure guard on provider/
 * configId change, and reset-on-prop-change. The consuming component only
 * renders the returned state.
 */
export function useModelLoader({
  provider,
  apiKey,
  baseUrl,
  configId,
  fallbackErrorMessage,
}: UseModelLoaderArgs): UseModelLoaderResult {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // provider / configId 변경 시 이전 provider 의 모델 목록이 datalist 에 남아
  // autocomplete 가 잘못된 모델을 제안하지 않도록 render 단계에서 초기화한다.
  // React 권장 "reset state on prop change" 패턴 (useEffect 대신).
  // apiKey 변경은 사용자가 타이핑하는 중간 단계라 의도적으로 초기화하지 않는다.
  const resetKey = `${provider}|${configId ?? ""}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setModels([]);
    setErrorMessage(null);
  }

  const loadMutation = useMutation({
    mutationFn: async () => {
      const trimmedKey = apiKey.trim();
      const trimmedBaseUrl = baseUrl?.trim();
      const snapshot: LoadSnapshot = { provider, configId };
      const useSavedConfig = Boolean(configId) && !trimmedKey;
      const data = useSavedConfig
        ? await llmConfigsApi.listModels(configId as string)
        : await llmConfigsApi.previewModels({
            provider,
            apiKey: trimmedKey,
            baseUrl: trimmedBaseUrl || undefined,
          });
      return { data, snapshot };
    },
    onMutate: () => {
      // pending 중에는 이전 에러 메시지를 숨겨 사용자에게 진행 중임을 명확히 표시.
      setErrorMessage(null);
    },
    onSuccess: ({ data, snapshot }) => {
      // Stale closure 가드: 요청 출발 시점의 props 가 현재 props 와 다르면
      // 이전 provider/configId 응답이므로 무시한다.
      if (
        snapshot.provider !== provider ||
        snapshot.configId !== configId
      ) {
        return;
      }
      setModels(data);
    },
    onError: (err: unknown) => {
      // 재시도 실패 시 이전에 로드된 모델 목록은 유지해 사용자 선택 컨텍스트를 보존.
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as
          | { message?: string | string[] }
          | undefined;
        const raw = body?.message;
        const msg = Array.isArray(raw) ? raw.join(", ") : raw;
        setErrorMessage(msg || fallbackErrorMessage);
        return;
      }
      setErrorMessage(fallbackErrorMessage);
    },
  });

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

  return {
    models,
    errorMessage,
    isPending: loadMutation.isPending,
    isSuccess: loadMutation.isSuccess,
    canLoad,
    load: () => loadMutation.mutate(),
  };
}
