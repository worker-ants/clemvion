// 테스트 fixture — durable thread 의 turn.presentations[] 가 싣는 백엔드 PresentationPayload
// { type, toolCallId, renderedAt, payload, truncation? } shape 을 만든다 (ai-agent §7.10,
// source='ai_assistant' 한정). 라이브 노드 경로의 {config,output} envelope 과 shape 이 다르며,
// 위젯 렌더러는 두 shape 을 모두 수용해야 한다 — spec/7-channel-web-chat/1-widget-app §2.
//
// conversation.test.ts · presentations.test.tsx 두 소비처가 공유한다 (payloadOf 중복 제거,
// plan webchat-widget-presentation-followups item 3). truncation 3번째 인자는 presentations.test.tsx
// 의 잘림 배너 케이스용 — 넘기지 않으면 키 자체가 빠진다(복원 thread 무-truncation 케이스 대칭).
export const payloadOf = (type: string, payload: Record<string, unknown>, truncation?: unknown) => ({
  type,
  toolCallId: `call_${type}`,
  renderedAt: "2026-07-10T00:00:00.000Z",
  payload,
  ...(truncation ? { truncation } : {}),
});
