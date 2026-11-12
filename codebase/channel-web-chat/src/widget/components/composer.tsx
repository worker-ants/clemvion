"use client";

import { useState, type FormEvent } from "react";
import { useTranslation } from "@/lib/i18n";

interface ComposerProps {
  /** 외부 강제 비활성(§R6 게이팅: phase≠awaiting_user_message 또는 buttons/form 표면). */
  disabled?: boolean;
  /** AI 응답 처리 중(booting/streaming) — 전송 버튼 자리에 스피너로 "응답 중" 표시. spec 1-widget-app §R6. */
  loading?: boolean;
  placeholder?: string;
  /**
   * 입력창에 되돌릴 글. 메시지 전송이 실패하면 보낸 글을 다시 채운다(REQ-WCWIDGET-054). 객체가 바뀔 때만
   * 반영하므로 사용자가 고쳐 쓰던 글을 재렌더로 덮지 않는다.
   */
  draft?: { text: string };
  onSend: (text: string) => void;
}

// 입력창 — 엔터/전송 → submit_message. spec 1-widget-app §2.
export function Composer({ disabled, loading, placeholder, draft, onSend }: ComposerProps) {
  const t = useTranslation();
  const [text, setText] = useState(draft?.text ?? "");
  // 되돌릴 글이 바뀌면 렌더 중에 한 번 반영한다(React 문서의 "prop 이 바뀔 때 state 조정" 패턴).
  // effect 에서 setState 하면 한 번 더 그린다.
  const [appliedDraft, setAppliedDraft] = useState(draft);
  if (draft !== appliedDraft) {
    setAppliedDraft(draft);
    if (draft) setText(draft.text);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    // loading(응답 중)·disabled 시 전송 차단 — Composer 단독 재사용 시에도 계약 보장.
    if (!trimmed || disabled || loading) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <form className="wc-composer" onSubmit={submit}>
      <input
        className="wc-composer-input"
        type="text"
        value={text}
        disabled={disabled}
        placeholder={placeholder ?? t("composer.placeholder")}
        aria-label={t("composer.inputLabel")}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        className="wc-composer-send"
        disabled={disabled || loading || !text.trim()}
        aria-busy={loading || undefined}
        aria-label={loading ? t("composer.sendBusy") : t("composer.send")}
      >
        {loading ? <span className="wc-composer-spinner" aria-hidden="true" /> : "↑"}
      </button>
    </form>
  );
}
