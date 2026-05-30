"use client";

import { useState } from "react";

// 위젯 SPA shell (스캐폴딩 단계 stub).
// 상태기계·EIA 클라이언트(webhook/SSE/REST)·화면(런처/패널/메시지/입력)은 후속 increment 에서 구현.
// SoT: spec/7-channel-web-chat/1-widget-app (화면 구조 §2, 상태기계 §3, 종료/재시작 §3.1).
type WidgetState = "collapsed" | "panel" | "booting" | "streaming" | "awaiting_user_message" | "ended";

export default function WidgetApp() {
  const [state, setState] = useState<WidgetState>("collapsed");

  // TODO(impl): postMessage bridge(wc:* — 2-sdk §3), boot config 수신, conversation 렌더 규약
  // (conversationThread.turns 1차 소스 + [user-input] strip — 1-widget-app §2), per_execution 세션(3-auth-session).
  return (
    <div data-testid="web-chat-widget" data-state={state}>
      {state === "collapsed" ? (
        <button type="button" aria-label="채팅 열기" onClick={() => setState("panel")}>
          chat
        </button>
      ) : (
        <section aria-label="채팅 패널">
          <button type="button" aria-label="닫기" onClick={() => setState("collapsed")}>
            close
          </button>
          {/* 헤더 · 환영 메시지 · 퀵액션 · 추천질문 · 메시지 리스트 · 입력창 · 면책 푸터 — 후속 구현 */}
        </section>
      )}
    </div>
  );
}
