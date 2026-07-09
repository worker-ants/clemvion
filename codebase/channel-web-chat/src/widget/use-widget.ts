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
  // start() 세대 토큰 — teardown(새 대화/대화 종료/종료 이벤트)이 in-flight start() 를 무효화한다.
  // start() 는 webhook POST await 후 자기 gen 이 여전히 최신일 때만 persist/openStream 을 진행한다 →
  // booting/초기 streaming 중 종료·새 대화가 옛 execution 을 되살리는 race 차단(teardown 이 gen 증가).
  const startGenRef = useRef(0);

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
    // gen 증가 → in-flight start() 의 캡처 gen 을 stale 화해 persist/openStream 을 스킵시킨다.
    startGenRef.current++;
    closeStream();
    clearRefreshTimer();
    if (configRef.current) clearSession(configRef.current.triggerEndpointPath);
  }, [closeStream, clearRefreshTimer]);

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
        // `as readonly string[]`: TERMINAL_EVENTS 는 `as const` 리터럴 튜플이라 .includes 가 인자를
        // 리터럴 union 으로 좁혀 임의 string 인 `name` 을 거부한다 — 비교용으로 string[] 로 넓힌다.
      } else if ((TERMINAL_EVENTS as readonly string[]).includes(name)) {
        // 종료 이벤트 → 스트림·갱신 타이머·저장 세션 정리 후 ENDED 전이.
        teardownSession();
        dispatch({ type: "ENDED", reason: name });
        bridgeRef.current?.sendEvent("conversationEnded", { reason: name });
      }
    },
    [teardownSession],
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
   * `getStatus` REST 응답으로 현재 `waiting_for_input` 표면을 시드한다.
   *
   * @param client - EIA 클라이언트 (session endpoint 보유).
   * @param session - 현재 세션 (executionId, token, endpoints).
   *
   * **호출 시점**: `start()` 직후(새 실행) 및 `applyConfig()` 세션 복원 직후 — 두 경로 모두
   * SSE 구독 이전에 호출된다. 첫 노드 race(§R6) 또는 버퍼(5분) 만료 후 복원 시
   * SSE replay 만으로는 채울 수 없는 현재 표면을 1회 시드한다.
   *
   * **실패 정책**: soft-fail — HTTP 오류·네트워크 실패 시 `console.warn` 후 진행.
   * SSE replay 가 1차 복구 경로이므로 본 시드는 보강(best-effort).
   *
   * **파싱 재사용**: `status.context` 는 SSE `waiting_for_input` wire payload 와 동일 형식
   * (EIA §5.3) → `parseWaitingForInput` 을 그대로 재사용.
   *
   * **의존성 배열 `[]`**: `dispatch` 는 `useReducer` 반환값으로 stable, `parseWaitingForInput` /
   * `threadToMessages` 는 pure import — 클로저 캡처 없이 안전하게 빈 배열.
   */
  const seedWaitingFromStatus = useCallback(
    async (client: EiaClient, session: SessionRef) => {
      try {
        const status = await client.getStatus(session.endpoints, session.token);
        if (status.status === "waiting_for_input" && status.context) {
          const parsed = parseWaitingForInput(
            status.context as WaitingForInputEvent,
          );
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
      } catch (err) {
        console.warn(
          "[widget] getStatus seed failed:",
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    [],
  );

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
    // 이 start 의 세대 캡처 — await 사이에 teardown(새 대화/대화 종료)이 발생하면 gen 이 달라져 무효화된다.
    const gen = ++startGenRef.current;
    dispatch({ type: "START" });
    try {
      const res = await client.startConversation(cfg.triggerEndpointPath, {
        profile: cfg.profile,
      });
      // webhook POST 왕복 중 종료/새 대화로 이 start 가 대체됐으면 여기서 중단 —
      // 옛 execution 을 persist/openStream 으로 되살리지 않는다(booting-중-종료 race).
      if (startGenRef.current !== gen) return;
      dispatch({ type: "BOOTED", executionId: res.executionId });
      bridgeRef.current?.sendEvent("conversationStarted", { executionId: res.executionId });
      const session = persist(cfg, res);
      if (session) {
        // race(§R6) 보정 — 첫 waiting 이벤트가 SSE 구독 전 emit 되어도:
        // (1) getStatus 로 현재 표면을 시드하고, (2) openStream 을 lastEventId="0" 으로 열어
        // buffer 의 누락 이벤트(seq≥1)를 replay 받는다.
        await seedWaitingFromStatus(client, session);
        // seed await 사이 종료/새 대화로 대체됐으면 SSE 를 열지 않는다(streaming-초기 종료 race).
        if (startGenRef.current !== gen) return;
        openStream(session, "0");
        scheduleRefresh(); // 토큰 자동 갱신 예약(§3 step7).
      }
    } catch (e) {
      startedRef.current = false; // 실패 → 재시도(재open/새 대화) 허용.
      dispatch({ type: "ERROR", message: errMessage(e) });
    }
  }, [openStream, persist, seedWaitingFromStatus, scheduleRefresh]);

  const sendCommand = useCallback(
    async (command: InteractCommand) => {
      const session = sessionRef.current;
      const client = clientRef.current;
      if (!session || !client) return;
      try {
        await client.interact(session.endpoints, session.token, command);
      } catch (e) {
        if (e instanceof EiaError && e.status === 410) {
          if (configRef.current) clearSession(configRef.current.triggerEndpointPath);
          dispatch({ type: "ENDED", reason: "gone" });
        } else {
          dispatch({ type: "ERROR", message: errMessage(e) });
        }
      }
    },
    [],
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
    clearQueue();
  }, [teardownSession, clearQueue]);
  /** 새 대화 — 기존 세션/스트림 정리 후 새 execution 을 eager 시작(§R6). */
  const newChat = useCallback(() => {
    resetSessionRefs();
    dispatch({ type: "NEW_CHAT" });
    void start();
  }, [resetSessionRefs, start]);
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
    if (state.phase === "ended") return; // 이미 종료됨 → 중복 dispatch/sendEvent 방지.
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
    resetSessionRefs();
    dispatch({ type: "ENDED", reason });
    bridgeRef.current?.sendEvent("conversationEnded", { reason });
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
  }, [state.phase, state.pending, resetSessionRefs]);
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
    let cancelled = false;

    const applyConfig = async (cfg: BootMessage) => {
      if (!cfg.apiBase || !cfg.triggerEndpointPath) return;
      // 임베드 soft 검증(4-security §3-①) — 렌더/시작 전에 호스트 origin 허용 여부 확인.
      const allowed = await isEmbedAllowed(cfg.apiBase, cfg.triggerEndpointPath);
      if (cancelled) return;
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
        if (clientRef.current) await seedWaitingFromStatus(clientRef.current, saved);
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
      cancelled = true;
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

/** 사용자 노출용 일반화 에러 문구(W1·4-security §5). 임베드 위젯은 타 사이트에서 동작하므로 서버/예외 원문을
 * UI 에 직접 흘리지 않고(내부 구현·인프라 정보 노출 축소) 진단 원문은 console 로만 남긴다. 에러 → [ended] +
 * "새 대화 시작" 안내라는 기존 동작(1-widget-app §3.1)은 그대로 유지하고, 표시 문구만 일반화한다. */
const GENERIC_ERROR_MESSAGE =
  "일시적인 오류로 대화를 진행할 수 없어요. 잠시 후 새 대화로 다시 시도해 주세요.";

function errMessage(e: unknown): string {
  // 진단 원문은 console 에만(운영 추적) — UI 비노출.
  console.warn("[widget] conversation error:", e instanceof Error ? e.message : String(e));
  return GENERIC_ERROR_MESSAGE;
}
