## 리뷰 결과: `google.client.spec.ts`

### 발견사항

- **[INFO]** `system` 역할 메시지 처리 테스트 누락
  - 위치: `describe('GoogleClient.stream')` 전체
  - 상세: Gemini API는 `system` 역할을 `systemInstruction`으로 별도 처리해야 하며, `startChat` 호출 시 인자로 전달됩니다. `messages` 배열에 `{ role: 'system', content: '...' }` 가 포함될 때 `sendMessageStream`이 올바른 내용으로 호출되는지 검증하는 케이스가 없습니다.
  - 제안: `messages` 배열 첫 번째에 `role: 'system'` 메시지가 있을 때 `startChat`의 `systemInstruction` 파라미터가 올바르게 세팅되는지 확인하는 테스트 추가

- **[INFO]** `assistant` 역할 history 변환 테스트 누락
  - 위치: `describe('GoogleClient.stream')` 전체
  - 상세: 멀티턴 대화에서 `{ role: 'assistant', content: '...' }` 메시지가 Gemini의 `history: [{ role: 'model', parts: [...] }]` 형식으로 올바르게 변환되는지 검증이 없습니다.
  - 제안: `messages` 에 user/assistant 교차 이력이 포함된 경우 `startChat`이 올바른 `history` 파라미터로 호출되었는지 검증하는 케이스 추가

- **[INFO]** `tool` 역할 메시지(function response) 처리 테스트 누락
  - 위치: `describe('GoogleClient.stream')` 전체
  - 상세: 도구 호출 결과(`role: 'tool'`)를 담은 메시지가 Gemini의 `functionResponse` 파트로 올바르게 변환되는지 검증이 없습니다. 워크플로우 AI 어시스턴트처럼 도구 사용이 핵심인 시스템에서는 중요한 경로입니다.
  - 제안: `role: 'tool'` 메시지가 포함된 multi-turn에서 `sendMessageStream`에 전달되는 내용이 올바른지 검증하는 테스트 추가

- **[INFO]** `tools`/`toolConfig` 파라미터 전달 검증 누락
  - 위치: `describe('GoogleClient.stream')` 전체
  - 상세: `stream()` 호출 시 `tools` 파라미터가 주어졌을 때 `getGenerativeModel`에 `tools` 옵션이 올바르게 전달되는지 검증하는 케이스가 없습니다.
  - 제안: `tools` 배열이 포함된 요청에서 `getGenerativeModel` mock이 해당 옵션을 포함하여 호출되었는지 확인하는 테스트 추가

- **[INFO]** 빈 `candidates` 배열 처리 테스트 누락
  - 위치: `describe('GoogleClient.stream')` 전체
  - 상세: `candidates: []` 이거나 `candidates` 자체가 없는 청크가 스트림에 포함될 때 에러 없이 처리되는지 검증이 없습니다.
  - 제안: `{ candidates: [] }` 또는 `{}` 청크를 포함한 스트림에서 `done` 이벤트가 정상 발행되는지 확인하는 테스트 추가

---

### 요약

현재 테스트는 `GoogleClient.stream`의 핵심 이벤트 타입(text_delta, tool_call_delta/end, done, error), finishReason 매핑 5종, AbortSignal 처리, usage fallback, 빈 messages 처리 등 기본 스트리밍 동작을 잘 커버하고 있습니다. 다만 이 클라이언트가 실제로 사용되는 워크플로우 AI 어시스턴트 컨텍스트에서는 멀티턴 대화(system/assistant/tool 역할 변환)와 도구 정의 전달이 핵심 경로임에도 이 부분의 검증이 전무합니다. 구현 오류가 있더라도 현재 테스트로는 탐지할 수 없는 사각지대입니다.

### 위험도

**LOW** — 스트림 이벤트 처리 자체는 잘 검증되어 있으나, 멀티턴·도구 연동 경로는 미검증 상태입니다.