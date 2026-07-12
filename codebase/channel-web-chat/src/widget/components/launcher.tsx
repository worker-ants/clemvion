"use client";

import { useTranslation } from "@/lib/i18n";

interface LauncherProps {
  suggestions: string[];
  primaryColor: string;
  unread: number;
  onOpen: () => void;
  onSuggestion: (text: string) => void;
}

// 런처(collapsed) — 플로팅 버튼 + 추천 질문 버블. spec 1-widget-app §2.
export function Launcher({ suggestions, primaryColor, unread, onOpen, onSuggestion }: LauncherProps) {
  const t = useTranslation();
  return (
    <div className="wc-launcher">
      {suggestions.length > 0 && (
        <ul className="wc-launcher-suggestions" aria-label={t("group.suggestions")}>
          {suggestions.map((s, i) => (
            <li key={i}>
              <button type="button" className="wc-bubble" onClick={() => onSuggestion(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="wc-launcher-btn"
        aria-label={t("launcher.open")}
        style={{ background: primaryColor }}
        onClick={onOpen}
      >
        <span aria-hidden>💬</span>
        {unread > 0 && (
          <span className="wc-unread" aria-label={t("launcher.unread", { count: unread })}>
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
