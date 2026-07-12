"use client";

import { useState } from "react";
import {
  isActiveConversationPhase,
  isTextInputSurface,
  type WidgetState,
} from "@/lib/widget-state";
import type { BootMessage } from "../host-bridge";
import { useTranslation, type TranslationKey } from "@/lib/i18n";
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

/** 세션 컨트롤 확인바 문구 키·확정 라벨 키·실행 액션을 한 곳에서 조회(3중 분기 중복 제거). 문구는 렌더 시 t() 로 지역화. */
const CONFIRM_COPY: Record<
  ConfirmKind,
  { messageKey: TranslationKey; confirmLabelKey: TranslationKey; action: (a: PanelActions) => void }
> = {
  new: {
    messageKey: "confirm.newPrompt",
    confirmLabelKey: "confirm.newYes",
    action: (a) => a.newChat(),
  },
  end: {
    messageKey: "confirm.endPrompt",
    confirmLabelKey: "header.endChat",
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
  const t = useTranslation();
  const { messages, pending, phase, error } = state;
  const isEnded = phase === "ended";
  const fresh = messages.length === 0;
  const welcomeSuggestions = config.welcome?.suggestions ?? config.launcher?.suggestions ?? [];
  // 헤더 세션 컨트롤 노출 — 진행 중 대화에서만(대화 없음·ended 는 CTA/신규 시작으로 충분, §3.1).
  const showSessionControls = isActiveConversationPhase(phase);
  // 새 대화/종료 실행 전 가벼운 확인(2단계) — 진행 중 대화·히스토리 유실 오조작 방지(§3.1).
  const [confirming, setConfirming] = useState<ConfirmKind | null>(null);

  return (
    <section className="wc-panel" aria-label={t("panel.ariaLabel")}>
      <header className="wc-panel-header">
        <span className="wc-panel-title">{config.headerTitle ?? t("header.defaultTitle")}</span>
        <div className="wc-panel-actions">
          {showSessionControls && (
            <>
              <button
                type="button"
                className="wc-panel-action"
                onClick={() => setConfirming("new")}
              >
                {t("header.newChat")}
              </button>
              <button
                type="button"
                className="wc-panel-action"
                onClick={() => setConfirming("end")}
              >
                {t("header.endChat")}
              </button>
            </>
          )}
          <button type="button" className="wc-panel-close" aria-label={t("header.close")} onClick={actions.close}>
            ✕
          </button>
        </div>
      </header>

      <div className="wc-panel-body">
        {confirming && (
          <div className="wc-confirm" role="alertdialog" aria-label={t("confirm.ariaLabel")}>
            <span>{t(CONFIRM_COPY[confirming].messageKey)}</span>
            <div className="wc-confirm-actions">
              <button
                type="button"
                className="wc-confirm-yes"
                // 헤더 컨트롤과 접근성 이름을 분리(confirm 확정 버튼) — 동명 버튼 getByRole 구분 가능.
                aria-label={t("confirm.yesAria", { label: t(CONFIRM_COPY[confirming].confirmLabelKey) })}
                onClick={() => {
                  CONFIRM_COPY[confirming].action(actions);
                  setConfirming(null);
                }}
              >
                {t(CONFIRM_COPY[confirming].confirmLabelKey)}
              </button>
              <button
                type="button"
                className="wc-confirm-no"
                aria-label={t("confirm.noAria")}
                onClick={() => setConfirming(null)}
              >
                {t("confirm.no")}
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
          <div className="wc-quick-actions" role="group" aria-label={t("group.choices")}>
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
          <div className="wc-suggestions" aria-label={t("group.suggestions")}>
            {welcomeSuggestions.map((s, i) => (
              <button key={i} type="button" className="wc-suggestion" onClick={() => actions.submitMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* 렌더되는 에러는 항상 generic(use-widget ERROR 경로) — BLOCKED 코드는 blocked phase 라 미렌더. */}
        {error && <div className="wc-error" role="alert">{t("error.generic")}</div>}

        {isEnded && (
          <div className="wc-ended">
            <p>{t("ended.text")}</p>
            <button type="button" className="wc-newchat" onClick={actions.newChat}>
              {t("confirm.newYes")}
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
