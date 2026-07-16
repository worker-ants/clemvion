"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { EiaClient, EiaError, type EventSourceLike } from "@/lib/eia-client";
import type {
  AiMessageEvent,
  ExecutionMessageEvent,
  HookStartResponse,
  InteractCommand,
  WaitingForInputEvent,
} from "@/lib/eia-types";
import { parseAiMessage, parseMessage, parseWaitingForInput } from "@/lib/eia-events";
import { threadToMessages } from "@/lib/conversation";
import { clearSession, loadSession, saveSession, type PersistedSession } from "@/lib/session-store";
import { initialState, isTextInputSurface, widgetReducer } from "@/lib/widget-state";
import { WIDGET_STRINGS } from "@/lib/i18n";
import { createIframeBridge, detectHostOrigin, type BootMessage } from "./host-bridge";
import { useTokenRefresh } from "./use-token-refresh";
import { usePendingMessageQueue } from "./use-pending-message-queue";
import type { WcResizePayload } from "./wc-protocol";

// 토큰 갱신 헬퍼는 use-token-refresh 로 이동. 기존 import 경로(`./use-widget`) 사용처 보호를 위한
// **영구 하위호환 re-export** — 신규 코드는 use-token-refresh 에서 직접 import 권장.
export { refreshDelayMs, TOKEN_REFRESH_LEAD_MS, TOKEN_REFRESH_MIN_DELAY_MS } from "./use-token-refresh";

interface EmbedConfig {
  allowlist: string[];
  enforce: boolean;
}

/** 임베드 설정 조회 — 공개 GET, TransformInterceptor `{ data }` 래핑 해제. 실패 시 null(=제한 없음 취급). */
async function fetchEmbedConfig(
  apiBase: string,
  triggerEndpointPath: string,
): Promise<EmbedConfig | null> {
  try {
    const base = apiBase.replace(/\/$/, "");
    const res = await fetch(
      `${base}/api/hooks/${encodeURIComponent(triggerEndpointPath)}/embed-config`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: EmbedConfig } & Partial<EmbedConfig>;
    return (json.data ?? (json as EmbedConfig)) ?? null;
  } catch {
    return null;
  }
}

/**
 * 임베드 soft 검증(4-security §3-①) — 호스트 origin 이 워크스페이스 allowlist 에 있는지.
 * soft 컨트롤이므로 **fail-open**: 설정 조회 실패·enforce 꺼짐·호스트 origin 미탐지 시 허용한다
 * (정당한 임베드를 네트워크/환경 이유로 깨지 않는다). enforce=true 이고 호스트가 불일치할 때만 차단.
 */
async function isEmbedAllowed(
  apiBase: string,
  triggerEndpointPath: string,
  win: Window = window,
): Promise<boolean> {
  const cfg = await fetchEmbedConfig(apiBase, triggerEndpointPath);
  if (!cfg || !cfg.enforce || cfg.allowlist.length === 0) return true;
  const host = detectHostOrigin(win);
  if (!host) return true; // 호스트 origin 미탐지(직접 로드 등) → soft 허용.
  return cfg.allowlist.includes(host);
}

/** execution 종료를 알리는 SSE 이벤트명 — 도착 시 스트림·타이머·세션을 정리하고 ENDED 로 전이. */
const TERMINAL_EVENTS = [
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
] as const;

/** 위젯 내부 세션 핸들 — 저장 세션(session-store)과 동일 shape 라 PersistedSession 을 재사용. */
type SessionRef = PersistedSession;

/**
 * `seedWaitingFromStatus` 의 결과 — 호출부가 후속 `openStream`/`scheduleRefresh` 를 진행할지 판정한다.
 * `"continue"` 외에는 **반드시 중단**해야 한다(무효 토큰 SSE 재오픈·종료 세션 storage 부활·새 대화
 * 스트림 탈취 방지). boolean 이었을 때는 "정상 시드"와 "stale 폐기"가 같은 `false` 로 뭉개져
 * 호출부가 구분할 수 없었다 (ai-review 2026-07-17 02_31_18 W2).
 */
type SeedOutcome =
  /** 스냅샷이 terminal → `finalizeEnded` 로 종료 확정함. */
  | "ended"
  /** await 사이 세션이 교체·초기화됨 → 응답을 폐기함(아무 상태도 안 건드림). */
  | "stale"
  /** 정상(표면 시드 완료 또는 시드할 표면 없음, soft-fail 포함) → 호출부 진행 가능. */
  | "continue";

/**
 * 쿼리 파라미터 `apiBase` 를 **http(s) URL 로만** 허용한다(direct-load/샘플 대비 하드닝).
 * 직접 로드 경로의 `?apiBase=` 는 사용자가 URL 을 통제하지 못하는 임베드 시나리오와 달리 외부 입력이므로,
 * `javascript:`/`data:`/상대경로 등 비-http(s) 값을 fetch base 로 쓰지 않도록 스킴을 검증해 거른다.
 * (localhost 개발은 `http://` 허용 — 스킴만 제한). path/query 는 보존한다(`apiBase` 는 `/api` 등 경로 포함이 정상).
 *
 * @param raw - 쿼리 `apiBase` 원본(null 가능).
 * @returns http(s) URL 이면 원본 그대로, 아니면(null·파싱불가·비-http(s) 스킴) `undefined`(null 외에는 console.warn).
 */
export function safeApiBaseFromQuery(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return raw;
  } catch {
    /* 파싱 불가 — 아래 경고 후 무시 */
  }
  console.warn("[widget] configFromQuery: apiBase 가 http(s) URL 이 아니어서 무시합니다:", raw);
  return undefined;
}

/** boot config 를 query param 으로 폴백 해석(host 없이 직접 로드/샘플 대비). */
function configFromQuery(): Partial<BootMessage> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const apiBase = safeApiBaseFromQuery(q.get("apiBase"));
  const triggerEndpointPath = q.get("trigger") ?? undefined;
  const locale = (q.get("locale") as "ko" | "en" | null) ?? undefined;
  return { apiBase, triggerEndpointPath, locale } as Partial<BootMessage>;
}

export function useWidget() {
  const [state, dispatch] = useReducer(widgetReducer, initialState);
  const [config, setConfig] = useState<BootMessage | null>(null);

  const bridgeRef = useRef<ReturnType<typeof createIframeBridge> | null>(null);
  const clientRef = useRef<EiaClient | null>(null);
  const sessionRef = useRef<SessionRef | null>(null);
  const streamRef = useRef<EventSourceLike | null>(null);
  const configRef = useRef<BootMessage | null>(null);
  // eager 시작 가드(§R6) — 패널 open 시 execution 을 1회만 시작. 재open·중복 open 에서 재시작 방지.
  // 세션 복원/새 대화 시 재설정. true = 이미 시작(또는 진행 중).
  const startedRef = useRef(false);
  /**
   * **world 세대 토큰 — 비동기 staleness 의 단일 진실**.
   *
   * 위젯의 모든 비동기 경로(webhook POST · `getStatus` · `interact`)는 응답이 도착할 때쯤 세계가
   * 바뀌어 있을 수 있다 — 종료 이벤트·410·새 대화·대화 종료·언마운트. 그때 지연 응답으로 최신
   * 상태를 덮으면 유령 표면·오종료·스트림 탈취가 난다.
   *
   * **계약**: 세계를 무효화하는 모든 지점이 `++worldGenRef.current` 하고, 모든 `await` 뒤에는
   * `if (worldGenRef.current !== gen) return;` 로 재검증한다. 무효화 지점은 두 곳뿐이다 —
   * `teardownSession()`(종료·새 대화·대화 종료가 전부 경유하는 choke point)과 언마운트 cleanup.
   *
   * **왜 하나로 합쳤나**: 종전에는 세대 카운터(`startGenRef`, `start()` 전용) · `sessionRef` 동일성
   * (`seed`/`sendCommand`) · `cancelled` 지역 플래그(`applyConfig` 초기 부팅) **3종이 각기 다른
   * 무효화 트리거**를 갖고 공존했다. 특히 `teardownSession()` 은 `sessionRef` 를 null 하지 않아
   * **`sessionRef` 동일성으로 지킨 경로는 SSE terminal 종료를 감지하지 못했다** — 그 결과 종료된
   * 위젯이 stale seed 응답으로 `awaiting_user_message` 로 되살아나는 버그가 있었다(재현 확인).
   * `start()` 가 매번 무사했던 것도 우연이 아니라 유일하게 올바른 가드(세대)를 썼기 때문.
   * 축이 하나로 합쳐지면서 호출부는 "무엇이 바뀌었는지" 를 구분할 필요 없이 **바뀌었으면 중단**
   * 하면 된다 (ai-review 2026-07-17 06_53_03 이후 구조 검토).
   *
   * *(`endedRef` 는 여기 합치지 않는다 — 그쪽은 staleness 가 아니라 **같은 세계 안에서 두 경로가
   * 같은 종료를 중복 통지**하는 것을 막는 별개 축이다.)*
   */
  const worldGenRef = useRef(0);
  // 종료 1회 가드 — SSE terminal 이벤트와 REST 폴백 terminal 이 같은 종료에 대해 각각 발화해도
  // host `conversationEnded` 를 두 번 보내지 않는다. `resetSessionRefs`(새 대화)에서 해제.
  const endedRef = useRef(false);
  // `seedWaitingFromStatus`(아래 정의) 를 그보다 위에 있는 `handleEiaEvent` 에서 쓰기 위한 ref 홀더.
  const seedWaitingFromStatusRef = useRef<
    ((client: EiaClient, session: SessionRef) => Promise<SeedOutcome>) | null
  >(null);

  // per_execution 토큰 자동 갱신(3-auth-session §3 step7) — 타이머·재예약·cancelled 가드는 useTokenRefresh 캡슐화(§B).
  const { scheduleRefresh, clearRefreshTimer } = useTokenRefresh({ sessionRef, clientRef, configRef });

  const closeStream = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
  }, []);

  /**
   * 세션 리소스 정리 — SSE 닫기 → 갱신 타이머 정리 → 저장 세션 삭제. 순서 의존(W9):
   * closeStream 먼저(sessionRef 무효화 전 SSE 닫기) → 타이머 정리(null 된 sessionRef 쓰기 방지) → clearSession.
   * 종료 이벤트(handleEiaEvent)·newChat 공통 경로. dispatch/ref 초기화는 호출부가 맥락에 맞게 수행.
   */
  const teardownSession = useCallback(() => {
    // **world 무효화** — in-flight 비동기(start webhook·seed getStatus·sendCommand interact)의 캡처
    // gen 을 전부 stale 화한다. 종료 이벤트·410·seed-terminal·새 대화·대화 종료가 모두 이 함수를
    // 경유하므로 여기 한 곳이면 충분하다(`worldGenRef` JSDoc §계약).
    worldGenRef.current++;
    closeStream();
    clearRefreshTimer();
    if (configRef.current) clearSession(configRef.current.triggerEndpointPath);
  }, [closeStream, clearRefreshTimer]);

  /**
   * 대화 종료 확정 — 세션 정리 + `ENDED` 전이 + host 통지를 한 시퀀스로 묶는다.
   *
   * **네 진입점이 공유한다**: (1) SSE terminal 이벤트(`handleEiaEvent`) (2) `getStatus` 스냅샷이
   * 이미 terminal 인 경우(`seedWaitingFromStatus` — 버퍼 만료 gap 중 종료돼 terminal 이벤트가
   * 유실된 경로) (3) 명령의 `410 Gone`(`sendCommand`) (4) 사용자 종료(`endConversation`).
   * 각 곳에 3줄을 복제해 두면 호출부별 처리 불일치가 컴파일·테스트로 드러나지 않으므로 헬퍼로
   * 강제한다 (ai-review `02_04_13` W1 → 2026-07-17 06_53_03 W1 로 진입점 4곳 확정).
   *
   * **중복 발사 방지**: `endedRef` 로 최초 1회만 수행한다 — SSE terminal 과 REST 폴백 terminal 이
   * 버퍼 gap 타이밍에 따라 같은 종료에 대해 각각 발화할 수 있어, host `conversationEnded` 가
   * 두 번 나가는 것을 막는다 (동 리뷰 W3).
   *
   * @returns 이번 호출이 실제로 종료를 수행했으면 `true`, 이미 종료된 상태라 skip 했으면 `false`.
   */
  const finalizeEnded = useCallback(
    (reason: string): boolean => {
      if (endedRef.current) return false;
      endedRef.current = true;
      teardownSession();
      dispatch({ type: "ENDED", reason });
      bridgeRef.current?.sendEvent("conversationEnded", { reason });
      return true;
    },
    [teardownSession],
  );

  const handleEiaEvent = useCallback(
    (name: string, data: unknown) => {
      if (name === "execution.waiting_for_input") {
        // SSE wire 형태 매핑 — nodeId=waitingNodeId 등 (eia-events). submit_message 가 이 nodeId 를 보낸다.
        const { type, config, nodeId, conversationThread } = parseWaitingForInput(
          data as WaitingForInputEvent,
        );
        dispatch({
          type: "WAITING",
          interaction: { type, config, nodeId },
          threadMessages: threadToMessages(conversationThread),
        });
      } else if (name === "execution.ai_message") {
        // SSE wire 형태 매핑 — text=ev.message(not text 필드), presentations 빈 배열은 undefined (eia-events.parseAiMessage).
        const { text, presentations } = parseAiMessage(data as AiMessageEvent);
        // 텍스트 또는 presentation 중 하나라도 있으면 메시지로 추가(presentation-only 도 렌더).
        if (text || presentations) {
          dispatch({ type: "AI_MESSAGE", text, presentations });
          if (text) bridgeRef.current?.sendEvent("message", { role: "assistant", text });
        }
      } else if (name === "execution.message") {
        // 표시-전용 presentation 노드(carousel/table/chart/template)가 버튼 없이 자동 진행
        // 완료 → presentation 말풍선. text 없이 presentations 만 dispatch 해 기존 AI_MESSAGE
        // 렌더 경로(text/presentations 분리 렌더)를 재사용한다(이중 텍스트 방지).
        const { presentations } = parseMessage(data as ExecutionMessageEvent);
        if (presentations) dispatch({ type: "AI_MESSAGE", text: "", presentations });
      } else if (name === "execution.replay_unavailable") {
        // EIA 5분 버퍼 만료 — `seq > Last-Event-Id` 누락분 재전송 불가라는 서버 신호(EIA §5.2·NF-03).
        // 1-widget-app §3.1: getStatus snapshot(현재 conversationThread, EIA §5.3)으로 폴백해
        // 재동기화한다. 신호 자체는 종료가 아니므로 **기본적으로 스트림·세션은 유지**되고 이후
        // 이벤트도 정상 처리된다. **단 스냅샷이 이미 terminal 이면** — gap 안에 종료돼 terminal
        // 이벤트까지 유실된 경우 — `seedWaitingFromStatus` 가 `finalizeEnded` 로 종료를 확정한다.
        const client = clientRef.current;
        const session = sessionRef.current;
        if (client && session) void seedWaitingFromStatusRef.current?.(client, session);
        // `as readonly string[]`: TERMINAL_EVENTS 는 `as const` 리터럴 튜플이라 .includes 가 인자를
        // 리터럴 union 으로 좁혀 임의 string 인 `name` 을 거부한다 — 비교용으로 string[] 로 넓힌다.
      } else if ((TERMINAL_EVENTS as readonly string[]).includes(name)) {
        // 종료 이벤트 → 스트림·갱신 타이머·저장 세션 정리 후 ENDED 전이.
        finalizeEnded(name);
      }
    },
    [finalizeEnded],
  );

  const openStream = useCallback(
    (session: SessionRef, lastEventId?: string | number) => {
      const client = clientRef.current;
      if (!client) return;
      closeStream();
      streamRef.current = client.openStream(
        session.endpoints,
        session.token,
        {
          onEvent: handleEiaEvent,
          // SSE 연결 오류 가시화 — EventSource 는 자동 재연결하므로 흐름은 유지하되, CORS/네트워크 차단을
          // 조용히 삼키지 않도록 console.warn 으로 진단 신호를 남긴다(특히 /api/external/* CORS 미허용 시).
          onError: (e) =>
            console.warn(
              "[widget] SSE stream error — /api/external/* CORS(WEB_CHAT_WIDGET_ORIGINS)·네트워크 확인:",
              e,
            ),
        },
        lastEventId,
      );
    },
    [closeStream, handleEiaEvent],
  );

  /**
   * `getStatus` REST 응답으로 현재 `waiting_for_input` 표면을 시드하거나, 스냅샷이 이미 terminal 이면
   * 세션을 정리하고 `ENDED` 로 전이한다.
   *
   * @param client - EIA 클라이언트 (session endpoint 보유).
   * @param session - 현재 세션 (executionId, token, endpoints).
   *
   * **호출 시점**: `start()` 직후(새 실행)·`applyConfig()` 세션 복원 직후 — 두 경로 모두
   * SSE 구독 이전에 호출된다. 여기에 더해 `handleEiaEvent` 의 `execution.replay_unavailable`
   * 폴백이 **fire-and-forget** 으로 호출한다(구독 이후, 버퍼 만료 재동기화). 첫 노드 race(§R6) 또는 버퍼(5분) 만료 후 복원 시
   * SSE replay 만으로는 채울 수 없는 현재 표면을 1회 시드한다.
   *
   * **실패 정책**: soft-fail — HTTP 오류·네트워크 실패 시 `console.warn` 후 진행.
   * SSE replay 가 1차 복구 경로이므로 본 시드는 보강(best-effort).
   *
   * **파싱 재사용**: `status.context` 는 SSE `waiting_for_input` wire payload 와 동일 형식
   * (EIA §5.3) → `parseWaitingForInput` 을 그대로 재사용.
   *
   * **종료 상태 처리**: `status` 가 terminal(`completed`/`failed`/`cancelled`)이면 표면 시드 대신
   * {@link finalizeEnded} 으로 세션 정리 + `ENDED` 전이 + host 통지를 수행한다.
   *
   * @returns {@link SeedOutcome} — **`"continue"` 가 아니면 호출부는 후속 `openStream`/
   *   `scheduleRefresh` 를 반드시 건너뛴다**. `"ended"`(스냅샷이 terminal → 종료 확정)는 무효 토큰
   *   SSE 재오픈·종료 세션 storage 부활을 막고, `"stale"`(await 사이 세션 교체)은 지연 응답이 새
   *   대화의 스트림을 옛 토큰으로 탈취하는 것을 막는다.
   *   이 반환 계약이 없던 시절 `applyConfig` 복원 경로가 teardown 직후 그대로 `openStream` 하는
   *   회귀가 있었다 (ai-review `02_04_13` CRITICAL#1) — 세 호출부 모두 이 값으로 게이팅한다.
   *
   * **의존성 배열**: `dispatch` 는 `useReducer` 반환값으로 stable, `parseWaitingForInput` /
   * `threadToMessages` 는 pure import — 실 의존은 `finalizeEnded` 뿐(그 자체도 stable 콜백).
   */
  const seedWaitingFromStatus = useCallback(
    async (client: EiaClient, session: SessionRef): Promise<SeedOutcome> => {
      const gen = worldGenRef.current;
      try {
        const status = await client.getStatus(session.endpoints, session.token);
        // **staleness 가드** — 본 함수는 fire-and-forget 으로도 불린다(replay_unavailable 폴백).
        // await 사이에 세계가 바뀌었으면(종료 이벤트·410·새 대화·대화 종료·언마운트) 지연 도착한
        // 옛 응답으로 유령 WAITING 을 그리거나 살아있는 새 대화를 종료 통지해선 안 된다.
        //
        // 종전 `sessionRef.current !== session` 동일성 검사는 **불충분했다** — `teardownSession()` 이
        // `sessionRef` 를 null 하지 않으므로 SSE terminal 종료 후에도 이 검사를 통과해, 종료된 위젯이
        // stale 응답으로 `awaiting_user_message` 로 부활했다(재현 확인). 세대 검사는 종료·교체를
        // 구분 없이 전부 잡는다 (`worldGenRef` JSDoc 참조).
        if (worldGenRef.current !== gen) return "stale";
        // 이미 종료된 execution — 정리 후 ENDED 로 전이한다. **버퍼 만료(§replay_unavailable) 경로에서
        // 특히 중요**: 5분 gap 안에 execution 이 종료됐다면 그 terminal SSE 이벤트도 버퍼에서 함께
        // 유실돼 다시 오지 않는다(서버는 신호 후 연결만 유지·재전송 안 함 — EIA R-replay-unavailable).
        // 이 분기가 없으면 위젯이 `streaming`("AI 응답 중" 스피너)에 무기한 멈춘다 — 사용자 액션이
        // 없는 구간이라 `sendCommand` 의 410 사후 복구 경로도 닿지 않는다.
        if ((TERMINAL_EVENTS as readonly string[]).includes(`execution.${status.status}`)) {
          finalizeEnded(`execution.${status.status}`);
          return "ended"; // 호출부는 이 값으로 후속 openStream/scheduleRefresh 를 건너뛴다.
        }
        if (status.status === "waiting_for_input" && status.context) {
          // WaitingContext 는 WaitingForInputEvent 에 assignable(REST context = SSE wire 동일형식,
          // EIA §5.3) — `as` 캐스트 불필요.
          const parsed = parseWaitingForInput(status.context);
          dispatch({
            type: "WAITING",
            interaction: {
              type: parsed.type,
              config: parsed.config,
              nodeId: parsed.nodeId,
            },
            threadMessages: threadToMessages(parsed.conversationThread),
          });
        }
        return "continue";
      } catch (err) {
        console.warn(
          "[widget] getStatus seed failed:",
          err instanceof Error ? err.message : String(err),
        );
        return "continue"; // soft-fail — 종료로 오판하지 않는다(호출부는 정상 흐름 계속).
      }
    },
    [finalizeEnded],
  );

  // `handleEiaEvent`(위)가 `execution.replay_unavailable` 폴백에서 이 콜백을 쓰지만 정의는 아래라
  // 선언 순서상 TDZ — ref 로 노출해 재정렬 없이 참조한다.
  // 갱신은 render 중이 아니라 effect 에서(매 렌더) — 위 `apiRef` 와 동일 컨벤션. handleEiaEvent 는
  // SSE 이벤트(= effect 로 연 스트림) 로만 불리므로 최초 effect 이전에 호출될 일이 없다.
  useEffect(() => {
    seedWaitingFromStatusRef.current = seedWaitingFromStatus;
  });

  const persist = useCallback((cfg: BootMessage, res: HookStartResponse) => {
    if (!res.interaction) return null;
    const session: SessionRef = {
      executionId: res.executionId,
      token: res.interaction.token,
      expiresAt: res.interaction.expiresAt,
      endpoints: res.interaction.endpoints,
    };
    sessionRef.current = session;
    saveSession(cfg.triggerEndpointPath, session);
    return session;
  }, []);

  /**
   * 워크플로우 시작 — 패널 open 시(eager, §R6). firstMessage 미동봉(profile 만).
   * 1회만 실행(startedRef 가드) — 재open·중복 호출 시 no-op. 첫 노드가 AI/캐러셀/폼 무엇이든
   * 첫 `waiting_for_input` 으로 표면을 렌더한다. 첫 사용자 텍스트는 일반 submit_message 로 보낸다.
   *
   * W10 구조 주의: `startedRef.current = true` 는 첫 await 이전에 세팅된다. 향후 start() 내부에
   * 추가 async 코드를 삽입할 때도 이 플래그를 첫 await 이전에 유지해야 중복 실행 경쟁 조건이 방지된다.
   */
  const start = useCallback(async () => {
    const cfg = configRef.current;
    const client = clientRef.current;
    if (!cfg || !client) return;
    if (startedRef.current || sessionRef.current) return; // 이미 시작/복원됨 → 중복 시작 방지.
    startedRef.current = true;
    // 이 start 의 세대 캡처 — await 사이에 세계가 바뀌면(teardown·언마운트) gen 이 달라져 무효화된다.
    // `++` 인 이유: start 는 세계를 **교체**하므로(옛 execution 을 새것으로) 진행 중인 다른 비동기도
    // 함께 무효화해야 한다. 그 뒤 자기 gen 을 캡처한다.
    const gen = ++worldGenRef.current;
    dispatch({ type: "START" });
    try {
      const res = await client.startConversation(cfg.triggerEndpointPath, {
        profile: cfg.profile,
      });
      // webhook POST 왕복 중 종료/새 대화로 이 start 가 대체됐으면 여기서 중단 —
      // 옛 execution 을 persist/openStream 으로 되살리지 않는다(booting-중-종료 race).
      if (worldGenRef.current !== gen) return;
      dispatch({ type: "BOOTED", executionId: res.executionId });
      bridgeRef.current?.sendEvent("conversationStarted", { executionId: res.executionId });
      const session = persist(cfg, res);
      if (session) {
        // race(§R6) 보정 — 첫 waiting 이벤트가 SSE 구독 전 emit 되어도:
        // (1) getStatus 로 현재 표면을 시드하고, (2) openStream 을 lastEventId="0" 으로 열어
        // buffer 의 누락 이벤트(seq≥1)를 replay 받는다.
        // 스냅샷이 이미 terminal 이면 seed 가 대화를 종료시킨다 — SSE 를 열지 않는다.
        // `"ended"`(종료 확정)·`"stale"`(세계 교체) 둘 다 중단.
        //
        // **아래 gen 검사와 중복이 아니다**: 대개는 `"ended"` 도 `teardownSession()` 이 gen 을 올려
        // 아래 검사가 잡지만, **이미 종료된 상태**(`endedRef=true`)에서는 `finalizeEnded` 가 dedup 으로
        // 조기 return 해 teardown·gen 증가를 **건너뛴다** → 그 경우 gen 검사만으로는 못 잡는다.
        // 두 검사는 축이 다르다 — outcome=`무엇이 일어났나`, gen=`세계가 바뀌었나`.
        const outcome = await seedWaitingFromStatus(client, session);
        if (outcome !== "continue") return;
        // seed await 사이 세계가 바뀌었으면 SSE 를 열지 않는다(streaming-초기 종료 race).
        if (worldGenRef.current !== gen) return;
        openStream(session, "0");
        scheduleRefresh(); // 토큰 자동 갱신 예약(§3 step7).
      }
    } catch (e) {
      // 이 start 가 teardown(새 대화/종료)으로 대체됐으면 옛 실패로 최신 상태를 덮지 않는다 —
      // try 블록의 두 gen 검사(BOOTED 직전·openStream 직전)와 대칭. 미검사 시 stale 실패가
      // startedRef 를 재개방(중복 execution)하거나 진행 중 새 대화 phase 를 옛 에러로 덮을 수 있다.
      if (worldGenRef.current !== gen) return;
      startedRef.current = false; // 실패 → 재시도(재open/새 대화) 허용.
      dispatch({ type: "ERROR", message: errMessage(e) });
    }
  }, [openStream, persist, seedWaitingFromStatus, scheduleRefresh]);

  const sendCommand = useCallback(
    async (command: InteractCommand) => {
      const session = sessionRef.current;
      const client = clientRef.current;
      if (!session || !client) return;
      const gen = worldGenRef.current;
      try {
        await client.interact(session.endpoints, session.token, command);
      } catch (e) {
        // **staleness 가드** — 이 명령이 뜬 사이 세계가 바뀌었으면(종료·새 대화·대화 종료·언마운트)
        // 옛 세션의 지연 도착 실패로 **살아있는 새 세션을 종료(410)시키거나 에러를 띄우면 안 된다**
        // (cross-session 오종료 — ai-review 2026-07-17 06_53_03 CRITICAL#1).
        if (worldGenRef.current !== gen) return;
        if (e instanceof EiaError && e.status === 410) {
          // 410 Gone(대화 종료됨)도 host 에 종료 통지 — SSE terminal·user_ended 와 동일하게
          // conversationEnded 를 발사해 모든 종료 경로의 host 통지를 일관되게 한다(2-sdk §3 wc:event).
          // `finalizeEnded` 경유 — SSE terminal 로 이미 종료된 뒤 in-flight 명령이 410 을 받으면
          // host 가 같은 종료를 2회 통지받으므로 `endedRef` 1회 가드를 공유한다.
          finalizeEnded("gone");
        } else {
          dispatch({ type: "ERROR", message: errMessage(e) });
        }
      }
    },
    [finalizeEnded],
  );

  // C1(§R6) 보류 메시지 큐 — booting/streaming 중 텍스트를 보관했다가 awaiting_user_message 진입 시 flush.
  // 큐·flush effect·buttons/form 폐기는 usePendingMessageQueue 캡슐화(§B).
  const { enqueue, clearQueue } = usePendingMessageQueue({
    phase: state.phase,
    pending: state.pending,
    sessionRef,
    sendCommand,
    dispatch,
  });

  const submitMessage = useCallback(
    (text: string) => {
      // eager 시작(§R6) — execution 은 open 시 이미 시작됨. 첫 메시지도 일반 submit_message.
      // 세션 준비 + awaiting_user_message + ai_conversation 표면이면 즉시 전송.
      // 아직 booting/streaming 중이면(런처 버블·패널 suggestions 탭 race) 큐에 보관 — flush effect 가 처리(C1).
      if (
        sessionRef.current &&
        state.phase === "awaiting_user_message" &&
        isTextInputSurface(state.pending)
      ) {
        dispatch({ type: "USER_MESSAGE", text });
        void sendCommand({ command: "submit_message", nodeId: state.pending?.nodeId, message: text });
      } else {
        // 큐(최신 1건) — booting/streaming 중 도착한 텍스트. flush effect 가 ai_conversation waiting 시 전송.
        enqueue(text);
      }
    },
    [sendCommand, state.phase, state.pending, enqueue],
  );

  const clickButton = useCallback(
    (buttonId: string) => {
      void sendCommand({ command: "click_button", nodeId: state.pending?.nodeId, buttonId });
    },
    [sendCommand, state.pending?.nodeId],
  );

  const submitForm = useCallback(
    (data: Record<string, unknown>) => {
      void sendCommand({ command: "submit_form", nodeId: state.pending?.nodeId, data });
    },
    [sendCommand, state.pending?.nodeId],
  );

  /**
   * 패널 open. **네트워크 부작용 주의(W3)**: eager 시작(§R6)이라 open 시 `start()` 가
   * webhook `POST /api/hooks/:path` 를 발행해 execution 을 시작한다(중복/세션복원은 start 가드).
   */
  const open = useCallback(() => {
    dispatch({ type: "OPEN" });
    bridgeRef.current?.sendEvent("open");
    void start();
  }, [start]);
  const close = useCallback(() => {
    dispatch({ type: "CLOSE" });
    bridgeRef.current?.sendEvent("close");
  }, []);
  /**
   * 세션 ref·큐·타이머·SSE·저장세션 공통 정리 — newChat·endConversation 공용.
   * 순서 의존(W9)은 teardownSession 내부: closeStream → 타이머 정리 → clearSession(+ start gen 증가).
   * 이후 sessionRef null → startedRef false(start 재진입 허용) → 큐 비움(이전 대화 텍스트 누수 차단, I1).
   * dispatch/start 등 맥락별 후속은 호출부가 수행한다.
   */
  const resetSessionRefs = useCallback(() => {
    teardownSession();
    sessionRef.current = null;
    startedRef.current = false;
    endedRef.current = false; // 새 대화는 다시 종료될 수 있다 — finalizeEnded 1회 가드 해제.
    clearQueue();
  }, [teardownSession, clearQueue]);
  /**
   * 새 대화(§R9) — 기존 세션/스트림 정리 후 새 execution 을 eager 시작(§R6).
   *
   * **A. single-flight coalesce**: `booting`(webhook POST in-flight·세션 미확립) 중 호출(주로 host
   * `resetSession`)은 in-flight `start()` 에 **흡수**한다 — **조기 `return` 이 `resetSessionRefs()` 호출을
   * 건너뜀**으로써, 그것이 `startedRef` 가드를 재개방해 2번째 `start()`/POST 를 발사하는 것을 막는다(중복
   * webhook·첫 노드 부작용 2회 제거). booting 은 대화 미확립이라 흡수된 booting 세션이 곧 새 세션이다. 단
   * "새 대화" 의도상 **이전 대기 큐만은 비운다**(`clearQueue`) — 흡수 세션의 첫 `awaiting_user_message`
   * 로 직전 텍스트가 누수되는 것을 차단한다(I1 불변식 유지). 판정 = `startedRef.current && !sessionRef.current`
   * (start 시작·persist 전 — refs 라 stale closure 무관; 현재 `WidgetPhase==='booting'` 과 동치이며
   * R9-A 테스트가 booting phase 를 고정 검증한다 — phase 전이 추가/변경 시 이 동치를 재확인).
   *
   * **B-1. 확립 세션발 cancel**: 확립 세션(streaming/awaiting — `sessionRef.current` 존재)발이면 새 start
   * 전에 이전 execution 을 **best-effort 범용 `cancel`**(폐기이므로 graceful `end_conversation` 아님)로
   * 종료해 서버 orphan 을 근원 제거한다. session/client 는 resetSessionRefs(SSE 선차단·gen 증가·session
   * null) **이전에 캡처**하고, cancel 은 optimistic — 실패해도 로컬 재시작을 되돌리지 않는다(§R9-B-1).
   */
  const newChat = useCallback(() => {
    // A. booting 중 = coalesce(in-flight start 에 흡수). resetSessionRefs 는 건너뛰되(start 가드 재개방·
    //    in-flight 세션 파괴 방지), 이전 대기 큐는 비워 흡수 세션 텍스트 누수를 차단(I1, side_effect W1).
    if (startedRef.current && !sessionRef.current) {
      clearQueue();
      return;
    }
    // B-1. 확립 세션발이면 이전 execution 을 best-effort cancel — 정리 이전에 대상 세션/클라이언트 캡처.
    const prevSession = sessionRef.current;
    const client = clientRef.current;
    resetSessionRefs();
    dispatch({ type: "NEW_CHAT" });
    if (prevSession && client) {
      void client
        .interact(prevSession.endpoints, prevSession.token, { command: "cancel", reason: "user_new_chat" })
        .catch((e) =>
          console.warn(
            "[widget] newChat cancel 명령 실패(로컬 재시작 진행):",
            e instanceof Error ? e.message : String(e),
          ),
        );
    }
    void start();
  }, [resetSessionRefs, start, clearQueue]);
  /**
   * 대화 종료(§3.1) — 헤더 "대화 종료" 컨트롤. UI 상 대화가 확립된(streaming/awaiting) 뒤에만 노출되므로
   * 호출 시 세션·토큰이 존재한다(§2 헤더 게이팅). 대기 중 AI 대화(`awaiting_user_message` + `ai_conversation`,
   * **waiting nodeId 확정 시**)면 graceful `end_conversation`(워크플로우가 이어서 완료), 그 외(응답 대기
   * streaming, `buttons`/`form` 대기, 또는 ai_conversation 이라도 nodeId 미확정)면 범용 `cancel` 로 종료한다.
   *
   * **종료 순서**: SSE 를 **먼저** 닫고(resetSessionRefs) optimistic `[ended]` 로 전이한 뒤 종료 명령을
   * best-effort 로 발사한다 — 명령이 유발하는 terminal SSE 이벤트가 handleEiaEvent 로 **중복 종료
   * (conversationEnded 2회 발사)** 를 일으키지 않도록 스트림을 선차단한다. 명령 성패와 무관하게 로컬은
   * 이미 종료 상태이며(토큰은 종료 시 invalidate) 명령 실패(410/네트워크)는 진단만 남긴다. 이미
   * `[ended]`(예: SSE terminal 선도달) 면 no-op. (session 부재 방어: 프로그램적으로 booting 중 호출돼
   * 세션이 아직 없으면 명령을 건너뛰고 로컬만 종료 — TTL 정리.)
   */
  const endConversation = useCallback(async () => {
    // 이미 종료됨 → 중복 dispatch/sendEvent 방지. **`endedRef` 를 먼저 본다** — 아래
    // `resetSessionRefs()` 가 `endedRef` 를 false 로 되돌리므로, 그 뒤의 `finalizeEnded` 1회 가드는
    // 이 경로에서 무력하다. `state.phase` 는 React 배치로 커밋이 지연될 수 있어(SSE terminal 직후
    // stale 클로저 클릭) ref 가 더 즉각적인 진실이다 (ai-review 2026-07-17 06_53_03 W2).
    if (endedRef.current || state.phase === "ended") return;
    const reason = "user_ended";
    // 명령 라우팅·대상 정보는 정리 이전 상태/세션으로 확정.
    const session = sessionRef.current;
    const client = clientRef.current;
    const graceful =
      state.phase === "awaiting_user_message" &&
      state.pending?.type === "ai_conversation" &&
      !!state.pending?.nodeId;
    const command: InteractCommand = graceful
      ? { command: "end_conversation", nodeId: state.pending?.nodeId, reason }
      : { command: "cancel", reason };
    // SSE 선차단 + optimistic 종료(중복 종료 이벤트 경합 제거).
    // `finalizeEnded` 경유 — 종료 시퀀스(dispatch+host 통지)와 `endedRef` 1회 가드를 SSE terminal·
    // REST 폴백 terminal·410 경로와 공유한다. 직접 dispatch 하면 `resetSessionRefs()` 가 방금
    // `endedRef` 를 false 로 되돌린 상태로 남아, `state.phase==="ended"` 인데 `endedRef===false` 인
    // 불변식 불일치가 생긴다 (ai-review 2026-07-17 02_31_18 W4).
    resetSessionRefs();
    finalizeEnded(reason);
    // best-effort 백엔드 종료 — 실패해도 로컬은 이미 종료.
    if (session && client) {
      try {
        await client.interact(session.endpoints, session.token, command);
      } catch (e) {
        console.warn(
          "[widget] endConversation 명령 실패(로컬 종료 진행):",
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }, [state.phase, state.pending, resetSessionRefs, finalizeEnded]);
  // 위젯(런처) 가시성 — open/close 와 직교한 축(§3.2). hide 해도 대화·SSE 유지.
  const show = useCallback(() => dispatch({ type: "SHOW" }), []);
  const hide = useCallback(() => dispatch({ type: "HIDE" }), []);
  // host(loader/미리보기)가 iframe 박스를 위젯 상태(collapsed↔expanded)에 맞춰 조절하도록 알린다
  // (2-sdk §3 필수). 박스 크기 산정은 호출부(widget-app)가 위젯 레이아웃 상수로 결정한다.
  const sendResize = useCallback((payload: WcResizePayload) => {
    bridgeRef.current?.sendResize(payload);
  }, []);
  // 진행 중 execution 의 기전송 profile 은 소급 변경 불가(webhook payload 는 시작 1회) — boot profile 에
  // merge 해 **다음 시작(패널 open/새 대화)** payload 에만 반영(§3.2 / 2-sdk §5 updateProfile).
  const updateProfile = useCallback((profile: Record<string, unknown>) => {
    const cfg = configRef.current;
    if (!cfg) return;
    const merged: BootMessage = { ...cfg, profile: { ...(cfg.profile ?? {}), ...profile } };
    configRef.current = merged;
    setConfig(merged);
  }, []);

  // host 명령은 1회 등록 핸들러에서 최신 함수를 참조해야 함(stale closure 회피).
  // ref 갱신은 render 중이 아니라 effect 에서(매 렌더).
  const apiRef = useRef({ open, close, submitMessage, closeStream, show, hide, updateProfile, newChat });
  useEffect(() => {
    apiRef.current = { open, close, submitMessage, closeStream, show, hide, updateProfile, newChat };
  });

  // 마운트: bridge + config + 세션 복원.
  useEffect(() => {
    const applyConfig = async (cfg: BootMessage) => {
      if (!cfg.apiBase || !cfg.triggerEndpointPath) return;
      // 세계 세대 캡처 — 아래 두 await(임베드 검증·seed) 뒤 재검증한다. 종전 `cancelled` 지역
      // 플래그는 이 첫 await 만 덮고 seed/openStream 이후는 무방비였다(`worldGenRef` JSDoc §계약).
      const gen = worldGenRef.current;
      // 임베드 soft 검증(4-security §3-①) — 렌더/시작 전에 호스트 origin 허용 여부 확인.
      const allowed = await isEmbedAllowed(cfg.apiBase, cfg.triggerEndpointPath);
      if (worldGenRef.current !== gen) return;
      if (!allowed) {
        dispatch({ type: "BLOCKED", reason: "origin_not_allowed" });
        return;
      }
      configRef.current = cfg;
      setConfig(cfg);
      clientRef.current = new EiaClient({ apiBase: cfg.apiBase });
      // 새로고침 복원(N1): 저장 세션이 살아있으면 SSE 재연결.
      const saved = loadSession(cfg.triggerEndpointPath);
      if (saved) {
        sessionRef.current = saved;
        startedRef.current = true; // 복원된 세션 — open 시 새 execution 시작 금지(§R6 재open 복원).
        dispatch({ type: "RESTORED", executionId: saved.executionId });
        // 복원 시에도 현재 표면을 getStatus 로 시드 + SSE replay(lastEventId="0")로 누락분 보정.
        // **복원 대상이 이미 종료된 세션이면 seed 가 대화를 종료시킨다** — 그 경우 SSE 재오픈·토큰
        // 갱신 예약을 하면 (a) 무효화된 토큰으로 스트림을 열고 (b) refreshToken 성공 시 방금
        // clearSession() 한 storage 를 종료된 세션으로 되살린다. 반환값으로 게이팅한다
        // (ai-review `02_04_13` CRITICAL#1 — `start()` 는 세대 가드로 우연히 보호됐으나 이 경로는 무방비였다.)
        if (clientRef.current) {
          const outcome = await seedWaitingFromStatus(clientRef.current, saved);
          // "stale" = await 사이 host 가 새 대화를 시작해 세션이 교체됨 — 지연 응답이 새 대화의
          // SSE 스트림을 옛 토큰으로 덮어쓰지 않도록 중단한다(`start()` 의 세대 재검증과 대칭).
          if (outcome !== "continue") return;
        }
        openStream(saved, "0");
        scheduleRefresh(); // 복원된 세션도 갱신 예약.
      }
    };

    const bridge = createIframeBridge();
    bridgeRef.current = bridge;
    bridge.onBoot((c) => {
      void applyConfig({ ...configFromQuery(), ...c } as BootMessage);
    });
    bridge.onCommand((cmd) => {
      switch (cmd.action) {
        case "open":
          apiRef.current.open();
          break;
        case "close":
          apiRef.current.close();
          break;
        case "sendMessage":
          if (typeof cmd.text === "string") apiRef.current.submitMessage(cmd.text);
          break;
        case "shutdown":
          apiRef.current.closeStream();
          break;
        case "show":
          apiRef.current.show();
          break;
        case "hide":
          apiRef.current.hide();
          break;
        case "updateProfile":
          if (cmd.profile && typeof cmd.profile === "object")
            apiRef.current.updateProfile(cmd.profile as Record<string, unknown>);
          break;
        case "resetSession":
          // 라이브 미리보기 등 host 가 대화를 처음부터 다시 시작 — closeStream→clearSession→start.
          apiRef.current.newChat();
          break;
      }
    });

    // host 없이 직접 로드(샘플/개발): query param 만으로도 부팅 시도.
    const fallback = configFromQuery();
    if (fallback.apiBase && fallback.triggerEndpointPath) {
      void applyConfig(fallback as BootMessage);
    }

    return () => {
      // **world 무효화** — 언마운트도 세계 교체의 일종이다. 이게 없으면 in-flight `getStatus`/
      // `interact` 가 언마운트 뒤 resolve 해 `openStream` 으로 **새 EventSource 를 열고**, 그 뒤엔
      // 어떤 cleanup 도 다시 돌지 않아 SSE 가 leak 된다(ai-review 2026-07-17 06_53_03 W6 —
      // 종전엔 `cancelled` 지역 플래그가 초기 부팅만 덮고 seed/openStream 이후는 무방비였다).
      //
      // eslint 의 "ref value will likely have changed" 경고는 **DOM node ref 전제**의 휴리스틱이라
      // 여기선 오탐이다 — 이 ref 는 DOM 이 아니라 세대 카운터이고, cleanup 이 하려는 일이 바로
      // "그 시점의 최신 값을 증가시켜 in-flight 를 무효화" 하는 것이다. 값을 effect 안 변수로
      // 복사하면(경고가 제안하는 바) 마운트 시점의 stale 값을 증가시켜 의미가 깨진다.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      worldGenRef.current++;
      // 갱신 타이머 정리는 useTokenRefresh 자체 unmount cleanup 이 단일 소유(이중 호출 제거).
      closeStream();
      bridge.destroy();
    };
    // 마운트 1회. 핸들러는 ref 기반이라 deps 생략.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    config,
    // I3: start 는 open() 이 자동 호출 — 외부 직접 호출 불필요. 하위 호환 목적으로 노출 유지.
    actions: { open, close, start, submitMessage, clickButton, submitForm, newChat, endConversation, show, hide, updateProfile, sendResize },
  };
}

/** 에러 발생 시 `state.error` 에 저장하는 **내부 ko 기준 신호**(진단·테스트 기준값). 실제 사용자 표시 문구는 이 상수가
 * 아니라 `panel` 이 catalog `error.generic` 을 `t()` 로 **로케일 렌더**한다(§4) — 렌더되는 에러는 항상 이 generic 이다
 * (ERROR→[ended]; BLOCKED 코드는 blocked phase 라 미렌더). 임베드 위젯은 타 사이트에서 동작하므로 서버/예외 원문을 UI 에
 * 흘리지 않고(4-security §5) 진단 원문은 console 로만 남긴다. 에러 → [ended] + "새 대화 시작" 안내(1-widget-app §3.1) 동작은
 * 유지한다. 값은 catalog 를 SoT 로 삼아 문구 중복/드리프트를 막는다. */
const GENERIC_ERROR_MESSAGE = WIDGET_STRINGS.ko["error.generic"];

function errMessage(e: unknown): string {
  // 진단 원문은 console 에만(운영 추적) — UI 비노출.
  console.warn("[widget] conversation error:", e instanceof Error ? e.message : String(e));
  return GENERIC_ERROR_MESSAGE;
}
