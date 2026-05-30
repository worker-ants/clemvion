// BYO-UI / headless 예제 (M2). spec/7-channel-web-chat/0-architecture §5.3.
// hosted 위젯 대신, 개발자가 EIA 클라이언트로 자기 UI 를 직접 구성하고 자기 도메인에서 서빙한다.
// 호출 Origin = 고객 도메인 → 워크스페이스 interactionAllowedOrigins 에 그 도메인 등록 필요(4-security §2).
//
// EIA 클라이언트는 기존 @workflow/sdk 를 재사용한다. 아래는 개념 예시(의사 코드 수준).

// import { EiaClient } from "@workflow/sdk"; // 실제 EIA 클라이언트 (PR #230)

async function startCustomChat(apiBase: string, endpointPath: string) {
  // 1) 대화 시작 (공개 webhook, auth 없음)
  const res = await fetch(`${apiBase}/api/hooks/${endpointPath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ firstMessage: "안녕하세요" }),
  });
  const { interaction } = (await res.json()) as {
    interaction: { token: string; endpoints: { stream: string; submit: string } };
  };
  const { token, endpoints } = interaction;

  // 2) SSE 구독 (EventSource 헤더 미지원 → ?token=)
  const es = new EventSource(`${apiBase}${endpoints.stream}?token=${token}`);
  es.addEventListener("execution.ai_message", (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    renderAssistant(data.text); // 개발자 자체 UI
  });

  // 3) 사용자 메시지 제출
  async function send(text: string) {
    await fetch(`${apiBase}${endpoints.submit}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ command: "submit_message", message: text }),
    });
  }

  return { send };
}

declare function renderAssistant(text: string): void;
void startCustomChat;
