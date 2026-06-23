"use client";

import { useCallback, useEffect, useState } from "react";

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
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * localStorage 역직렬화 값 sanitize — 오염된 값이 그대로 설치 스니펫 JSON 에
 * 흘러가지 않도록 enum/패턴 필드를 화이트리스트로 강제한다(ai-review W-10).
 */
function sanitizeDraft(raw: unknown): WebChatDraft {
  const o = (raw ?? {}) as Partial<Record<keyof WebChatDraft, unknown>>;
  const color = asString(o.primaryColor);
  return {
    locale: o.locale === "en" ? "en" : "ko",
    primaryColor: HEX_COLOR.test(color) ? color : DEFAULT_DRAFT.primaryColor,
    position: o.position === "bottom-left" ? "bottom-left" : "bottom-right",
    headerTitle: asString(o.headerTitle),
    welcomeText: asString(o.welcomeText),
    suggestions: asString(o.suggestions),
    disclaimer: asString(o.disclaimer),
  };
}

function readDraft(instanceId: string): WebChatDraft {
  if (typeof window === "undefined") return DEFAULT_DRAFT;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + instanceId);
    return raw ? sanitizeDraft(JSON.parse(raw)) : DEFAULT_DRAFT;
  } catch {
    return DEFAULT_DRAFT;
  }
}

/**
 * 인스턴스별 외형 draft. 호출 컴포넌트는 `key={instanceId}` 로 인스턴스 전환 시
 * 리마운트되므로(page.tsx `WebChatDetail`), lazy init 만으로 복원이 충분하다.
 */
export function useAppearanceDraft(instanceId: string) {
  const [draft, setDraft] = useState<WebChatDraft>(() => readDraft(instanceId));

  // localStorage 동기화는 순수 setState 와 분리된 effect 로 — setState 업데이터
  // 안에서 쓰면 StrictMode 이중 실행 시 중복 쓰기가 난다(ai-review W-2).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(KEY_PREFIX + instanceId, JSON.stringify(draft));
    } catch {
      /* localStorage 미가용/쿼터 초과 — 보존만 건너뛰고 UI 는 정상 동작 */
    }
  }, [instanceId, draft]);

  const patchDraft = useCallback((patch: Partial<WebChatDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  return { draft, setDraft: patchDraft };
}
