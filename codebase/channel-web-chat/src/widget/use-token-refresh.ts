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
 * 만료 30분 이전 시점을 목표로 하되, 이미 그 안쪽이면 최소 지연으로 즉시 갱신.
 *
 * @param expiresAt - 토큰 만료 시각(ISO 문자열).
 * @param nowMs - 기준 현재 시각(epoch ms).
 * @returns 다음 갱신까지 지연(ms, 최소 `TOKEN_REFRESH_MIN_DELAY_MS` 로 클램프). `expiresAt` 파싱 불가 시 `null`.
 */
export function refreshDelayMs(expiresAt: string, nowMs: number): number | null {
  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs)) return null;
  return Math.max(TOKEN_REFRESH_MIN_DELAY_MS, expiryMs - nowMs - TOKEN_REFRESH_LEAD_MS);
}

interface TokenRefreshDeps {
  /** 현재 세션(executionId·token·expiresAt·endpoints). 갱신 콜백이 `.current` 를 새 토큰으로 교체한다. */
  sessionRef: MutableRefObject<PersistedSession | null>;
  /** EIA 클라이언트(`refreshToken` 사용). 부팅 전·미설정 시 null — 콜백에서 가드. */
  clientRef: MutableRefObject<EiaClient | null>;
  /** boot config(`triggerEndpointPath` 로 저장 세션 키 결정). 미설정 시 null — 콜백에서 가드. */
  configRef: MutableRefObject<BootMessage | null>;
  /**
   * world 세대 토큰 — **소유자(useWidget)가 세계를 무효화할 때마다 증가시킨다**(종료·410·새 대화·
   * 대화 종료·언마운트). 이 훅은 `refreshToken` in-flight 중 세대가 바뀌면 응답을 폐기한다.
   *
   * **왜 이 훅이 자체 `cancelled` 플래그를 갖지 않는가**: 그 플래그는 언마운트에서만 set 됐고
   * `teardownSession()`(새 대화·대화 종료·SSE terminal 공유 choke point) 은 잡지 못했다. 그 결과
   * 갱신 요청이 떠 있는 동안 "새 대화"가 시작되면 뒤늦은 응답이 `sessionRef` 를 **옛 세션으로
   * 덮고 방금 지운 storage 를 되살렸다**(재현 확인). 세대는 언마운트를 포함한 모든 무효화를
   * 구분 없이 잡으므로 축이 하나면 충분하다 (`useWidget` 의 `worldGenRef` JSDoc §계약과 동일).
   */
  worldGenRef: MutableRefObject<number>;
}

/**
 * per_execution 토큰 자동 갱신(3-auth-session §3 step7)을 캡슐화한 훅 — useWidget God hook 분리(§B).
 *
 * 동작은 분리 전과 동일하다: 만료 30분 이내 진입을 목표로 setTimeout 을 예약하고, 갱신 성공 시 sessionRef·
 * 저장 세션을 갱신한 뒤 다음 만료 기준으로 **재예약(재귀)** 한다. 갱신 실패는 console.warn 만(SSE 는 hard expiry
 * 까지 유지, 다음 입력의 401 을 sendCommand 가 ERROR 처리). 언마운트 시 타이머 정리 + 이미 떠 있는
 * 응답은 world 세대 검사로 폐기(`worldGenRef` dep JSDoc 참조).
 *
 * 세션/클라이언트/설정은 useWidget 의 ref 를 그대로 받아 공유한다(refresh 콜백은 sessionRef.current 를 갱신).
 *
 * @returns scheduleRefresh — 시작/세션복원 직후 1회 호출해 예약 개시(stable). clearRefreshTimer — 종료·새 대화
 *   정리 경로(teardownSession)가 호출하는 idempotent 타이머 정리(stable).
 */
export function useTokenRefresh({ sessionRef, clientRef, configRef, worldGenRef }: TokenRefreshDeps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!session) return;
    const delay = refreshDelayMs(session.expiresAt, Date.now());
    if (delay === null) return;
    timerRef.current = setTimeout(() => {
      // 타이머 발화 시점의 최신 ref 값을 다시 읽는다(예약 시점의 외부 `session` 과 구분 — 섀도잉 회피).
      const currentSession = sessionRef.current;
      const currentClient = clientRef.current;
      const currentCfg = configRef.current;
      if (!currentSession || !currentClient || !currentCfg) return;
      // 요청을 띄우기 직전 세대를 캡처 — 응답이 도착할 때 비교한다.
      const gen = worldGenRef.current;
      void currentClient
        .refreshToken(currentSession.endpoints, currentSession.token)
        .then(({ token, expiresAt }) => {
          // 세계가 바뀌었으면(새 대화·종료·언마운트) 이 응답은 옛 세계의 것 — 폐기한다.
          // 이 검사가 없으면 아래 두 줄이 새 세션을 옛 세션으로 덮고 storage 를 되살린다.
          if (worldGenRef.current !== gen) return;
          const updated = { ...currentSession, token, expiresAt };
          sessionRef.current = updated;
          saveSession(currentCfg.triggerEndpointPath, updated);
          scheduleRefresh(); // 다음 만료 기준 재예약.
        })
        .catch((err: unknown) => {
          // 갱신 실패 — SSE 는 hard expiry 까지 유지. 다음 입력이 401 이면 sendCommand 가 ERROR 처리.
          console.warn("[widget] token refresh failed:", err instanceof Error ? err.message : String(err));
        });
    }, delay);
  }, [clearRefreshTimer, sessionRef, clientRef, configRef, worldGenRef]);

  // 언마운트 시 예약 타이머 정리. **아직 떠 있는 refresh 응답**은 여기서 못 막지만, 소유자가
  // 언마운트 cleanup 에서 세대를 올리므로 위 `.then()` 의 세대 검사가 폐기한다(deps JSDoc §계약).
  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  return { scheduleRefresh, clearRefreshTimer };
}
