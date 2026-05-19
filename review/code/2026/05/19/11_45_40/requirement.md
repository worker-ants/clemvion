# 요구사항(Requirement) 리뷰 결과

## 리뷰 대상

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`

변경 목적: AI Agent multi-turn 대화 중 handler throw (LLM 429 등) 발생 시
`NodeExecution.status = WAITING_FOR_INPUT` 영구 잔류 회귀를 차단하고,
`finalizeAiNode` 가 FAILED 분기로 진입해 정상 FAILED 상태로 마무리하도록 한다.

---

## 발견사항

### [CRITICAL] `output.error` 필드 누락 — ai-agent 핸들러

- 위치: `handleAiTurnError` (line ~2451), `ai-agent.handler.ts` `endMultiTurnConversation` (line 1806)
- 상세:
  `handleAiTurnError` 는 `handler.endMultiTurnConversation(resumeState, 'error', errorPayload)` 를
  세 번째 인자 `errorPayload`와 함께 호출한다. 그러나 `ResumableNodeHandler` 인터페이스와
  `AiAgentHandler.endMultiTurnConversation` 구현은 두 번째 인자까지만 선언되어 있으므로
  `errorPayload`는 완전히 무시된다.

  결과적으로 ai_agent 핸들러가 `endReason='error'`로 반환하는 출력에는 `output.error` 가
  없고 `output.result`만 존재한다. 이는 spec §7.9 의 다음 요구를 위반한다:

  > `output.error: { code, message, details }` 가 존재해야 하며
  > `output.result.*` 와 병존 가능하다.

  `finalizeAiNode` FAILED 분기에서 `nodeExec.error.message` 를 읽을 때
  `finalOutput.output?.error?.message` 경로가 `undefined` 로 되어 항상
  fallback `'AI Agent turn failed'` 로 처리된다 (실제 오류 코드·메시지 소실).

  비교: `information-extractor.handler.ts` 는 동일 상황에서 `output.error` 를 명확히
  채워 반환하므로 이 문제는 ai_agent 핸들러에 한정된다.

- 제안:
  1. `ResumableNodeHandler.endMultiTurnConversation` 시그니처에 선택적 세 번째 인자를 추가:
     ```typescript
     endMultiTurnConversation(
       state: Record<string, unknown>,
       endReason: 'user_ended' | 'max_turns' | 'condition' | 'error',
       errorPayload?: { code: string; message: string; details?: unknown },
     ): unknown;
     ```
  2. `AiAgentHandler.endMultiTurnConversation` 구현에서 `endReason === 'error'` 일 때
     `errorPayload` 를 `output.error` 로 주입하도록 `buildMultiTurnFinalOutput` 를 수정.
  3. 또는 엔진 레이어에서 `adaptHandlerReturn(errorResult)` 결과에 `output.error` 를
     직접 merge 하는 post-processing 추가.

---

### [WARNING] `handleAiTurnError` 반환 타입과 실제 호출 경로 — `resumeState` 반환값

- 위치: `handleAiTurnError` 반환 `{ resumeState, ended: true, finalStatus: 'FAILED' }`
- 상세:
  `handleAiTurnError` 는 turn 처리 실패 시 `resumeState` (오류 발생 직전의 입력 상태)를
  그대로 반환한다. `waitForAiConversation` 의 loop 는 `resumeState = turn.resumeState` 로
  이를 받지만 `conversationEnded = true` 이므로 다음 turn 에서 쓰이지 않는다.

  단, `finalizeAiNode` 에서 `context.structuredOutputCache[node.id]` 를 최종 출력으로
  읽는 경로는 `handleAiTurnError` 가 이미 error 결과로 cache 를 갱신했기 때문에 정상
  동작한다. 기능적으로 문제없으나, `resumeState` 를 반환하는 것이 의도와 일치하는지
  문서화가 부족하다.

---

### [WARNING] `nodeExec` null 경로에서 NODE_FAILED 이벤트 미발사

- 위치: `finalizeAiNode` FAILED 분기, line ~2637 (`throw new Error('AI Agent turn failed')`)
- 상세:
  `nodeExec`가 null 인 경우 (DB 조회 실패·race 등) NODE_FAILED 이벤트를 발사하지 않고
  바로 throw 한다. `runExecution` catch 가 `EXECUTION_FAILED` 는 발사하지만
  프론트엔드가 기대하는 `NODE_FAILED` 이벤트는 누락된다.

  `handleAiTurnError` 에서도 `nodeExec`가 null 이면 `endMultiTurnConversation` 는 호출하지만
  DB 저장 없이 반환한다 — 이는 올바른 동작이지만 기존 `waitForAiConversation` 의 null nodeExec
  경고와 대칭적으로 warn 로그가 없다.

- 제안: `nodeExec`가 null 인 FAILED 경로에도 warn 로그 추가 및 NODE_FAILED 발사 여부 검토.

---

### [WARNING] `extractAiTurnErrorPayload` — `details` 의 JSON.parse 실패 경로

- 위치: `extractAiTurnErrorPayload` line ~2530
  ```typescript
  JSON.parse(sanitizeLastErrorMessage(JSON.stringify(rawDetails)))
  ```
- 상세:
  `rawDetails`가 순환 참조를 가진 객체거나 `JSON.stringify` 가 실패하면 (비정상적이지만
  가능) `JSON.parse` 까지 도달하지 못하고 예외가 발생한다. 이 예외는 `handleAiMessageTurn`
  의 try/catch 블록 밖에서 (`handleAiTurnError` 내부에서) 발생하므로 catch 되지 않아
  `waitForAiConversation` 의 while loop 가 처리되지 않은 예외로 종료된다.

  그 결과는 원래 회귀 (catch 없는 propagate) 와 동일한 WAITING_FOR_INPUT 영구 잔류 위험이다.

- 제안: `extractAiTurnErrorPayload` 내부의 JSON 직렬화를 try/catch 로 보호하고
  실패 시 `details: '[Serialization error]'` 등의 안전한 fallback 을 사용.

---

### [INFO] `sanitizeLastErrorMessage` 의 크로스 모듈 import

- 위치: line 49 `import { sanitizeLastErrorMessage } from '../integrations/integration-oauth.service'`
- 상세:
  `sanitizeLastErrorMessage` 는 OAuth 서비스의 내부 유틸리티로 정의되어 있으나 실행 엔진이
  직접 import 한다. 기능적으로 문제없으나 cohesion 측면에서 공유 유틸리티로 분리하는 것이
  장기적으로 적합하다. 현 시점의 요구사항 충족에는 영향 없음.

---

### [INFO] `endMultiTurnConversation` 호출 시 TypeScript 컴파일러 에러 없음

- 위치: `handleAiTurnError` line ~2451
- 상세:
  TypeScript는 함수 호출 시 정의된 파라미터보다 많은 인자를 전달하면 컴파일 에러를 발생시킨다.
  현재 코드에서 3번째 인자 `errorPayload` 전달이 컴파일 에러 없이 통과한다면,
  `ResumableNodeHandler` 인터페이스가 이미 선택적 3번째 파라미터를 허용하고 있거나
  타입 캐스팅이 개입되어 있다는 의미다. 실제로는 인터페이스 정의가 2-parameter 이므로
  TypeScript strict 모드에서 컴파일 에러가 발생할 가능성이 있다. CI 에서 확인 필요.

---

## 요약

핵심 회귀 — AI Agent multi-turn 중 handler throw 가 `NodeExecution.status = WAITING_FOR_INPUT`
영구 잔류를 유발하던 문제 — 는 `handleAiTurnError` → `finalStatus='FAILED'` 신호 → `finalizeAiNode`
FAILED 분기 throw → `runExecution` catch 의 흐름으로 올바르게 차단된다. 상태 전이 시퀀스
(NodeExecution FAILED → NODE_FAILED 이벤트 → sentinel throw → Execution FAILED → EXECUTION_FAILED
이벤트) 도 의도대로 설계되어 있다.

그러나 **CRITICAL** 발견사항으로, `ai-agent` 핸들러의 `endMultiTurnConversation` 이 세 번째
`errorPayload` 인자를 무시해 `output.error` 가 빈 상태로 spec §7.9 를 위반한다. 이로 인해
FAILED 된 AI Agent 노드의 오류 코드·메시지가 항상 fallback `'AI Agent turn failed'` 로
오버라이드 되어, 프론트엔드가 표시하는 오류 내용이 실제 오류 원인 (예: LLM_RATE_LIMITED,
LLM_CALL_FAILED) 과 불일치한다. 추가로 `extractAiTurnErrorPayload` 내부의 JSON 직렬화
예외 처리 누락이 원래 회귀를 재현할 수 있는 엣지 케이스로 남아 있다.

## 위험도

HIGH
