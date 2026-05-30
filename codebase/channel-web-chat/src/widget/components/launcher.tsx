"use client";

interface LauncherProps {
  suggestions: string[];
  primaryColor: string;
  unread: number;
  onOpen: () => void;
  onSuggestion: (text: string) => void;
}

// 런처(collapsed) — 플로팅 버튼 + 추천 질문 버블. spec 1-widget-app §2.
export function Launcher({ suggestions, primaryColor, unread, onOpen, onSuggestion }: LauncherProps) {
  return (
    <div className="wc-launcher">
      {suggestions.length > 0 && (
        <ul className="wc-launcher-suggestions" aria-label="추천 질문">
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
        aria-label="채팅 열기"
        style={{ background: primaryColor }}
        onClick={onOpen}
      >
        <span aria-hidden>💬</span>
        {unread > 0 && (
          <span className="wc-unread" aria-label={`읽지 않은 메시지 ${unread}개`}>
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
