### 발견사항

- **[INFO]** `asyncIter` 헬퍼가 `return` 없이 `throw`하는 iterator를 시뮬레이션하지 못함
  - 위치: `asyncIter` 함수 (4–15줄)
  - 상세: 현재 헬퍼는 정상 흐름만 지원. 중단 시나리오 테스트에서는 별도 inline iterator를 매번 작성 중 (aborted 테스트 참고)
  - 제안: `asyncIter`에 선택적 `throwAt` 파라미터를 추가하거나, 별도 `errorIter` 헬퍼를 분리

- **[WARNING]** abort 테스트의 검증 전제가 취약함
  - 위치: `yields done with finishReason="aborted"` 테스트 (222–255줄)
  - 상세: 이 테스트는 `abort.abort()`를 호출한 뒤 `throw new Error('aborted')`로 예외를 발생시키는데, 실제 SDK에서 AbortSignal이 트리거될 때 던지는 에러 타입/메시지가 다를 수 있음. 현재 테스트는 "에러가 나면 aborted 처리"가 아니라 signal이 진짜 abort 처리되는지를 검증해야 함
  - 제안: `signal.aborted` 플래그를 확인하는 방식으로 구현체가 동작하는지, 또는 `DOMException` with `AbortError` name을 던지는 표준 패턴을 시뮬레이션하도록 수정

- **[WARNING]** `makeClientWithStreamResult` 에서 `aggregated` fallback 로직이 빈 배열 엣지케이스에서 불안정함
  - 위치: `makeClientWithStreamResult` 함수 (31–46줄)
  - 상세: `chunks`가 빈 배열일 때 `chunks[chunks.length - 1]`은 `undefined`이며, `aggregated ?? {} `로 폴백됨. 이 경우 `response`는 `{}`이 되는데, `no user message` 테스트에서는 `sendMessageStream`이 호출되지 않으므로 괜찮지만, 향후 테스트가 이 factory를 다른 방식으로 사용할 경우 silent하게 잘못된 `response`를 리턴할 수 있음
  - 제안: `chunks`가 비었고 `aggregated`도 없으면 명시적으로 `{}`이 아니라 `null`을 사용하거나 guard를 문서화

- **[INFO]** system/assistant role 메시지 변환 경로가 테스트되지 않음
  - 위치: 전체 spec
  - 상세: 현재 모든 테스트에서 `messages`는 `[{ role: 'user', content: '...' }]`만 사용. `role: 'assistant'`나 `role: 'system'`(또는 `systemInstruction`)을 포함한 멀티턴 대화가 `startChat`의 `history`로 올바르게 변환되는지 검증 없음
  - 제안: `messages`에 user/assistant 교대 메시지를 넣고 `startChat`이 받은 `history` 파라미터를 캡처해 검증하는 테스트 추가

- **[INFO]** `sendMessageStream` 첫 번째 인수(실제 전송 메시지)의 content 변환이 부분적으로만 검증됨
  - 위치: `forwards AbortSignal` 테스트 (291–319줄)
  - 상세: `sendMessageStream`이 `'x'`(문자열)로 호출됨을 간접 검증하지만, 실제 구현에서 배열 content나 multipart content를 string으로 직렬화하는 경우 변환 결과가 검증되지 않음
  - 제안: content가 객체/배열인 메시지에 대해 `sendMessageStream`의 첫 번째 인수를 명시적으로 assert하는 테스트 추가

- **[INFO]** 여러 tool call이 단일 청크에 포함된 경우 미검증
  - 위치: `tool_call_delta+tool_call_end` 테스트 (96–158줄)
  - 상세: 단일 `functionCall`만 다루며, 하나의 청크에 `functionCall`이 여러 개 포함된 경우(예: Gemini가 parallel tool calling을 내보낼 때)의 이벤트 순서가 검증되지 않음
  - 제안: `parts: [{ functionCall: ... }, { functionCall: ... }]`를 포함한 청크 테스트 추가

- **[INFO]** `tool_call_delta`/`tool_call_end` id 검증이 conditional guard 뒤에 위치
  - 위치: 143–147줄
  - 상세: `if (delta?.type === ... && end?.type === ...)` 가드 안에서 `expect`가 실행되므로, 타입이 맞지 않으면 expect 자체가 skip됨. 테스트 실패가 silent하게 통과될 수 있음
  - 제안: `as`로 타입을 단언하거나 `expect(delta?.type).toBe('tool_call_delta')`를 먼저 assert한 뒤 non-null 접근

- **[INFO]** 청크 간 사용량이 누적되는 경우(중간 청크에 usage 포함) 테스트 없음
  - 위치: 전체 spec
  - 상세: Gemini는 중간 청크에도 partial usage를 포함할 수 있음. 마지막 청크의 usage를 우선하는지, 아니면 누적하는지 구현체 동작을 명시적으로 검증하는 케이스 없음

---

### 요약

이 테스트 스위트는 `GoogleClient.stream`의 핵심 시나리오(텍스트 스트리밍, tool call, finishReason 매핑, usage fallback, abort, 에러 분류)를 체계적으로 커버하며 구조가 명확하다. 헬퍼 함수(`asyncIter`, `makeClientWithStreamResult`, `collect`) 덕분에 각 테스트의 의도가 잘 드러나고 격리도 양호하다. 다만 멀티턴 메시지 변환, 복수 tool call, 중간 청크 usage 처리 등 몇 가지 경로가 검증되지 않으며, abort 시뮬레이션이 실제 SDK의 AbortError 패턴과 다를 수 있다는 점과 `id` 검증이 conditional guard 안에 있어 silent pass 위험이 있다는 점이 보완할 여지로 남는다. 전체적으로 테스트 품질은 높으나, 상기 WARNING 항목들을 보완하면 실제 SDK 동작과의 괴리 위험을 줄일 수 있다.

### 위험도

**LOW**