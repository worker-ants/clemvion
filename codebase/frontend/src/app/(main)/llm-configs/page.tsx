"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * DEPRECATED 라우트 — 통합 /models(Chat 탭)로 redirect. 북마크 보존용.
 * (구 LLM 설정 화면은 /models 로 통합 — spec/2-navigation/6-config.md Part B. PR4 에서 제거.)
 */
export default function LlmConfigsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/models?tab=chat");
  }, [router]);
  return null;
}
