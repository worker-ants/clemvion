import { useEffect, useState } from "react";
import {
  integrationsApi,
  type Cafe24PrecheckResult,
} from "@/lib/api/integrations";

/**
 * Mall ID 입력 단계의 사전 중복 감지 훅.
 *
 * `mall_id` 가 변경되면 350ms debounce 후 `GET /api/integrations/cafe24/precheck`
 * 를 호출해 동일 mall_id 의 cafe24 통합 존재 여부를 미리 확인한다. 결과는
 * inline 경고 배너 + Connect 버튼 disabled 의 입력이 된다.
 *
 * 동작 보장:
 * - `enabled=false` 또는 mall_id 패턴 위반 시 상태를 즉시 클리어 (영구 spinner
 *   잔존 방지).
 * - `mallId` 가 바뀌면 직전 in-flight fetch 를 `AbortController.abort()` 로
 *   취소 — backend throttle 카운터·서버 부하 절약 (ai-review INFO 6).
 * - 응답 실패는 silent fail (`backend 가드가 backstop`).
 *
 * `useCafe24MallIdPrecheck` 는 page.tsx 의 응집도 향상을 위해 ai-review W9
 * (2026-05-16) 에서 분리. spec/2-navigation/4-integration.md §9.2.
 */

const CAFE24_MALL_ID_PATTERN = /^[a-z0-9-]{3,50}$/;
const PRECHECK_DEBOUNCE_MS = 350;

export interface UseCafe24MallIdPrecheckResult {
  /** 충돌 결과 — null 이면 미감지 / 로딩 중 / enabled=false */
  conflict: Cafe24PrecheckResult | null;
  /** 350ms debounce 후 backend fetch 진행 중 여부 */
  loading: boolean;
}

export function useCafe24MallIdPrecheck(
  mallId: string,
  enabled: boolean,
): UseCafe24MallIdPrecheckResult {
  const [conflict, setConflict] = useState<Cafe24PrecheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setConflict(null);
      setLoading(false);
      return;
    }
    if (!CAFE24_MALL_ID_PATTERN.test(mallId)) {
      setConflict(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const result = await integrationsApi.cafe24Precheck(mallId, signal);
        if (!signal.aborted) setConflict(result);
      } catch {
        // AbortError 는 정상 cancel — silent (signal.aborted=true 분기).
        // 그 외 오류도 backend 가드가 backstop 이므로 inline 배너 없이 안전.
        if (!signal.aborted) setConflict(null);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }, PRECHECK_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [enabled, mallId]);

  return { conflict, loading };
}
