// 공개 타입 — spec/7-channel-web-chat/2-sdk §4 (BootConfig), §3 (postMessage 프로토콜).

export interface BootConfig {
  /** EIA 가 서빙되는 API origin. 배포 환경값(0-architecture §4). 예: https://api.example.com */
  apiBase: string;
  /** 공개 webhook path (비밀 아님). 인증 토큰은 boot 에 넣지 않음 — webhook 202 가 per_execution 토큰 발급. */
  triggerEndpointPath: string;
  locale?: "ko" | "en";
  /** 현 phase = 색·위치만(결정 F). */
  appearance?: {
    primaryColor?: string;
    position?: "bottom-right" | "bottom-left";
    zIndex?: number;
  };
  /** 봇 표시명(콘텐츠). 외형 테마와 무관. */
  headerTitle?: string;
  /** 정적 환영 메시지·추천질문 (워크플로우 시작 전 클라이언트 렌더). */
  welcome?: { text?: string; suggestions?: string[] };
  launcher?: { suggestions?: string[] };
  disclaimer?: string;
  /** webhook payload 로 전달(서버에서 워크플로우 input 으로 사용). v1 익명 — 식별키는 추후. */
  profile?: Record<string, unknown>;
}

/** 공개 JS API 메서드 (스니펫 전역 함수 / npm 인스턴스 공통). */
export type ClemvionChatMethod =
  | "boot"
  | "shutdown"
  | "show"
  | "hide"
  | "open"
  | "close"
  | "sendMessage"
  | "updateProfile"
  | "on";

/** iframe → host 이벤트 (구독 가능). */
export type WidgetEvent =
  | "open"
  | "close"
  | "message"
  | "unread"
  | "conversationStarted"
  | "conversationEnded";

/** host ↔ iframe postMessage 메시지 type — wc: namespace prefix (2-sdk §3). */
export const WC_MESSAGE_PREFIX = "wc:" as const;
export type WcMessageType =
  | "wc:boot"
  | "wc:command"
  | "wc:ready"
  | "wc:resize"
  | "wc:event";

export interface ChatInstance {
  open(): void;
  close(): void;
  show(): void;
  hide(): void;
  sendMessage(text: string): void;
  updateProfile(profile: Record<string, unknown>): void;
  on(event: WidgetEvent, cb: (payload: unknown) => void): void;
  shutdown(): void;
}
