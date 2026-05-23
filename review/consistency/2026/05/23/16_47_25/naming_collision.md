# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/multiturn-error-preserve.md`
검토 일시: 2026-05-23
검토 모드: spec draft (--spec)

---

## 발견사항

### 1. [INFO] `retryAfterSec` — 기존 사용처와 의미 일치, 단 비고란 부재

- **target 신규 식별자**: `output.error.details.retryAfterSec?: number` (node-output.md Principle 3.2 신설 sub-section + ai-agent.md §7.9 JSON 예시 정식화)
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md` line 827 — `"details": { "provider": "anthropic", "statusCode": 429, "retryAfterSec": 30 }` 가 §7.9 JSON 예시 안에 이미 존재. 단, 이 필드는 현재 `node-output.md Principle 3.2` 의 `details` 정의("선택적, 노드별 스키마")에는 정식 등록되어 있지 않고 예시 안에만 비공식으로 존재한다.
- **상세**: target 이 이 필드를 Principle 3.2 의 공식 표준 필드로 격상하는 것은 기존 예시와 의미가 동일(provider Retry-After 헤더 값, 초 단위). 새로운 의미 부여가 아니다.
- **제안**: 충돌 없음. 다만 spec 갱신 시 기존 §7.9 JSON 예시에 `retryAfterSec` 가 이미 나와 있음을 확인하고, 새 Principle 3.2 정의와 §7.9 예시가 필드명·타입·조건(`retryable=true` 일 때만 set)에서 일치하도록 병행 업데이트 필요.

---

### 2. [INFO] `retryable` 필드명 — 백엔드 KB utility 에 동명 지역 변수 존재

- **target 신규 식별자**: `output.error.details.retryable: boolean` (node-output.md Principle 3.2 LLM 계열 노드 한정 필수 필드)
- **기존 사용처**: `codebase/backend/src/modules/knowledge-base/utils/retry-with-backoff.util.ts` lines 79, 103, 105 — `isRetryableLlmError()` 함수 및 지역 변수 `const retryable = isRetryable(err)`. `isRetryable` 은 함수명이고 `retryable` 은 지역 변수.
- **상세**: KB utility 의 `retryable` 은 모듈 내부 지역 변수이며 API payload 필드가 아니다. target 의 `details.retryable` 은 `output.error.details` JSONB 안의 payload 필드명이다. 두 식별자는 코드 영역이 다르고(backend utility 지역 변수 vs output payload 키), 의미적으로도 "LLM 오류가 재시도 가능한가"라는 동일 개념을 다른 계층에서 표현한다. 런타임 충돌 없음.
- **제안**: 충돌 없음. 단, 구현 시 KB utility 와 AI Agent 핸들러의 `retryable` 분류 로직이 동일 기준(429/5xx → true, 401/JSON parse → false)을 공유하는지 코드 리뷰 단계에서 확인 권장.

---

### 3. [INFO] `CLEAR_WAITING` 분리 → `CLEAR_INPUT_AFFORDANCE` / `CLEAR_CONVERSATION_SNAPSHOT` — spec 에 상수명 미노출 정책 확인

- **target 신규 식별자**: `CLEAR_INPUT_AFFORDANCE`, `CLEAR_CONVERSATION_SNAPSHOT` (frontend execution-store 구현 상수, plan 의 "영향 codebase" 표에만 등장)
- **기존 사용처**: `codebase/frontend/src/lib/stores/execution-store.ts` line 265 — `const CLEAR_WAITING = { ... }` 가 현재 정의되어 있으며 `completeExecution`, `failExecution`, `resumeFrom*`, `startExecution` 에서 사용 중.
- **상세**: target plan 은 `CLEAR_WAITING` 을 두 상수로 분리하려 한다. plan Rationale 에서 spec 본문에 상수명을 노출하지 않기로 명시했고(`spec/conventions/conversation-thread.md §9.7` 는 의미만 명세), codebase 변경 범위 내 식별자이다. spec 식별자 충돌이 아니라 구현 식별자 리팩토링이다.
- **제안**: 충돌 없음. `CLEAR_WAITING` 이 현재 7개 호출부에서 spread 되므로 분리 시 누락 없이 전환되었는지 구현 단계에서 검증 필요.

---

### 4. [INFO] `system_error` source — 기존 `system` source 와 의미 분리 명확

- **target 신규 식별자**: `ConversationTurnSource` 열거형에 `"system_error"` 추가 (`spec/conventions/conversation-thread.md §1.1`)
- **기존 사용처**: `spec/conventions/conversation-thread.md` line 19 — `system` 이 "예약 (v1 자동 push 없음)" 으로 이미 정의됨. `codebase/frontend/src/lib/conversation/conversation-utils.ts` line 19 — `"system"` 이 `ConversationTurnSource` 타입에 포함됨.
- **상세**: `system_error` 는 `system` 과 명확히 다른 값이다. spec §1.1 도 "system 은 그대로 reserved 유지, system_error 는 별개 source" 로 구분한다. UI 분기 로직(`§9.1` 시각 매핑 표)에서 두 값은 다른 행으로 처리된다. 코드의 `switch`/`if-else` 에서 `system` 케이스와 `system_error` 케이스가 명시적으로 분리되어야 한다는 점은 구현 요구사항으로 이미 plan 에 명시됨.
- **제안**: 충돌 없음. 구현 단계에서 `conversation-utils.ts` 의 exhaustiveness check 가 `system_error` 를 누락하지 않도록 TypeScript exhaustive union 패턴 확인 권장.

---

### 5. [INFO] `Inv-6` — 기존 `Inv-1`~`Inv-5` 와 네임스페이스 연속

- **target 신규 식별자**: `Inv-6` (conversation-thread.md §9.9 에 신설)
- **기존 사용처**: `spec/conventions/conversation-thread.md` lines 452–456 — `Inv-1`, `Inv-2`, `Inv-3`, `Inv-4`, `Inv-5` 가 이미 정의됨. `Inv-*` 식별자는 §9.10 의 `CT-S*` 와 함께 본 spec 파일 §9.9 스코프 한정으로 명시됨.
- **상세**: `Inv-6` 은 기존 번호 시퀀스의 자연스러운 연장이며 의미 충돌 없음. 기존 `Inv-5` 까지 사용 중이므로 6번은 미할당 상태.
- **제안**: 충돌 없음.

---

### 6. [INFO] `CT-S9`, `CT-S10`, `CT-S11` — 기존 `CT-S1`~`CT-S8` 과 네임스페이스 연속

- **target 신규 식별자**: `CT-S9`, `CT-S10`, `CT-S11` (conversation-thread.md §9.10 신설 시나리오)
- **기존 사용처**: `spec/conventions/conversation-thread.md` lines 464–471 — `CT-S1`~`CT-S8` 이 이미 정의됨. 9~11은 미할당.
- **상세**: 기존 시퀀스의 자연스러운 연장이며 의미 충돌 없음.
- **제안**: 충돌 없음.

---

### 7. [INFO] `execution.retry_last_turn` — 기존 WS 명령 테이블에 미존재, 충돌 없음

- **target 신규 식별자**: WS 명령 `execution.retry_last_turn`, ack `execution.retry_last_turn.ack` (`spec/5-system/6-websocket-protocol.md §4.2` 신규 행)
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md` lines 190–197 — `execution.start`, `execution.stop`, `execution.continue`, `execution.step`, `execution.submit_form`, `execution.click_button`, `execution.submit_message`, `execution.end_conversation` 이 현재 정의됨. `execution.retry_last_turn` 은 없음.
- **상세**: 기존 명령들과 이름이 겹치지 않는다. `execution.` prefix 패턴을 따르고 있어 명명 컨벤션 준수. ack 패턴(`execution.<cmd>.ack`)도 기존 `execution.start.ack`, `execution.click_button.ack` 패턴과 일치.
- **제안**: 충돌 없음.

---

### 8. [INFO] `INVALID_RESUME_TOKEN`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY` 에러 코드 — 기존 코드와 미충돌

- **target 신규 식별자**: WS 에러 코드 `INVALID_RESUME_TOKEN`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY` (`spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표)
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md` lines 231–233 — `INVALID_BUTTON_ID`, `INVALID_EXECUTION_STATE`, `INTERACTION_TIMEOUT` 이 `click_button` 에러 코드로 정의됨. 신규 3종과 겹치지 않음.
- **상세**: `INVALID_RESUME_TOKEN` 은 `INVALID_BUTTON_ID` 와 prefix `INVALID_` 를 공유하지만 완전히 다른 식별자다. 의미(`_retryState` token 미존재/만료)가 명확하게 다르다. `UPPER_SNAKE_CASE` 규약 준수.
- **제안**: 충돌 없음. 다만 `INVALID_RESUME_TOKEN` 명칭에서 "resume"이 `_resumeState` (기존 WF 재개 상태)를 연상시킬 수 있어, 리뷰어에게 이 에러 코드가 `_retryState` (retry 전용) 식별 실패를 의미한다는 점을 §4.2 본문 비고에서 명확히 해두는 것을 권장. plan 에 이미 `"_retryState token 이 DB 에 없거나 만료됨"` 으로 설명이 기재되어 있어 spec 작성 시 그 설명을 그대로 비고에 포함하면 혼동을 방지할 수 있다.

---

### 9. [WARNING] `_retryState` — `_resumeState` 와의 혼동 가능성

- **target 신규 식별자**: `_retryState` (NodeExecution.outputData 내부 필드, `spec/conventions/node-output.md Principle 4.2` + `spec/5-system/4-execution-engine.md §1.3` + `spec/4-nodes/3-ai/1-ai-agent.md §7.4`)
- **기존 사용처**: `spec/conventions/node-output.md` — `_resumeState` 가 Principle 4.2 "폐기할 필드" 섹션에서 공식 내부 필드로 명시됨. `spec/4-nodes/3-ai/1-ai-agent.md` — `_resumeState` 가 §7.4, §6.1, §6.2 전반에 걸쳐 반복 등장하며 multi-turn 재개 내부 상태로 정의됨. `spec/5-system/4-execution-engine.md §1.3` line 87 — "최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다" 고 정의됨.
- **상세**: `_retryState` 와 `_resumeState` 는 이름·구조·목적 모두 매우 유사하다. 둘 다 multi-turn AI Agent 의 내부 상태 snapshot 이고, `_retryState` 는 plan 에서도 "기존 `_resumeState` 동일 구조 + `expiresAt`" 로 설명된다. 그러나 생명주기가 다르다: `_resumeState` 는 `waiting_for_input` 중 in-memory + DB strip, `_retryState` 는 retryable error 종결 후 DB 에 보존(TTL 60분). `stripControlFields()` 가 `_resumeState` 는 제거하지만 `_retryState` 는 보존하도록 분기해야 하므로, 구현 단계에서 "이름이 비슷한 두 필드를 strip 로직이 잘못 처리"하는 버그 위험이 있다.
- **제안**: 기존 `_resumeState` 와 의미 충돌은 없지만 혼동 가능성이 높으므로, `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 의 비고(plan 에 명시된 "두 필드 생명주기 비교 표")를 spec 작성 시 충분히 상세하게 기술할 것. `stripControlFields()` 분기 규칙을 실행 엔진 spec §1.3 에 단일 진실로 명시하여 구현 혼동을 방지. 코드 리뷰 체크리스트에 "strip 로직이 `_retryState` 를 제거하지 않는지" 항목 추가 권장.

---

### 10. [INFO] `retry_last_turn` REST command — 외부 표면 §4.6 매핑 신규 추가

- **target 신규 식별자**: REST body command `retry_last_turn` (`spec/5-system/6-websocket-protocol.md §4.6` 매핑 표 신규 행)
- **기존 사용처**: §4.6 매핑 표 — `submit_form`, `click_button`, `submit_message`, `end_conversation`, `cancel` 이 정의됨. `retry_last_turn` 은 없음.
- **상세**: 기존 REST command 식별자(snake_case)와 충돌 없음. 패턴 일관.
- **제안**: 충돌 없음.

---

### 11. [INFO] `LLM_RATE_LIMITED` sub-case 분리 — 기존 에러 코드 테이블에 이미 존재

- **target 신규 식별자**: `LLM_CALL_FAILED` sub-case 분리 (`5xx → retryable`, `timeout → retryable`, `auth → non-retryable`) 및 `LLM_RATE_LIMITED` (`retryable=true`) 분류 열 추가
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md §10` lines 981–983 — `LLM_CALL_FAILED`, `LLM_RATE_LIMITED`, `LLM_RESPONSE_INVALID` 가 이미 정의됨.
- **상세**: target 은 기존 에러 코드 값(문자열) 자체를 변경하지 않고, 표에 분류 열(retryable 여부)을 추가하고 `LLM_CALL_FAILED` 를 sub-case 3종으로 세분하는 것이다. 코드 값 충돌 없음.
- **제안**: 충돌 없음. `LLM_CALL_FAILED` sub-case 분리 시 기존 코드를 참조하는 FE/BE 코드가 현재 단일 에러 코드로 처리하는지 구현 단계에서 확인 필요.

---

## 요약

target 이 도입하는 신규 식별자(`system_error`, `_retryState`, `execution.retry_last_turn`, `retryable`/`retryAfterSec` payload 필드, `INVALID_RESUME_TOKEN`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY` 에러 코드, `Inv-6`, `CT-S9`/`CT-S10`/`CT-S11`, `CLEAR_INPUT_AFFORDANCE`/`CLEAR_CONVERSATION_SNAPSHOT`) 중 기존 식별자와 동일한 문자열이 다른 의미로 이미 사용되는 경우는 발견되지 않는다. 가장 주의가 필요한 것은 `_retryState` 와 기존 `_resumeState` 의 명명 유사성으로, 두 필드가 서로 다른 생명주기를 가지면서 `stripControlFields()` 분기를 공유하므로 구현 오류 위험이 있다(WARNING). 나머지 발견사항은 모두 INFO 등급으로, spec 작성 시 비고 보완이나 구현 단계 검증으로 충분히 해소 가능하다.

## 위험도

LOW

---

STATUS: SUCCESS
