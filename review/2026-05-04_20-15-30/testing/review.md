## 발견사항

### [WARNING] `waiting_for_input` emit 경로에 대한 통합 테스트 부재
- **위치**: `execution-engine.service.ts` diff, `waitForAiConversation` 내부
- **상세**: `buildAiMessageDebugFromResumeState`의 단위 테스트는 충실하지만, 실제 `execution.ai_message` WebSocket 이벤트가 올바른 shape(`llmCalls`, `durationMs`)로 방출되는지 검증하는 통합 테스트가 없다. 기존 테스트 스위트에도 `waitForAiConversation` 경로를 커버하는 케이스가 보이지 않는다.
- **제안**: `waitForAiConversation`을 spy하는 통합 테스트를 추가하여 `emitExecutionEvent`가 `AI_MESSAGE` 타입으로 호출될 때 `llmCalls`·`durationMs`가 포함되고 구 필드(`requestPayload`, `responsePayload`, `lastTurnDurationMs`)는 없음을 assert해야 한다.

### [WARNING] 구 필드 제거에 대한 회귀 테스트 없음
- **위치**: `execution-engine.service.ts` `-requestPayload / -responsePayload / -durationMs` 삭제 라인
- **상세**: `requestPayload`, `responsePayload`, `lastTurnDurationMs` 세 필드가 페이로드에서 제거됐다. 프론트엔드나 다른 소비자가 이 필드를 사용하고 있었다면 무성하게 깨진다. 제거 사실을 명시적으로 검증하는 회귀 테스트가 없다.
- **제안**: 통합 테스트에서 `expect(emitCall.payload).not.toHaveProperty('requestPayload')` 형태로 제거 보장을 assert한다.

### [INFO] `llmCalls: []`(빈 배열) 케이스 미검증
- **위치**: `execution-engine.service.spec.ts`, 신규 `describe` 블록
- **상세**: 현재 구현은 `llmCalls !== undefined`이면 포함시키므로 빈 배열도 `llmCalls: []`로 방출된다. 이것이 의도된 동작인지(프론트 타임라인에 빈 배열을 줘도 되는지) 테스트로 문서화되지 않았다.
- **제안**: `turnDebugHistory: [{ turnIndex: 1, llmCalls: [], totalDurationMs: 0 }]` 케이스를 추가하여 `llmCalls`가 빈 배열로 포함되는지 또는 생략되어야 하는지 명시적으로 정의한다.

### [INFO] `totalDurationMs: 0` 경계값 미검증
- **위치**: `execution-engine.service.spec.ts`, 신규 `describe` 블록
- **상세**: `if (durationMs !== undefined)` 조건은 0을 올바르게 포함시키나, 이 경계값에 대한 테스트가 없다. `durationMs: 0`이 페이로드에 포함되는지 검증하는 케이스가 유익하다.
- **제안**: `totalDurationMs: 0` 케이스를 추가하여 `expect(debug.durationMs).toBe(0)`을 assert한다.

### [INFO] `turnDebugHistory: null` 케이스 미검증
- **위치**: `execution-engine.service.ts`, `?? []` 처리
- **상세**: `state.turnDebugHistory`가 `null`인 경우 `?? []`로 올바르게 처리되지만 테스트에는 `undefined`와 빈 배열만 있다. 런타임에서 DB 역직렬화 시 `null`이 올 수 있는 경로가 있다면 검증이 필요하다.
- **제안**: `{ turnDebugHistory: null }`을 입력으로 하는 테스트를 추가하여 `{}` 반환을 assert한다.

---

## 요약

`buildAiMessageDebugFromResumeState` 헬퍼의 단위 테스트는 주요 분기(마지막 엔트리 추출, 다중 LLM 호출 보존, `turnDebugHistory` 누락/빈 배열, `llmCalls` 필드 부재)를 잘 커버하고 있다. 테스트 격리·가독성도 양호하다. 그러나 서비스 레벨에서 실제로 구 필드(`requestPayload`, `responsePayload`)가 제거되고 신규 필드가 올바른 shape으로 방출되는지를 검증하는 통합 테스트가 없는 것이 핵심 갭이다. 이 부분은 WebSocket 페이로드 계약 변경이므로 회귀 위험도가 있다.

## 위험도

**MEDIUM**