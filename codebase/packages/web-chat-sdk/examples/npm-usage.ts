// npm 통합 예제 (M1 Hosted, 빌드 통합형). spec/7-channel-web-chat/2-sdk §2.
// 개발자가 자기 SPA 빌드에 import 하여 위젯을 부팅하고 프로그래matic 제어 + 이벤트 구독.

import { ClemvionChat } from "@workflow/web-chat"; // scope 확정: @workflow/* (eia-sdk-publish §결정 #3)

// 위젯 CDN base 를 빌드 env 로 주입(0-architecture §4). 명시 지정도 가능:
ClemvionChat.setWidgetBase(process.env.WEB_CHAT_WIDGET_BASE ?? "https://cdn.example.com");

const chat = ClemvionChat.boot({
  apiBase: "https://api.example.com",
  triggerEndpointPath: "PUBLIC_WEBHOOK_PATH",
  locale: "ko",
  appearance: { primaryColor: "#5B4FE9", position: "bottom-right" },
  headerTitle: "AI 어시스턴트",
  welcome: { text: "무엇을 도와드릴까요?", suggestions: ["요금제 안내", "도입 문의"] },
  // 로그인 유저 식별 정보 — webhook payload 로 전달(서버 워크플로우 input). v1 익명 기준.
  profile: { plan: "pro" },
});

// 호스트 자체 분석/배지 (텔레메트리는 SDK 가 보내지 않음 — 호스트 책임)
chat.on("message", (m) => console.log("message", m));
chat.on("unread", (n) => console.log("unread", n));

// 프로그래matic 제어
document.getElementById("help")?.addEventListener("click", () => chat.open());
