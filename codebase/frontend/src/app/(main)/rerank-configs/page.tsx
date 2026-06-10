"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * DEPRECATED 라우트 — 통합 /models(Rerank 탭)로 redirect. 북마크 보존용. PR4 에서 제거.
 */
export default function RerankConfigsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/models?tab=rerank");
  }, [router]);
  return null;
}
