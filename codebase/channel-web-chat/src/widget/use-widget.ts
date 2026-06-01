"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { EiaClient, EiaError, type EventSourceLike } from "@/lib/eia-client";
import type {
  AiMessageEvent,
  ExternalInteractionType,
  HookStartResponse,
  InteractCommand,
  InteractionEndpoints,
  WaitingForInputEvent,
} from "@/lib/eia-types";
import { threadToMessages } from "@/lib/conversation";
import { clearSession, loadSession, saveSession } from "@/lib/session-store";
import { initialState, widgetReducer } from "@/lib/widget-state";
import { createIframeBridge, detectHostOrigin, type BootMessage } from "./host-bridge";

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

interface SessionRef {
  executionId: string;
  token: string;
  expiresAt: string;
  endpoints: InteractionEndpoints;
}

/** boot config 를 query param 으로 폴백 해석(host 없이 직접 로드/샘플 대비). */
function configFromQuery(): Partial<BootMessage> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const apiBase = q.get("apiBase") ?? undefined;
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

  const closeStream = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
  }, []);

  const handleEiaEvent = useCallback(
    (name: string, data: unknown) => {
      if (name === "execution.waiting_for_input") {
        const ev = data as WaitingForInputEvent;
        const type = (ev.node?.interactionType ?? "ai_conversation") as ExternalInteractionType;
        const cfg =
          ev.context?.formConfig ?? ev.context?.buttonConfig ?? ev.context?.conversationConfig;
        dispatch({
          type: "WAITING",
          interaction: { type, config: cfg, nodeId: ev.node?.id },
          threadMessages: threadToMessages(ev.context?.conversationThread),
        });
      } else if (name === "execution.ai_message") {
        const ev = data as AiMessageEvent;
        const presentations =
          Array.isArray(ev.presentations) && ev.presentations.length
            ? ev.presentations
            : undefined;
        // 텍스트 또는 presentation 중 하나라도 있으면 메시지로 추가(presentation-only 도 렌더).
        if (ev.text || presentations) {
          dispatch({ type: "AI_MESSAGE", text: ev.text ?? "", presentations });
          if (ev.text)
            bridgeRef.current?.sendEvent("message", { role: "assistant", text: ev.text });
        }
      } else if (
        name === "execution.completed" ||
        name === "execution.failed" ||
        name === "execution.cancelled"
      ) {
        closeStream();
        if (configRef.current) clearSession(configRef.current.triggerEndpointPath);
        dispatch({ type: "ENDED", reason: name });
        bridgeRef.current?.sendEvent("conversationEnded", { reason: name });
      }
    },
    [closeStream],
  );

  const openStream = useCallback(
    (session: SessionRef, lastEventId?: string | number) => {
      const client = clientRef.current;
      if (!client) return;
      closeStream();
      streamRef.current = client.openStream(
        session.endpoints,
        session.token,
        { onEvent: handleEiaEvent },
        lastEventId,
      );
    },
    [closeStream, handleEiaEvent],
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

  /** 첫 사용자 입력 → 워크플로우 시작. */
  const start = useCallback(
    async (firstMessage: string) => {
      const cfg = configRef.current;
      const client = clientRef.current;
      if (!cfg || !client) return;
      dispatch({ type: "START", userText: firstMessage });
      try {
        const res = await client.startConversation(cfg.triggerEndpointPath, {
          profile: cfg.profile,
          firstMessage,
        });
        dispatch({ type: "BOOTED", executionId: res.executionId });
        bridgeRef.current?.sendEvent("conversationStarted", { executionId: res.executionId });
        const session = persist(cfg, res);
        if (session) openStream(session);
      } catch (e) {
        dispatch({ type: "ERROR", message: errMessage(e) });
      }
    },
    [openStream, persist],
  );

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

  const submitMessage = useCallback(
    (text: string) => {
      if (state.phase === "panel" || state.phase === "collapsed") {
        void start(text);
        return;
      }
      dispatch({ type: "USER_MESSAGE", text });
      void sendCommand({ command: "submit_message", nodeId: state.pending?.nodeId, message: text });
    },
    [sendCommand, start, state.pending?.nodeId, state.phase],
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

  const open = useCallback(() => {
    dispatch({ type: "OPEN" });
    bridgeRef.current?.sendEvent("open");
  }, []);
  const close = useCallback(() => {
    dispatch({ type: "CLOSE" });
    bridgeRef.current?.sendEvent("close");
  }, []);
  const newChat = useCallback(() => dispatch({ type: "NEW_CHAT" }), []);

  // host 명령은 1회 등록 핸들러에서 최신 함수를 참조해야 함(stale closure 회피).
  // ref 갱신은 render 중이 아니라 effect 에서(매 렌더).
  const apiRef = useRef({ open, close, submitMessage, closeStream });
  useEffect(() => {
    apiRef.current = { open, close, submitMessage, closeStream };
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
        dispatch({ type: "RESTORED", executionId: saved.executionId });
        openStream(saved);
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
      }
    });

    // host 없이 직접 로드(샘플/개발): query param 만으로도 부팅 시도.
    const fallback = configFromQuery();
    if (fallback.apiBase && fallback.triggerEndpointPath) {
      void applyConfig(fallback as BootMessage);
    }

    return () => {
      cancelled = true;
      closeStream();
      bridge.destroy();
    };
    // 마운트 1회. 핸들러는 ref 기반이라 deps 생략.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    config,
    actions: { open, close, start, submitMessage, clickButton, submitForm, newChat },
  };
}

function errMessage(e: unknown): string {
  if (e instanceof EiaError) return `${e.message}`;
  if (e instanceof Error) return e.message;
  return "알 수 없는 오류";
}
