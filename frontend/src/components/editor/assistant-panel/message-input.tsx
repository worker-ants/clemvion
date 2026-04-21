"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { useT } from "@/lib/i18n";

interface MessageInputProps {
  disabled: boolean;
  streaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
}

export function MessageInput({
  disabled,
  streaming,
  onSend,
  onStop,
}: MessageInputProps) {
  const t = useT();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    const maxHeight = 140;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  return (
    <div className="flex flex-col gap-1 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
      <div className="flex items-end gap-1.5">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled && !streaming}
          placeholder={
            streaming
              ? t("assistant.thinking")
              : t("assistant.placeholder")
          }
          aria-label={t("assistant.placeholder")}
          rows={1}
          className="flex-1 resize-none rounded-md border border-[hsl(var(--input))] bg-transparent px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-50"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={t("assistant.stopButton")}
            className="flex size-8 items-center justify-center rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            aria-label={t("assistant.sendButton")}
            className="flex size-8 items-center justify-center rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
