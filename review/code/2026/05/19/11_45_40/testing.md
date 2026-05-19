# Testing Review — AI Agent Turn Fail Finalize

대상 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`

---

## 발견사항

### [WARNING] `extractAiTurnErrorPayload` static 메서드에 대한 전용 단위 테스트 없음
- 위치: 서비스 내 `private static extractAiTurnErrorPayload(err: unknown)` (diff 206-254행)
- 상세: 해당 메서드는 `err instanceof Error`, `typeof err === 'string'`, `null/undefined`, `number/boolean/bigint`, 임의 객체(JSON.stringify 경로), `details` 필드 직렬화, code 추출 우선순위(명시 code → 429/rate limit → 기본값) 등 7개 이상의 독립적 분기를 가진다. 현재 통합 테스트(`end-to-end: handleAiMessageTurn throw...`)는 `Error` 인스턴스 + 명시 `code` 케이스(`LLM_RATE_LIMIT`) 한 가지만 간접적으로 검증한다. 나머지 분기(non-Error throw, `details` 포함 오류, fallback `AI_AGENT_TURN_FAILED`, `rawMessage.includes('429')` 경로 등)는 커버리지 갭이다.
- 제안: `extractAiTurnErrorPayload` 를 `@internal` 로 export하거나, 동일 파일 내 독립 `describe('extractAiTurnErrorPayload', ...)` 블록을 추가해 분기별 unit test 작성. 특히 `details` 필드에 secret이 포함된 경우 `sanitizeLastErrorMessage`가 올바르게 적용되는지 검증하는 케이스가 필요하다.

### [WARNING] `nodeExec === null` 분기 미테스트 (handleAiTurnError + finalizeAiNode FAILED 경로)
- 위치: `handleAiTurnError` 내 `if (nodeExec)` 블록(diff 179-190행), `finalizeAiNode` FAILED 분기 내 `if (nodeExec)` → `throw new Error('AI Agent turn failed')` (diff 311-352행)
- 상세: `nodeExec`가 `null`일 때(`nodeExecutionRepository.save` 미호출, NODE_FAILED 미발사, 즉시 sentinel throw)의 경로가 현재 테스트에서 검증되지 않는다. 기존 통합 테스트의 픽스처는 항상 `nodeExec`가 존재하는 상황이다. `null` 경로는 엔진 초기화 타이밍 등 엣지 케이스이지만, 해당 분기에서 발생하는 오류 메시지(`'AI Agent turn failed'`)와 DB 미저장 동작은 명시적으로 검증되어야 한다.
- 제안: `nodeExec=null` 상태를 강제하는 픽스처를 구성해 `throw new Error('AI Agent turn failed')` 로 루프가 탈출하고 `EXECUTION_FAILED`가 발사되는 경로를 별도 케이스로 추가.

### [WARNING] `details` 필드 sanitize 로직 테스트 없음
- 위치: `extractAiTurnErrorPayload` 내 `rawDetails` 처리 (diff 243-250행)
- 상세: `details` 포함 오류 객체가 throw될 때, `JSON.stringify` → `sanitizeLastErrorMessage` → `JSON.parse` 체인이 올바르게 동작하는지 검증하는 케이스가 없다. 특히 `details`에 token/secret이 포함된 경우 sanitize가 적용되는지, 또는 `details` 자체가 JSON 직렬화 불가 값(순환참조 등)일 때 어떻게 되는지 불명확하다. 현재 구현은 `JSON.stringify`가 throw하는 경우(순환참조)를 방어하지 않아 예외 처리 경로에서 2차 throw가 발생할 수 있다.
- 제안: (1) `details` 포함 정상 케이스 테스트, (2) secret 포함 `details` sanitize 검증, (3) 방어를 위해 `JSON.stringify(rawDetails)` 호출을 try/catch로 감싸고 직렬화 실패 시 `details` 를 누락시키는 처리 추가 후 테스트.

### [INFO] 통합 테스트가 단일 `flushPromises()` 호출에 의존
- 위치: spec 파일 2396-2397행 (`service.continueAiConversation(executionId, 'trigger error'); await flushPromises();`)
- 상세: 동일 파일의 다른 테스트(spec 2208-2210행)에서 "깊은 Promise 체인 누락 위험"으로 `flushPromises()`를 2회 호출하는 패턴이 이미 주석으로 기록되어 있다. 새 FAILED 경로 테스트는 단일 `flushPromises()` 호출 후 검증하는데, `finalizeAiNode`의 FAILED 분기가 `nodeExecutionRepository.save` 후 `eventEmitter.emitNode`를 호출하고 이어서 sentinel throw가 `runExecution` top-level catch로 전파되는 체인을 고려하면 race condition에 취약할 수 있다. 현재는 통과하지만 환경에 따라 flaky가 될 수 있다.
- 제안: FAILED 시나리오 테스트도 `await flushPromises(); await flushPromises();` 패턴으로 통일하고, 기존 주석(ai-review W4)과 동일한 설명을 추가.

### [INFO] `sanitizeLastErrorMessage` import 위치에 대한 커버리지
- 위치: diff 35행 `import { sanitizeLastErrorMessage } from '../integrations/integration-oauth.service';`
- 상세: `sanitizeLastErrorMessage`는 `integration-oauth.service`에서 export되는 함수로, AI Agent 오류 sanitize 목적으로 cross-module import되고 있다. 해당 함수가 AI turn error 맥락에서 token/secret을 실제로 마스킹하는지 검증하는 테스트가 없다. 기존 OAuth 서비스 테스트가 있겠지만, AI turn error payload에서의 동작은 별도로 확인이 필요하다.
- 제안: `extractAiTurnErrorPayload` 단위 테스트에서 `sanitizeLastErrorMessage`가 token 문자열을 마스킹하는 케이스를 포함.

### [INFO] 기존 `end-to-end: endAiConversation` 테스트의 회귀 가드 유효성
- 위치: spec 2279-2344행
- 상세: 기존 `finalizeAiNode` 정상(`COMPLETED`) 경로 통합 테스트는 새로 추가된 `finalStatus` 파라미터가 기본값 `'COMPLETED'`로 동작하는지를 이미 커버한다. `finalStatus='COMPLETED'` 기본값 변경 회귀에 대해 유효하다.

---

## 요약

핵심 버그 수정 시나리오(processMultiTurnMessage throw → endMultiTurnConversation('error') → NodeExecution.FAILED)에 대한 단일 통합 테스트(`end-to-end: handleAiMessageTurn throw drives...`)가 추가되어 있고, 주요 happy-path 흐름(NODE_FAILED 발사, NODE_COMPLETED 미발사, EXECUTION_FAILED, NodeExecution.status=FAILED 저장)을 검증한다. 그러나 새로 도입된 `extractAiTurnErrorPayload` static 메서드의 분기 로직(7개 타입 분기, code 추출 우선순위, details sanitize)은 단위 테스트가 전무하며 오직 `Error` + 명시 code 케이스만 간접 커버된다. `nodeExec=null` 분기, `details` 필드의 secret sanitize 검증, 순환참조 방어도 누락되어 있다. 현 구조에서 `extractAiTurnErrorPayload`를 private static으로 두면서 분기를 직접 테스트하기 어렵다는 테스트 용이성 문제도 존재한다.

---

## 위험도

MEDIUM
