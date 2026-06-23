"use client";

import { useCallback, useState } from "react";

/**
 * 외형/콘텐츠 draft — 백엔드 미저장. 운영자 편의를 위해 인스턴스별로 브라우저
 * localStorage 에만 보존한다 (spec 5-admin-console §4·R3).
 */
export interface WebChatDraft {
  locale: "ko" | "en";
  primaryColor: string;
  position: "bottom-right" | "bottom-left";
  headerTitle: string;
  welcomeText: string;
  /** 줄바꿈으로 구분된 추천 질문. */
  suggestions: string;
  disclaimer: string;
}

export const DEFAULT_DRAFT: WebChatDraft = {
  locale: "ko",
  primaryColor: "#5B4FE9",
  position: "bottom-right",
  headerTitle: "",
  welcomeText: "",
  suggestions: "",
  disclaimer: "",
};

const KEY_PREFIX = "clemvion:web-chat:appearance:";

function readDraft(instanceId: string): WebChatDraft {
  if (typeof window === "undefined") return DEFAULT_DRAFT;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + instanceId);
    return raw ? { ...DEFAULT_DRAFT, ...(JSON.parse(raw) as Partial<WebChatDraft>) } : DEFAULT_DRAFT;
  } catch {
    return DEFAULT_DRAFT;
  }
}

export function useAppearanceDraft(instanceId: string) {
  // 최초 마운트 시 localStorage 에서 직전 외형 복원(lazy init).
  const [draft, setDraftState] = useState<WebChatDraft>(() => readDraft(instanceId));

  // 인스턴스 전환을 effect 없이 렌더 중 감지해 재복원 (React 권장 패턴 —
  // "storing information from previous renders"). key 리마운트 없이도 안전.
  const [loadedId, setLoadedId] = useState(instanceId);
  if (loadedId !== instanceId) {
    setLoadedId(instanceId);
    setDraftState(readDraft(instanceId));
  }

  const setDraft = useCallback(
    (patch: Partial<WebChatDraft>) => {
      setDraftState((prev) => {
        const next = { ...prev, ...patch };
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(KEY_PREFIX + instanceId, JSON.stringify(next));
          } catch {
            /* localStorage 미가용/쿼터 초과 — 보존만 건너뛰고 UI 는 정상 동작 */
          }
        }
        return next;
      });
    },
    [instanceId],
  );

  return { draft, setDraft };
}
