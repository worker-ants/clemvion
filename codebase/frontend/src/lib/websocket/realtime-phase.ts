import { assertNever } from "@/lib/utils/exhaustive";

/** 스냅샷 · 이벤트가 이 시간 안에 오지 않으면 REST 폴링으로 넘기고 지연 토스트를 띄운다. */
export const REALTIME_TIMEOUT_MS = 10_000;

/**
 * 이 실행의 실시간 경로 상태(CLE-EXEC-RUN 「REST 폴링 대체 경로」).
 * - `awaiting`: 이 실행의 스냅샷 · 이벤트를 기다린다(구독 직후, 연결이 끊긴 뒤).
 * - `receiving`: 이 실행의 스냅샷이나 이벤트를 받았다. 실시간 경로가 살아 있다.
 * - `fallback`: 구독 · 연결이 실패했거나 10초 동안 받지 못했다. REST 폴링이 store 를 채운다.
 */
export type RealtimePhase = "awaiting" | "receiving" | "fallback";

/**
 * 실시간 경로 상태를 바꾸는 신호.
 * - `received`: 이 실행의 스냅샷이나 실행 이벤트가 왔다.
 * - `disconnected`: 소켓 연결이 끊겼다.
 * - `failed`: 구독 실패 응답(`subscribed` 의 `success: false`)이 왔거나 연결 대기가 실패했다.
 * - `timedOut`: 기다리기 시작한 뒤 `REALTIME_TIMEOUT_MS` 가 지났다.
 */
export type RealtimeSignal = "received" | "disconnected" | "failed" | "timedOut";

/**
 * 신호를 받은 뒤의 실시간 경로 상태.
 *
 * 실패와 10초 경과는 아직 받은 데이터가 없을 때(`awaiting`)만 폴링으로 넘긴다. 실패 응답에는
 * 채널이 없어 어느 구독의 실패인지 가릴 수 없으므로(CLE-API-WS 「구독 인가」) 이 실행의
 * 데이터를 이미 받은 뒤에 온 실패는 이 실행의 것으로 보지 않는다. 연결이 끊기면 수신 표시만
 * 지우고 10초를 다시 잰다. 이미 폴링 중이면 끊겨도 폴링을 이어 간다.
 */
export function nextRealtimePhase(
  phase: RealtimePhase,
  signal: RealtimeSignal,
): RealtimePhase {
  switch (signal) {
    case "received":
      return "receiving";
    case "disconnected":
      return phase === "receiving" ? "awaiting" : phase;
    case "failed":
    case "timedOut":
      return phase === "awaiting" ? "fallback" : phase;
    default:
      return assertNever(signal, "RealtimeSignal");
  }
}
