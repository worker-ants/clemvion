"use client";

import { useState, type FormEvent } from "react";

interface ComposerProps {
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => void;
}

// 입력창 — 엔터/전송 → submit_message. spec 1-widget-app §2.
export function Composer({ disabled, placeholder, onSend }: ComposerProps) {
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
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
        placeholder={placeholder ?? "메시지를 입력해 주세요."}
        aria-label="메시지 입력"
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="wc-composer-send" disabled={disabled || !text.trim()} aria-label="전송">
        ↑
      </button>
    </form>
  );
}
