"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { isTerminalAuthError, redactToken, type EiaClient } from "@/lib/eia-client";
import { applyRefreshedToken, type PersistedSession } from "@/lib/session-store";
import type { BootMessage } from "./host-bridge";

/** 토큰 만료 이 시간 이내로 진입하면 갱신(3-auth-session §3 step7). */
export const TOKEN_REFRESH_LEAD_MS = 30 * 60 * 1000;
/** 갱신 타이머 최소 지연(즉시 폭주 방지). */
export const TOKEN_REFRESH_MIN_DELAY_MS = 5_000;
/** 일시적 실패 후 첫 재시도까지의 지연 — 이후 실패마다 2배씩 늘린다. */
export const TOKEN_REFRESH_RETRY_BASE_MS = TOKEN_REFRESH_MIN_DELAY_MS;
/** 재시도 백오프 상한. 무기한 재시도하되 폭주하지 않게 하는 천장. */
export const TOKEN_REFRESH_RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

/**
 * 연속 실패 횟수에 대한 재시도 지연(지수 백오프, 상한 클램프).
 *
 * @param consecutiveFailures - 1 부터 시작하는 연속 실패 횟수.
 * @returns 다음 재시도까지 지연(ms).
 */
export function retryDelayMs(consecutiveFailures: number): number {
  const exponent = Math.max(0, consecutiveFailures - 1);
  return Math.min(
    TOKEN_REFRESH_RETRY_MAX_DELAY_MS,
    TOKEN_REFRESH_RETRY_BASE_MS * 2 ** exponent,
  );
}

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
  /**
   * 토큰 갱신이 **성공할 때마다** 새 세션으로 호출된다(세대 검사를 통과한 응답만).
   *
   * **왜 필요한가**: 재로드 복구가 일시적 이유로 실패하면(`SeedOutcome` 의 `"refresh_deferred"`)
   * 호출부는 SSE 를 열지 않고 이 훅의 예약에 복구를 맡긴다. 그런데 이 훅은 토큰만 갱신할 뿐
   * 스트림을 열지 않으므로, 이 통지가 없으면 **토큰이 살아나도 스트림은 영영 닫힌 채**다
   * (ai-review `17_15_33_2` requirement CRITICAL — 내가 `SeedOutcome` JSDoc 에 "갱신은 기대할
   * 수 있다" 고 쓴 보장이 구현보다 넓었다).
   *
   * 소유자는 렌더마다 새 함수를 넘겨도 된다 — 내부에서 ref 로 최신값만 읽으므로
   * `scheduleRefresh` 의 안정성(stable identity)을 깨지 않는다.
   */
  onRefreshed?: (session: PersistedSession) => void;
}

/**
 * per_execution 토큰 자동 갱신(3-auth-session §3 step7)을 캡슐화한 훅 — useWidget God hook 분리(§B).
 *
 * 만료 30분 이내 진입을 목표로 setTimeout 을 예약하고, 갱신 성공 시 sessionRef·저장 세션을 갱신하고
 * `onRefreshed` 로 소유자에게 알린 뒤 다음 만료 기준으로 **재예약(재귀)** 한다. 언마운트 시 타이머 정리 +
 * 이미 떠 있는 응답은 world 세대 검사로 폐기(`worldGenRef` dep JSDoc 참조).
 *
 * **실패는 두 갈래다**(종전엔 한 갈래 — console.warn 후 끝, 그래서 한 번 실패하면 갱신 사이클이 죽었다):
 * - `401`/`410`(만료·jti blacklist·종료): 재시도해도 못 산다 → 멈춘다. SSE 는 hard expiry 까지 유지되고
 *   다음 입력의 401 을 sendCommand 가 ERROR 로 처리한다.
 * - 그 외(네트워크·5xx): **지수 백오프로 재예약**한다(`retryDelayMs`, 상한 `TOKEN_REFRESH_RETRY_MAX_DELAY_MS`).
 *   재로드 복구가 `"refresh_deferred"` 로 이 훅에 복구를 맡기므로, 여기서 포기하면 위젯이 스피너에 고착된다.
 *
 * 세션/클라이언트/설정은 useWidget 의 ref 를 그대로 받아 공유한다(refresh 콜백은 sessionRef.current 를 갱신).
 *
 * @returns scheduleRefresh — 시작/세션복원 직후 1회 호출해 예약 개시(stable). clearRefreshTimer — 종료·새 대화
 *   정리 경로(teardownSession)가 호출하는 idempotent 타이머 정리(stable).
 */
export function useTokenRefresh({
  sessionRef,
  clientRef,
  configRef,
  worldGenRef,
  onRefreshed,
}: TokenRefreshDeps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * 연속 실패 횟수(백오프 계산용). **공개 진입(`scheduleRefresh()` 인자 없음)에서만 0 으로
   * 되돌린다** — 재시도 자신이 리셋하면 백오프가 자라지 않아 5초 폭주가 된다.
   */
  const failuresRef = useRef(0);
  // 렌더마다 갱신되는 최신 콜백. deps 에 넣지 않는 이유는 `onRefreshed` JSDoc 참조
  // (넣으면 소유자의 인라인 화살표 함수가 매 렌더 `scheduleRefresh` 를 새로 만들어 stable 계약이 깨진다).
  const onRefreshedRef = useRef(onRefreshed);
  onRefreshedRef.current = onRefreshed;

  /** 갱신 타이머 정리(idempotent). 종료·새 대화·언마운트에서 null 된 sessionRef 에 쓰기 방지(W9). */
  const clearRefreshTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 함수 표현식 이름(scheduleWithDelay)으로 setTimeout 콜백에서 자기 재귀 호출(재예약). deps 는 전부 stable
  // (ref + clearRefreshTimer) 이라 아래 공개 래퍼도 stable — start()/applyConfig 가 직접 호출 가능(간접 ref 불요).
  // `retryDelay` 는 **재시도 재귀 전용**이다 — 아래 공개 래퍼가 인자를 막아 이 파라미터가
  // 훅의 반환 타입에 새어 나가지 않게 한다. 새면 호출부가 임의 지연을 넣을 수 있고, 그건
  // `failuresRef` 리셋 조건(`retryDelay === undefined`)과 결합해 백오프를 조용히 무력화한다
  // (ai-review `17_55_57` maintainability).
  const scheduleWithDelay = useCallback(function scheduleWithDelay(retryDelay?: number): void {
    clearRefreshTimer();
    // 공개 진입(`scheduleRefresh()` — 인자 없음) = "지금부터 새로 예약한다" → 백오프 리셋.
    // 내부 백오프 재귀(인자 있음)는 카운터를 유지한다.
    if (retryDelay === undefined) failuresRef.current = 0;
    const session = sessionRef.current;
    if (!session) return;
    const delay = retryDelay ?? refreshDelayMs(session.expiresAt, Date.now());
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
          const updated = applyRefreshedToken(
            currentSession,
            { token, expiresAt },
            currentCfg.triggerEndpointPath,
          );
          sessionRef.current = updated;
          // 소유자 통지 — `refresh_deferred` 로 미뤄 둔 스트림이 있으면 지금 연다.
          // **`scheduleRefresh()` 보다 먼저 부른다**: 재예약이 백오프를 리셋하는 것과 무관하게,
          // 복구 통지는 이 왕복의 결과이므로 같은 tick 에 전달되어야 한다.
          //
          // **소비자 예외를 여기서 삼킨다.** 감싸지 않으면 콜백의 동기 throw 가 같은 체인의
          // `.catch()` 로 떨어져 **성공한 갱신이 "갱신 실패" 로 오분류**되고(경고 오출력 +
          // 백오프 카운터 증가), 아래 재예약도 건너뛴다. refresh 는 이미 성공했고 세션도
          // 갱신됐다 — 소비자 쪽 사고가 그 사실을 뒤집어선 안 된다
          // (ai-review `17_55_57` side_effect).
          try {
            onRefreshedRef.current?.(updated);
          } catch (notifyErr) {
            // **redact 한다** — 이 콜백은 `openStream` 으로 이어지고, 그 안에서 던지는 시점엔
            // 이미 **토큰이 쿼리에 실린 URL** 이 만들어져 있다. 메시지를 그대로 찍으면 단명
            // 토큰이 콘솔에 남는다(ai-review `18_23_54` security).
            console.warn(
              "[widget] onRefreshed consumer threw (refresh itself succeeded):",
              redactToken(notifyErr instanceof Error ? notifyErr.message : String(notifyErr)),
            );
          }
          scheduleWithDelay(); // 다음 만료 기준 재예약(백오프 리셋).
        })
        .catch((err: unknown) => {
          // 세계가 바뀌었으면(새 대화·종료·언마운트) 이 실패도 옛 세계의 것 — 재시도까지 폐기한다.
          // 없으면 종료된 세션이 백그라운드에서 계속 갱신을 시도한다.
          if (worldGenRef.current !== gen) return;
          console.warn("[widget] token refresh failed:", err instanceof Error ? err.message : String(err));
          // `401`/`410` 은 재시도해도 살아나지 않는다(만료·jti blacklist·종료). 종전대로 여기서 멈춘다 —
          // SSE 는 hard expiry 까지 유지되고, 다음 입력의 401 을 sendCommand 가 ERROR 로 처리한다.
          if (isTerminalAuthError(err)) return;
          // **일시적 실패(네트워크·5xx)는 재예약한다.** 종전엔 로그만 남기고 끝나서 **한 번의
          // 실패로 이 세션의 갱신 사이클이 통째로 죽었다** — 재로드 복구가 `"refresh_deferred"`
          // 로 이 훅에 복구를 맡기는 경로에선 그게 곧 영구 고착이었다
          // (ai-review `17_15_33_2` requirement CRITICAL).
          failuresRef.current += 1;
          scheduleWithDelay(retryDelayMs(failuresRef.current));
        });
    }, delay);
  }, [clearRefreshTimer, sessionRef, clientRef, configRef, worldGenRef]);

  /**
   * 공개 예약 진입점 — **인자를 받지 않는다**(`() => void`). 내부 백오프 재귀만
   * `scheduleWithDelay` 로 지연을 넘긴다.
   */
  const scheduleRefresh = useCallback(() => scheduleWithDelay(), [scheduleWithDelay]);

  // 언마운트 시 예약 타이머 정리. **아직 떠 있는 refresh 응답**은 여기서 못 막지만, 소유자가
  // 언마운트 cleanup 에서 세대를 올리므로 위 `.then()` 의 세대 검사가 폐기한다(deps JSDoc §계약).
  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  return { scheduleRefresh, clearRefreshTimer };
}
