"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { type ModelInfo } from "@/lib/api/llm-configs";
import { sanitizeLoaderError } from "./sanitize-loader-error";

export interface UseBaseModelLoaderArgs<TSnapshot> {
  /**
   * Stable identity of the current load scope (provider/config). When it
   * changes, models / error / hasAttemptedLoad reset in the render phase so the
   * previous scope's data never lingers in the select.
   */
  resetKey: string;
  /** Whether `load()` is allowed to run with the current inputs. */
  canLoad: boolean;
  /** Localized fallback when the error code is unknown / absent. */
  fallbackErrorMessage: string;
  /** Localized message per backend error code (see loader-error-messages). */
  errorMessagesByCode?: Record<string, string>;
  /**
   * Captures the current scope at mutation start. Compared in `onSuccess` via
   * `isSnapshotCurrent` to discard responses that arrive after the scope
   * changed (stale-closure guard).
   */
  captureSnapshot: () => TSnapshot;
  /** True when the captured snapshot still matches the current scope. */
  isSnapshotCurrent: (snapshot: TSnapshot) => boolean;
  /** Network call returning the model list for the current scope. */
  fetchModels: () => Promise<ModelInfo[]>;
}

export interface UseBaseModelLoaderResult {
  models: ModelInfo[];
  errorMessage: string | null;
  isPending: boolean;
  /**
   * True once the user has triggered `load()` for the current resetKey scope.
   * Lets consumers distinguish "not yet attempted" from "attempted but returned
   * no rows" — `useMutation.isSuccess` cannot be used because it is not reset
   * when the scope changes.
   */
  hasAttemptedLoad: boolean;
  canLoad: boolean;
  load: () => void;
}

/**
 * Shared state machine for the "load models" comboboxes (chat + embedding):
 * render-phase reset on scope change, `hasAttemptedLoad` tracking, stale-closure
 * guard, and error sanitization. Each consumer injects only what differs —
 * `fetchModels` (network routing), `canLoad`, and the snapshot equality check.
 */
export function useBaseModelLoader<TSnapshot>({
  resetKey,
  canLoad,
  fallbackErrorMessage,
  errorMessagesByCode,
  captureSnapshot,
  isSnapshotCurrent,
  fetchModels,
}: UseBaseModelLoaderArgs<TSnapshot>): UseBaseModelLoaderResult {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  // React 권장 "reset state on prop change" 패턴 (useEffect 대신 — useEffect 사용 시
  // 렌더 후 cleanup 이 한 프레임 지연되어 이전 값이 잠깐 노출될 수 있다).
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setModels([]);
    setErrorMessage(null);
    setHasAttemptedLoad(false);
  }

  const loadMutation = useMutation({
    mutationFn: async () => {
      const snapshot = captureSnapshot();
      const data = await fetchModels();
      return { data, snapshot };
    },
    onMutate: () => {
      // pending 중에는 이전 에러 메시지를 숨겨 사용자에게 진행 중임을 명확히 표시.
      setErrorMessage(null);
      setHasAttemptedLoad(true);
    },
    onSuccess: ({ data, snapshot }) => {
      // Stale closure 가드: 요청 출발 시점의 scope 가 현재와 다르면 무시한다.
      if (!isSnapshotCurrent(snapshot)) return;
      setModels(data);
    },
    onError: (err: unknown) => {
      // 재시도 실패 시 이전에 로드된 모델 목록은 유지해 사용자 선택 컨텍스트를 보존.
      setErrorMessage(
        sanitizeLoaderError(err, fallbackErrorMessage, errorMessagesByCode),
      );
    },
  });

  return {
    models,
    errorMessage,
    isPending: loadMutation.isPending,
    hasAttemptedLoad,
    canLoad,
    load: () => loadMutation.mutate(),
  };
}
