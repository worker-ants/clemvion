## 발견사항

### [CRITICAL] `send-email.handler.ts` — 에러 코드 분기 dead code
- **위치:** `send-email.handler.ts` catch 블록 `const code = ...` 할당부
- **상세:** `err instanceof IntegrationError ? 'EMAIL_SEND_FAILED' : 'EMAIL_SEND_FAILED'` — 두 분기가 동일한 값을 반환하는 dead code. `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED`, `INTEGRATION_INCOMPLETE` 케이스는 `details.integrationCode`로만 구분되며 `output.error.code` 는 항상 `EMAIL_SEND_FAILED`. 테스트가 `output.error.code` 를 검증하지 않아 이 버그를 잡지 못하고 있음.
- **제안:**
  ```typescript
  // 추가할 테스트
  expect(result.output.error.code).toBe('EMAIL_SEND_FAILED');
  // 그리고 핸들러 수정:
  const code = err instanceof IntegrationError
    ? err.code          // INTEGRATION_TYPE_MISMATCH 등을 보존
    : 'EMAIL_SEND_FAILED';
  ```

### [CRITICAL] `handler-output.adapter.ts` — `_resumeState` 처리 경로 테스트 전무
- **위치:** `adaptHandlerReturn` bare-object 분기 및 `toEngineFlatShape` 3개 분기
- **상세:** `_resumeState` 를 리프트하는 3개 코드 경로가 추가됐으나 어댑터 스펙 파일이 diff 에 없음. 특히 아래 엣지 케이스가 무방비:
  - `_resumeState` 가 `null` 인 경우 → 조건 `!== null` 으로 올바르게 스킵되는지
  - `_resumeState` 가 배열인 경우 → `!Array.isArray` 로 스킵되는지
  - `toEngineFlatShape` 에서 `adapted._resumeState` 가 이미 `base` 에 있으면 덮어쓰지 않는 로직
- **제안:** `handler-output.adapter.spec.ts` 에 `_resumeState` 관련 케이스 추가 필수.

### [CRITICAL] `code.handler.ts` — 에러 코드 정규화 검증 누락
- **위치:** `code.handler.spec.ts` error 케이스 4개 (`CODE_RUNTIME_ERROR`, `CODE_SYNTAX_ERROR`, `EXECUTION_TIMEOUT` ×2)
- **상세:** 핸들러가 `errorCode` 를 정규화(`CODE_RUNTIME_ERROR` → `CODE_EXECUTION_FAILED`, `EXECUTION_TIMEOUT` → `CODE_TIMEOUT`)하지만 테스트는 `output.error` 가 정의되어 있는지와 `port === 'error'` 만 확인. `output.error.code` 의 실제 값을 검증하는 단언이 없어 정규화 로직의 정확성이 보장되지 않음.
- **제안:**
  ```typescript
  expect((result.output as any).error.code).toBe('CODE_EXECUTION_FAILED'); // CODE_RUNTIME_ERROR 케이스
  expect((result.output as any).error.code).toBe('CODE_TIMEOUT');          // EXECUTION_TIMEOUT 케이스
  ```

---

### [WARNING] `http-request.handler.spec.ts` — URL 새니타이징 누락 케이스
- **위치:** `sanitizeUrlCredentials` 함수 + 신규 테스트
- **상세:** 새 테스트가 자격증명이 있는 정상 URL 만 커버. regex 폴백 경로(malformed URL)와 자격증명이 없는 URL(변경 없어야 함)에 대한 테스트가 없음. 또한 fetch throw 시 `catch` 블록의 URL 새니타이징(`sanitizeUrlCredentials` 재호출)도 미검증.
- **제안:** 3가지 케이스 추가: `ftp://user@host/path` (비표준), `https://api.example.com/path` (자격증명 없음 — 무변환 검증), throw 경로에서의 config.url 값.

### [WARNING] `information-extractor.schema.spec.ts` — 새 waiting shape 미검증
- **위치:** `'accepts multi-turn waiting output (legacy resume fields retained for Stage 2)'` 테스트
- **상세:** spec이 새 waiting shape(`output.partial.*`)을 정의했으나 스키마 테스트는 여전히 legacy `conversationConfig` 형태만 검증. `output: { messages: [...], partial: { extracted, missingFields } }` 형태의 픽스처 테스트가 없어 schema passthrough 로 인해 신규 shape 검증이 무의미.
- **제안:** 신규 waiting shape 픽스처 테스트 추가.

### [WARNING] `output-shape.ts` — `isConversationOutput` 신규 경로 미검증
- **위치:** `output-shape.test.ts` / `isConversationOutput` 의 `looksLikeConversationEnd` 분기
- **상세:** `looksLikeConversationEnd` 조건(`hasResultMessages && endReason in [...]`)이 추가됐으나 해당 경로를 직접 테스트하는 케이스가 없음. `meta.interactionType` 없이 `output.result.messages` + `endReason: 'completed'` 조합이 `true` 를 반환하는지 검증 필요.

### [WARNING] `conversation-utils.ts` / `conversation-inspector.tsx` — 이중 경로 fallback 미검증
- **위치:** `parseHistoryMessages`, `SummaryView`, `FormSubmittedContent`
- **상세:** `output.result.messages`(신규) → `output.messages`(레거시) 순서의 fallback 로직이 프론트엔드 여러 곳에 추가됐으나 단위 테스트 없음. `conversation-utils.ts` 는 복잡한 `debugByTurn` 빌드 로직도 포함하는데 `meta.turnDebug` 경로가 검증되지 않음.

### [WARNING] 컨테이너 `Parallel` 노드 출력 형태 미검증
- **위치:** `execution-engine.service.spec.ts`
- **상세:** spec이 `{ branches: [...], count: N }` 형태를 정의했고 ForEach/Loop/Map 테스트는 업데이트됐으나 Parallel 컨테이너의 `done` 포트 출력 형태 검증이 누락.

---

### [INFO] `workflow.handler.spec.ts` — sync 에러 시 `_executedNodes` 미존재 케이스
- **위치:** `execute - error propagation` describe 블록
- **상세:** `context._executedNodes` 가 undefined 인 경우 throw가 발생하는 라인이 있으나 이 경로가 `buildSubWorkflowError` 로 리팩토링되지 않아 여전히 throw. 테스트 없음.

### [INFO] `node-output-schema-enrichers.test.ts` — 경로 누락 시 fallback 케이스 부재
- **위치:** `enrichInfoExtractorOutputSchema`
- **상세:** `output.result` 노드가 없을 때 새로 생성하는 분기가 추가됐으나 `output.result` 는 있지만 `output.result.extracted` 가 없는 중간 케이스 테스트가 없음.

### [INFO] `durationMs: 0` 하드코딩
- **위치:** carousel/chart/table/template 핸들러의 buttons 분기 `meta`
- **상세:** 대기 상태 핸들러가 `durationMs: 0` 을 반환하는 것은 의미상 부정확하지만 테스트에서 이 값이 맞는지 검증하지 않고 `toMatchObject` 로 존재만 확인. 실제 측정값이 필요한지 여부를 스펙과 맞출 필요 있음.

---

## 요약

이번 변경은 노드 출력 형식을 `{ config, output: { result|error }, meta }` 로 통일하는 대규모 리팩토링으로, 대부분의 핸들러 테스트가 신규 shape 을 올바르게 반영하고 있습니다. 그러나 `send-email` 의 에러 코드 분기 dead code (테스트 미검증), `handler-output.adapter` 의 `_resumeState` 경로 미검증, `code.handler` 의 에러 코드 정규화 단언 누락이 Critical 수준으로 확인됩니다. Legacy fallback 경로는 다수 존재하나 대부분 프론트엔드 유틸리티 레벨에서 단위 테스트가 없으며, 신규 waiting shape(`output.partial.*`)이 스키마 테스트에 반영되지 않은 점도 보완이 필요합니다.

## 위험도

**HIGH**