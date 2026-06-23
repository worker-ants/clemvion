"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WebChatAppearanceConfig } from "@/lib/types/trigger";

/**
 * 외형/콘텐츠 draft.
 *
 * 서버(`config.interaction.appearance`)가 단일 출처(SoT)다 — 운영자가 저장하면 워크스페이스
 * 차원에서 보존돼 브라우저/운영자가 바뀌어도 재현된다(spec 5-admin-console §4). localStorage 는
 * **미저장 편집 캐시**로만 쓴다(저장 전 새로고침·이탈 시 손실 방지). 마운트 시 시드 우선순위:
 * 서버 appearance → localStorage → 기본값.
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
 * 역직렬화 값 sanitize — 오염된 값이 그대로 설치 스니펫 JSON 에 흘러가지 않도록
 * enum/패턴 필드를 화이트리스트로 강제한다(ai-review W-10). localStorage·서버 응답
 * 양쪽에 동일 적용.
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

function readLocalDraft(instanceId: string): WebChatDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + instanceId);
    return raw ? sanitizeDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** true 면 서버 appearance 에 실제 저장된 값이 하나라도 있다는 뜻(빈 객체 무시). */
function hasServerAppearance(a: WebChatAppearanceConfig | undefined): boolean {
  return !!a && Object.values(a).some((v) => v !== undefined && v !== "");
}

/** 마운트 시드: 서버 appearance → localStorage → 기본값. */
function seedDraft(
  instanceId: string,
  serverAppearance: WebChatAppearanceConfig | undefined,
): WebChatDraft {
  if (hasServerAppearance(serverAppearance)) {
    return sanitizeDraft({ ...DEFAULT_DRAFT, ...serverAppearance });
  }
  return readLocalDraft(instanceId) ?? DEFAULT_DRAFT;
}

/**
 * 인스턴스별 외형 draft. 호출 컴포넌트는 `key={instanceId}` 로 인스턴스 전환 시
 * 리마운트되므로(page.tsx `WebChatDetail`), lazy init 만으로 복원이 충분하다.
 *
 * @param serverAppearance 서버에 저장된 외형(있으면 시드 우선). 저장 성공 후 `markSaved()`
 *   로 dirty 기준선을 현재 draft 로 갱신한다.
 */
export function useAppearanceDraft(
  instanceId: string,
  serverAppearance?: WebChatAppearanceConfig,
) {
  const [draft, setDraft] = useState<WebChatDraft>(() =>
    seedDraft(instanceId, serverAppearance),
  );
  // 마지막 저장 기준선(서버에 반영됐다고 간주하는 직렬화 스냅샷).
  const [savedJson, setSavedJson] = useState<string>(() =>
    JSON.stringify(seedDraft(instanceId, serverAppearance)),
  );

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

  const draftJson = JSON.stringify(draft);
  const isDirty = draftJson !== savedJson;
  /** 저장 성공 후 호출 — 현재 draft 를 새 기준선으로(이후 isDirty=false). */
  const markSaved = useCallback(() => {
    setSavedJson(JSON.stringify(draft));
  }, [draft]);

  return useMemo(
    () => ({ draft, setDraft: patchDraft, isDirty, markSaved }),
    [draft, patchDraft, isDirty, markSaved],
  );
}
