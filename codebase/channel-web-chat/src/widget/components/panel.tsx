"use client";

import type { WidgetState } from "@/lib/widget-state";
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
}

interface PanelProps {
  state: WidgetState;
  config: BootMessage;
  actions: PanelActions;
}

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

  return (
    <section className="wc-panel" aria-label="채팅 패널">
      <header className="wc-panel-header">
        <span className="wc-panel-title">{config.headerTitle ?? "AI 어시스턴트"}</span>
        <button type="button" className="wc-panel-close" aria-label="닫기" onClick={actions.close}>
          ✕
        </button>
      </header>

      <div className="wc-panel-body">
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
        <Composer
          disabled={
            phase !== "awaiting_user_message" ||
            pending?.type === "buttons" ||
            pending?.type === "form"
          }
          onSend={actions.submitMessage}
        />
      )}

      {config.disclaimer && <footer className="wc-disclaimer">{config.disclaimer}</footer>}
    </section>
  );
}
