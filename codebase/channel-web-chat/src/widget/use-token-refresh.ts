"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { EiaClient } from "@/lib/eia-client";
import { saveSession, type PersistedSession } from "@/lib/session-store";
import type { BootMessage } from "./host-bridge";

/** 토큰 만료 이 시간 이내로 진입하면 갱신(3-auth-session §3 step7). */
export const TOKEN_REFRESH_LEAD_MS = 30 * 60 * 1000;
/** 갱신 타이머 최소 지연(즉시 폭주 방지). */
export const TOKEN_REFRESH_MIN_DELAY_MS = 5_000;

/**
 * 만료 시각(ISO)과 현재 시각으로 다음 토큰 갱신 지연(ms) 계산.
 * 만료 30분 이전 시점을 목표로 하되, 이미 그 안쪽이면 최소 지연으로 즉시 갱신. 파싱 불가 시 null.
 */
export function refreshDelayMs(expiresAt: string, nowMs: number): number | null {
  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs)) return null;
  return Math.max(TOKEN_REFRESH_MIN_DELAY_MS, expiryMs - nowMs - TOKEN_REFRESH_LEAD_MS);
}

interface TokenRefreshDeps {
  sessionRef: MutableRefObject<PersistedSession | null>;
  clientRef: MutableRefObject<EiaClient | null>;
  configRef: MutableRefObject<BootMessage | null>;
}

/**
 * per_execution 토큰 자동 갱신(3-auth-session §3 step7)을 캡슐화한 훅 — useWidget God hook 분리(§B).
 *
 * 동작은 분리 전과 동일하다: 만료 30분 이내 진입을 목표로 setTimeout 을 예약하고, 갱신 성공 시 sessionRef·
 * 저장 세션을 갱신한 뒤 다음 만료 기준으로 **재예약(재귀)** 한다. 갱신 실패는 console.warn 만(SSE 는 hard expiry
 * 까지 유지, 다음 입력의 401 을 sendCommand 가 ERROR 처리). 언마운트 시 cancelled 가드 + 타이머 정리.
 *
 * 세션/클라이언트/설정은 useWidget 의 ref 를 그대로 받아 공유한다(refresh 콜백은 sessionRef.current 를 갱신).
 *
 * @returns scheduleRefresh — 시작/세션복원 직후 1회 호출해 예약 개시(stable). clearRefreshTimer — 종료·새 대화
 *   정리 경로(teardownSession)가 호출하는 idempotent 타이머 정리(stable).
 */
export function useTokenRefresh({ sessionRef, clientRef, configRef }: TokenRefreshDeps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  /** 갱신 타이머 정리(idempotent). 종료·새 대화·언마운트에서 null 된 sessionRef 에 쓰기 방지(W9). */
  const clearRefreshTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 함수 표현식 이름(scheduleRefresh)으로 setTimeout 콜백에서 자기 재귀 호출(재예약). deps 는 전부 stable
  // (ref + clearRefreshTimer) 이라 scheduleRefresh 도 stable — start()/applyConfig 가 직접 호출 가능(간접 ref 불요).
  const scheduleRefresh = useCallback(function scheduleRefresh(): void {
    clearRefreshTimer();
    const session = sessionRef.current;
    if (!session || cancelledRef.current) return;
    const delay = refreshDelayMs(session.expiresAt, Date.now());
    if (delay === null) return;
    timerRef.current = setTimeout(() => {
      const s = sessionRef.current;
      const client = clientRef.current;
      const cfg = configRef.current;
      if (!s || !client || !cfg || cancelledRef.current) return;
      void client
        .refreshToken(s.endpoints, s.token)
        .then(({ token, expiresAt }) => {
          if (cancelledRef.current) return;
          const updated = { ...s, token, expiresAt };
          sessionRef.current = updated;
          saveSession(cfg.triggerEndpointPath, updated);
          scheduleRefresh(); // 다음 만료 기준 재예약.
        })
        .catch((err: unknown) => {
          // 갱신 실패 — SSE 는 hard expiry 까지 유지. 다음 입력이 401 이면 sendCommand 가 ERROR 처리.
          console.warn("[widget] token refresh failed:", err instanceof Error ? err.message : String(err));
        });
    }, delay);
  }, [clearRefreshTimer, sessionRef, clientRef, configRef]);

  // 마운트 동안 cancelled=false, 언마운트 시 true + 타이머 정리(미해결 refresh 콜백 no-op 화).
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      clearRefreshTimer();
    };
  }, [clearRefreshTimer]);

  return { scheduleRefresh, clearRefreshTimer };
}
