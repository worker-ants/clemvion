"use client";

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject } from "react";
import type { InteractCommand } from "@/lib/eia-types";
import type { PersistedSession } from "@/lib/session-store";
import {
  isTextInputSurface,
  type PendingInteraction,
  type WidgetAction,
  type WidgetPhase,
} from "@/lib/widget-state";

interface PendingMessageQueueDeps {
  phase: WidgetPhase;
  pending: PendingInteraction | null;
  sessionRef: MutableRefObject<PersistedSession | null>;
  sendCommand: (command: InteractCommand) => Promise<void>;
  dispatch: Dispatch<WidgetAction>;
}

/**
 * C1(§R6) 보류 메시지 큐를 캡슐화한 훅 — useWidget God hook 분리(§B).
 *
 * open() 직후 booting/streaming 중 들어온 자유 텍스트(런처 버블·추천질문 탭 race)를 1건 보관했다가,
 * `awaiting_user_message` + 텍스트 표면(`ai_conversation`) 진입 시 `submit_message` 로 **flush** 한다.
 * 첫 표면이 `buttons`/`form` 이면 자유 텍스트가 제출 비대상이라 큐를 **폐기**(잘못된 표면 오제출 방지).
 * 동작은 분리 전과 동일하다.
 *
 * @returns enqueue — 즉시 전송 불가 시 호출(최신 1건만 보관). clearQueue — 새 대화(newChat) 시 이전 대화의
 *   큐 누수 차단용 폐기(I1).
 */
export function usePendingMessageQueue({
  phase,
  pending,
  sessionRef,
  sendCommand,
  dispatch,
}: PendingMessageQueueDeps) {
  const pendingSendRef = useRef<string | null>(null);

  const enqueue = useCallback((text: string) => {
    pendingSendRef.current = text;
  }, []);

  const clearQueue = useCallback(() => {
    pendingSendRef.current = null;
  }, []);

  // flush effect — booting/streaming 중 큐에 쌓인 텍스트를 awaiting_user_message 진입 시 전송.
  // ai_conversation 표면에서만 flush(buttons/form 표면은 텍스트 입력 비대상 → 큐 폐기).
  useEffect(() => {
    if (phase !== "awaiting_user_message" || pendingSendRef.current == null || !sessionRef.current) {
      return;
    }
    if (isTextInputSurface(pending)) {
      const queued = pendingSendRef.current;
      pendingSendRef.current = null;
      dispatch({ type: "USER_MESSAGE", text: queued });
      void sendCommand({ command: "submit_message", nodeId: pending?.nodeId, message: queued });
    } else {
      // 첫 표면이 buttons/form → 텍스트 제출 비대상. 큐 폐기.
      pendingSendRef.current = null;
    }
  }, [phase, pending, sendCommand, sessionRef, dispatch]);

  return { enqueue, clearQueue };
}
