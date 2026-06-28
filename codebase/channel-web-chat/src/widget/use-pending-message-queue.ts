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
  /** 현재 위젯 phase — `awaiting_user_message` 진입이 flush 트리거. */
  phase: WidgetPhase;
  /** 현재 대기 표면 — 텍스트 표면(`isTextInputSurface`)일 때만 flush, buttons/form 이면 폐기. null 가능. */
  pending: PendingInteraction | null;
  /** 세션 핸들 — `.current` 없으면(미시작) flush 보류. */
  sessionRef: MutableRefObject<PersistedSession | null>;
  /** EIA interact 전송기 — flush 시 `submit_message` 발행. **stable identity 전제**(useWidget 에서 `useCallback(…, [])`):
   *  flush effect deps 에 포함되므로 매 렌더 새 함수면 의도치 않은 effect 재실행을 유발한다. */
  sendCommand: (command: InteractCommand) => Promise<void>;
  /** 위젯 reducer dispatch — flush 시 `USER_MESSAGE` 반영. */
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
      // pending 은 이 분기에서 null 일 수 있다(ai_conversation 도달 전 과도 상태 — isTextInputSurface(null)=true).
      // 따라서 `pending?.nodeId`(옵셔널 체이닝) 필수 — null 이면 nodeId 미동봉으로 submit_message.
      void sendCommand({ command: "submit_message", nodeId: pending?.nodeId, message: queued });
    } else {
      // 첫 표면이 buttons/form → 텍스트 제출 비대상. 큐 폐기.
      pendingSendRef.current = null;
    }
    // sessionRef·dispatch 는 stable 참조(.current 변화는 effect 트리거 아님 — effect 내에서만 읽음).
    // 실질 재실행 트리거는 phase·pending·sendCommand. lint exhaustive-deps 만족 위해 ref 도 명시.
  }, [phase, pending, sendCommand, sessionRef, dispatch]);

  return { enqueue, clearQueue };
}
