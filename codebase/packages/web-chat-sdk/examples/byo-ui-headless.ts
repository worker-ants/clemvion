// BYO-UI / headless 예제 (M2). spec/7-channel-web-chat/0-architecture §5.3 · 2-sdk §2.
//
// Hosted iframe 위젯(@workflow/web-chat) 대신, 개발자가 **EIA 클라이언트(@workflow/sdk)를 직접 사용**해
// 자기 UI 를 구성하고 자기 도메인에서 서빙한다. 별도 web-chat 전용 headless 패키지는 두지 않는다 —
// M2 BYO-UI headless client = `@workflow/sdk`(ClemvionClient) 그 자체다(2-sdk §2 의존 방향).
//
// 호출 Origin = 고객 도메인 → 워크스페이스 `interactionAllowedOrigins` 에 그 도메인 등록 필요(4-security §2).
// 공개 webhook 시작은 인증 없음, 이후 interact/SSE 는 webhook 202 가 발급한 per_execution 토큰을 쓴다.

import { ClemvionClient } from "@workflow/sdk";

export interface HeadlessChat {
  /** 사용자 메시지 전송. */
  send: (text: string) => Promise<void>;
  /**
   * 대화 종료(서버 신호) — `end_conversation` 커맨드를 서버에 전송해 워크플로우 실행을 종료시킨다.
   * 서버 응답으로 `execution.completed` 이벤트가 도착하면 SSE 구독도 자동 종료된다(I20).
   */
  end: () => Promise<void>;
  /**
   * SSE 연결만 해제(클라이언트 측) — 서버 워크플로우 실행은 계속 진행된다.
   * 페이지 언마운트·컴포넌트 정리 시 호출. 실행 자체를 끝내려면 `end()` 를 사용(I20).
   */
  close: () => void;
}

/**
 * 개발자 자체 UI 용 headless 웹챗 세션 — start → SSE 구독 → submit.
 * 렌더링은 호출자(onAssistantMessage)가 담당한다(BYO-UI).
 */
export async function startHeadlessChat(
  apiBase: string,
  endpointPath: string,
  firstMessage: string,
  handlers: {
    onAssistantMessage: (text: string) => void;
    onEnded?: (reason: string) => void;
    onError?: (err: Error) => void;
  },
): Promise<HeadlessChat> {
  const client = new ClemvionClient({ baseUrl: apiBase });

  // 1) 대화 시작(공개 webhook, auth 없음) → per_execution 토큰 발급.
  const result = await client.triggerWebhook(endpointPath, { firstMessage });
  const token = result.interaction?.token;
  if (!token) {
    throw new Error("이 트리거는 interactive 세션을 시작하지 않습니다(토큰 미발급).");
  }
  const { executionId } = result;

  // 2) SSE 구독 — assistant 메시지/종료를 호출자 UI 로 전달.
  const sub = client.subscribeToExecution(executionId, token, {
    onEvent: (e) => {
      if (e.event === "execution.ai_message") {
        const text = (e.data as { message?: string; text?: string }).message ?? "";
        if (text) handlers.onAssistantMessage(text);
      } else if (
        e.event === "execution.completed" ||
        e.event === "execution.failed" ||
        e.event === "execution.cancelled"
      ) {
        handlers.onEnded?.(e.event);
      }
    },
    onError: (err) => handlers.onError?.(err),
  });

  // 3) 사용자 메시지 제출(Authorization: Bearer iext_*).
  const send = async (text: string) => {
    await client.interact(executionId, token, { command: "submit_message", message: text });
  };
  const end = async () => {
    await client.interact(executionId, token, { command: "end_conversation" });
  };

  return { send, end, close: () => sub.close() };
}

// 토큰 만료 30분 이내 자동 갱신이 필요하면 `client.refreshToken(...)` 을 스케줄링한다
// (hosted 위젯은 이를 내장 — D#5 / 3-auth-session §3 step7).
