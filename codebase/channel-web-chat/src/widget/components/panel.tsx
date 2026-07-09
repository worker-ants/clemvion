"use client";

import { useState } from "react";
import {
  isActiveConversationPhase,
  isTextInputSurface,
  type WidgetState,
} from "@/lib/widget-state";
import type { BootMessage } from "../host-bridge";
import { Composer } from "./composer";
import { DynamicForm } from "./dynamic-form";
import { PresentationList } from "./presentations";

interface PanelActions {
  close: () => void;
  submitMessage: (text: string) => void;
  clickButton: (buttonId: string) => void;
  submitForm: (data: Record<string, unknown>) => void;
  newChat: () => void;
  endConversation: () => void;
}

interface PanelProps {
  state: WidgetState;
  config: BootMessage;
  actions: PanelActions;
}

type ConfirmKind = "new" | "end";

/** 세션 컨트롤 확인바 문구·확정 라벨·실행 액션을 한 곳에서 조회(WARNING #5 — 분기 3중 중복 제거). */
const CONFIRM_COPY: Record<
  ConfirmKind,
  { message: string; confirmLabel: string; action: (a: PanelActions) => void }
> = {
  new: {
    message: "새 대화를 시작할까요? 현재 대화 내용은 사라져요.",
    confirmLabel: "새 대화 시작",
    action: (a) => a.newChat(),
  },
  end: {
    message: "대화를 종료할까요? 종료하면 이어서 대화할 수 없어요.",
    confirmLabel: "대화 종료",
    action: (a) => a.endConversation(),
  },
};

interface ButtonDef {
  id?: string;
  buttonId?: string;
  label?: string;
}

function buttonsOf(config: Record<string, unknown> | undefined): ButtonDef[] {
  const raw = config?.buttons as unknown;
  return Array.isArray(raw) ? (raw as ButtonDef[]) : [];
}

export function Panel({ state, config, actions }: PanelProps) {
  const { messages, pending, phase, error } = state;
  const isEnded = phase === "ended";
  const fresh = messages.length === 0;
  const welcomeSuggestions = config.welcome?.suggestions ?? config.launcher?.suggestions ?? [];
  // 헤더 세션 컨트롤 노출 — 진행 중 대화에서만(대화 없음·ended 는 CTA/신규 시작으로 충분, §3.1).
  const showSessionControls = isActiveConversationPhase(phase);
  // 새 대화/종료 실행 전 가벼운 확인(2단계) — 진행 중 대화·히스토리 유실 오조작 방지(§3.1).
  const [confirming, setConfirming] = useState<ConfirmKind | null>(null);

  return (
    <section className="wc-panel" aria-label="채팅 패널">
      <header className="wc-panel-header">
        <span className="wc-panel-title">{config.headerTitle ?? "AI 어시스턴트"}</span>
        <div className="wc-panel-actions">
          {showSessionControls && (
            <>
              <button
                type="button"
                className="wc-panel-action"
                onClick={() => setConfirming("new")}
              >
                새 대화
              </button>
              <button
                type="button"
                className="wc-panel-action"
                onClick={() => setConfirming("end")}
              >
                대화 종료
              </button>
            </>
          )}
          <button type="button" className="wc-panel-close" aria-label="닫기" onClick={actions.close}>
            ✕
          </button>
        </div>
      </header>

      <div className="wc-panel-body">
        {confirming && (
          <div className="wc-confirm" role="alertdialog" aria-label="확인">
            <span>{CONFIRM_COPY[confirming].message}</span>
            <div className="wc-confirm-actions">
              <button
                type="button"
                className="wc-confirm-yes"
                // 헤더 컨트롤과 접근성 이름을 분리(confirm 확정 버튼) — getByRole 구분 가능(WARNING #4).
                aria-label={`${CONFIRM_COPY[confirming].confirmLabel} 확정`}
                onClick={() => {
                  CONFIRM_COPY[confirming].action(actions);
                  setConfirming(null);
                }}
              >
                {CONFIRM_COPY[confirming].confirmLabel}
              </button>
              <button
                type="button"
                className="wc-confirm-no"
                aria-label="확인 취소"
                onClick={() => setConfirming(null)}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {config.welcome?.text && (
          <div className="wc-bubble-msg wc-assistant">{config.welcome.text}</div>
        )}

        <ul className="wc-messages">
          {messages.map((m, i) => (
            <li key={i} className={`wc-bubble-msg wc-${m.role}`} data-source={m.source}>
              {m.text}
              {m.presentations && (
                <PresentationList presentations={m.presentations} onButton={actions.clickButton} />
              )}
            </li>
          ))}
        </ul>

        {pending?.type === "buttons" && (
          <div className="wc-quick-actions" role="group" aria-label="선택지">
            {buttonsOf(pending.config).map((b, i) => {
              const id = b.buttonId ?? b.id ?? "";
              return (
                <button key={id || i} type="button" className="wc-action" onClick={() => actions.clickButton(id)}>
                  {b.label ?? id}
                </button>
              );
            })}
          </div>
        )}

        {pending?.type === "form" && (
          <DynamicForm config={pending.config} onSubmit={actions.submitForm} />
        )}

        {fresh && welcomeSuggestions.length > 0 && (
          // W1: booting/streaming 중 탭 시 race 로 메시지 유실 방지 — 큐(C1)가 흡수하므로 버튼은 항상 클릭 가능.
          // Composer 와 달리 여기서는 비활성 처리가 아니라 큐에 위임(submitMessage 내부가 큐로 분기).
          <div className="wc-suggestions" aria-label="추천 질문">
            {welcomeSuggestions.map((s, i) => (
              <button key={i} type="button" className="wc-suggestion" onClick={() => actions.submitMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {error && <div className="wc-error" role="alert">{error}</div>}

        {isEnded && (
          <div className="wc-ended">
            <p>대화가 종료되었어요.</p>
            <button type="button" className="wc-newchat" onClick={actions.newChat}>
              새 대화 시작
            </button>
          </div>
        )}
      </div>

      {!isEnded && (
        // eager 시작(§R6): execution 이 첫 입력 대기(awaiting_user_message)에 들어왔을 때만 자유 텍스트 입력 활성.
        // booting/streaming(AI 처리 중) 또는 buttons/form 표면일 때는 비활성 — 사용자는 선택/제출로 응답.
        // AI 처리(booting/streaming) 중엔 전송 버튼에 스피너로 "응답 중" 표시 — 흐린 비활성이 고장처럼 보이던 문제 해소.
        <Composer
          loading={phase === "booting" || phase === "streaming"}
          disabled={phase !== "awaiting_user_message" || !isTextInputSurface(pending)}
          onSend={actions.submitMessage}
        />
      )}

      {config.disclaimer && <footer className="wc-disclaimer">{config.disclaimer}</footer>}
    </section>
  );
}
