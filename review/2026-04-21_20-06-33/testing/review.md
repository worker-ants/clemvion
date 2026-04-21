### 발견사항

- **[WARNING]** `stream()` 메서드에 대한 테스트 파일이 없음
  - 위치: `google.client.ts` — 새로 추가된 `stream()` 메서드 (line 192–356)
  - 상세: `google.client.spec.ts`가 `?? src/modules/llm/clients/google.client.spec.ts`로 untracked 상태임. `chat()`은 기존에 테스트가 있었을 가능성이 있으나, `stream()`은 완전히 새로운 복잡한 로직(abort 처리, tool_call emit, usage fallback, finishReason override 등)임에도 커버가 안 됨
  - 제안: `google.client.spec.ts`에 스트리밍 테스트 추가 필요

- **[WARNING]** `mapGoogleFinishReason()`의 테스트 부재
  - 위치: `google.client.ts` line 28–41
  - 상세: `SAFETY`, `RECITATION`, `MAX_TOKENS`, 알 수 없는 값, `undefined` 등 5가지 이상 분기가 있음. pure function이므로 단위 테스트 추가가 매우 쉬움
  - 제안: `mapGoogleFinishReason('MAX_TOKENS')`, `mapGoogleFinishReason('SAFETY')`, `mapGoogleFinishReason(undefined)` 등 케이스별 단위 테스트 추가

- **[WARNING]** `classifyStreamError()`의 테스트 부재
  - 위치: `google.client.ts` line 43–45
  - 상세: 429 포함 여부로 분기하는 로직. `'Error 429 too many requests'`, `'connection refused'` 등 케이스 테스트 필요
  - 제안: pure function이므로 단위 테스트로 커버 가능

- **[CRITICAL]** `stream()` 핵심 시나리오 미테스트
  - 위치: `google.client.ts` stream 메서드 전체
  - 상세: 다음 시나리오들이 테스트되지 않음
    1. **abort 시나리오** — `signal.aborted` 중간 체크로 `finishReason = 'aborted'` 처리 후 `done` 이벤트 emit
    2. **toolCallCount > 0 && finishReason === 'stop'** → `'tool_calls'`로 override되는 분기
    3. **`totalTokens === 0`일 때 aggregated response fallback** 시도 로직
    4. **sendMessageStream 자체에서 throw** 시 error 이벤트 emit
    5. **스트림 도중 throw** 시 abort vs 일반 에러 분기
  - 제안: `@google/generative-ai` SDK를 mock하여 위 시나리오별 테스트 작성

- **[WARNING]** `buildChatInputs()`의 엣지 케이스 미테스트
  - 위치: `google.client.ts` line 95–115
  - 상세: `messages`가 system 메시지만 있는 경우, 빈 배열인 경우, assistant 메시지가 마지막인 경우 등 경계값이 테스트되지 않음
  - 제안: `lastMessage`가 `undefined`가 되는 케이스를 포함한 단위 테스트 추가

- **[WARNING]** `asString()` helper의 테스트 부재
  - 위치: `workflow-assistant-stream.service.ts` line 519–522
  - 상세: `null`, `undefined`, 객체, 배열, 숫자, 정상 문자열 등 다양한 입력에 대해 테스트가 없음. `safeParse()`와 함께 private utility로서 통합 테스트로 커버될 수 있으나 명시적 단위 테스트 권장
  - 제안: module 외부로 export하거나 별도 파일로 분리해 단위 테스트 추가

- **[WARNING]** `safeParse()`의 배열 입력 처리 변경에 대한 회귀 테스트 없음
  - 위치: `workflow-assistant-stream.service.ts` line 510–518
  - 상세: `!Array.isArray(parsed)` 조건이 추가됨. 이전에는 배열이 `{}` 대신 배열로 반환되었을 수 있음. 기존 `workflow-assistant-stream.service.spec.ts`에서 이 케이스를 커버하는지 확인 필요
  - 제안: `safeParse('[1,2,3]')` → `{}`를 반환함을 검증하는 테스트 추가

- **[INFO]** `redactConfig()`의 변경은 타입 정확성 fix이므로 기존 테스트로 커버 가능
  - 위치: `redact.ts` line 16
  - 상세: 런타임 동작 변경 없음. `as unknown[]` 캐스팅은 TypeScript 컴파일러 만족용. 기존 테스트가 있다면 통과할 것
  - 제안: 별도 조치 불필요. 단, `redact.ts`에 대한 테스트 파일이 있는지 확인 필요

- **[INFO]** `workflow-assistant-stream.service.spec.ts`가 수정된 상태이나 내용 미확인
  - 위치: git status — `M src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts`
  - 상세: `asString` 도입, `safeParse` 변경, `buildPlanFromArgs` 수정에 대한 회귀 커버 여부 불명확
  - 제안: 스펙 파일 내용을 확인하여 변경된 로직이 실제 커버되는지 검토 필요

---

### 요약

가장 큰 위험은 **`GoogleClient.stream()`의 완전한 테스트 부재**다. 이 메서드는 abort 처리, 스트리밍 중 에러, tool call finishReason override, usage fallback 등 복잡한 분기를 포함하며, 이 모든 경로가 현재 테스트되지 않고 있다. `google.client.spec.ts` 파일이 untracked 상태로 존재하지만 실제 내용이 커밋되지 않은 점을 고려하면, 핵심 스트리밍 로직이 완전히 검증되지 않은 채로 머지될 위험이 있다. `mapGoogleFinishReason`, `classifyStreamError`, `asString`, `safeParse` 등은 pure function이어서 단위 테스트 비용이 낮음에도 누락되어 있다. `workflow-assistant-stream.service.ts`의 변경사항은 spec 파일이 함께 수정되었으므로 상대적으로 낫지만, `safeParse` 배열 처리 변경에 대한 명시적 회귀 케이스 추가를 권장한다.

### 위험도

**HIGH**