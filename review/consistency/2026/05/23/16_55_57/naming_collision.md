# 신규 식별자 충돌 검토 — multiturn-error-preserve

> 검토 대상: `plan/in-progress/multiturn-error-preserve.md`
> 검토 모드: spec draft 검토 (--spec)
> 검토일: 2026-05-23

---

## 발견사항

### 1. `CLEAR_INPUT_AFFORDANCE` / `CLEAR_CONVERSATION_SNAPSHOT` — spec 본문 상수명 비노출 정책과 실제 plan 본문 간 이중 기재 (INFO)

- **target 신규 식별자**: `CLEAR_INPUT_AFFORDANCE`, `CLEAR_CONVERSATION_SNAPSHOT` (plan §A, 영향 codebase 표)
- **기존 사용처**: plan 본문 §A 작업 축 단락, 영향 codebase 표, Rationale "상수명을 spec 본문에 노출하지 않는 이유" 절
- **상세**: target plan 의 Rationale 에서 "spec §9.7 본문은 store reset 정책의 의미만 명세하고 상수명은 plan 의 영향 codebase 표 + 코드 inline 주석에 둔다" 라고 명시한다. plan 문서 자체에 상수명이 등장하는 것은 이 정책과 직교하므로 충돌이 아니다. 다만 코드 충돌 리스크: `execution-store.ts` 에 기존 `CLEAR_WAITING` 상수가 있고 plan 이 이를 두 상수로 분리한다고 한다. 기존 코드베이스에 `CLEAR_WAITING` 이 다른 의미로 사용되는 영역이 있는지 spec 코퍼스에서 직접 확인할 수 없으나, plan 이 기존 단일 상수를 두 상수로 **교체**하는 구조이므로 신규 이름이 기존 이름과 충돌하지는 않는다.
- **제안**: 충돌 없음. 단, 코드 리뷰 단계에서 `CLEAR_WAITING` 의 기존 사용처가 모두 두 신규 상수 중 하나로 올바르게 교체되었는지 확인 권장.

---

### 2. `system_error` — `ConversationTurnSource` 신규 값 vs. 기존 `system` 예약값 (WARNING)

- **target 신규 식별자**: `system_error` (새 `ConversationTurnSource` 값, §B 작업 축, conversation-thread §1.1)
- **기존 사용처**: `spec/conventions/conversation-thread.md §1.1` 에 `system` 이 "예약 (v1 자동 push 없음)" 으로 등록되어 있음. corpus 의 `ai-presentation-tools.md` 에서 `source: 'ai_assistant'`, `presentation_user` 등 기존 source 타입이 사용됨.
- **상세**: `system` 과 `system_error` 는 서로 다른 source 값이며 plan 의 Rationale 에서 이를 명확히 설명한다. 두 이름이 `system` prefix 를 공유하기 때문에 코드의 `startsWith('system')` 등 패턴 매칭에서 의도치 않은 포함이 발생할 수 있다. `interaction-type-registry.md §2.1` 에 명시적 exhaustiveness 체크가 요구되므로 switch/if-else 분기 누락은 compile-time 에 잡힌다. 주요 위험은 렌더링 컴포넌트나 분기 로직에서 `source === 'system'` 으로만 판단하는 코드가 `system_error` 를 잘못 흡수하거나 누락하는 것이다.
- **제안**: `interaction-type-exhaustiveness.test.ts` 에 `system_error` 를 명시적 케이스로 추가 (plan 에 이미 기재되어 있음). 렌더링 컴포넌트의 `source === 'system'` 비교가 `system_error` 를 잘못 포함하지 않는지 구현 시 확인 권장.

---

### 3. `execution.retry_last_turn` WS 명령 — 기존 `submit_form` / `click_button` 명명 패턴과의 일관성 (INFO)

- **target 신규 식별자**: `execution.retry_last_turn` (WS 명령), `execution.retry_last_turn.ack` (ack 이벤트명)
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md §4.2` 에 기존 실행 제어 명령: `execution.submit_form`, `execution.click_button`, `execution.submit_message`, `execution.end_conversation`. ack 패턴: `execution.submit_form.ack` 등. `execution.node.failed`, `execution.node.completed`, `execution.node.started` 등 서버→클라이언트 이벤트.
- **상세**: 기존 명령들은 모두 `execution.<동사>_<명사>` 패턴 (예: `submit_form`, `click_button`, `submit_message`, `end_conversation`). `retry_last_turn` 은 `<동사>_<형용사>_<명사>` 패턴으로 기존 패턴보다 한 단어 더 길다. 의미는 명확하나 명명 스타일이 소폭 다르다.
- **제안**: 충돌 없음. `retry_turn` 단축형도 고려할 수 있으나 plan 에서 이미 `retry_last_turn` 으로 확정되어 `nodeExecutionId` 를 활용한다는 근거가 §4.2 비고에 기재되어 있으므로 그대로 사용 가능. INFO 수준.

---

### 4. `_retryState` — 기존 `_resumeState` 와의 naming 구분 (INFO)

- **target 신규 식별자**: `_retryState` (NodeExecution.outputData 내 internal 필드, handler return top-level 필드)
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 에 `_resumeState` 가 이미 정의되어 있음. `spec/5-system/4-execution-engine.md §1.3` 에 `stripControlFields()` 가 `_resumeState` 를 제거하는 정책.
- **상세**: `_resumeState` 와 `_retryState` 는 prefix `_re` 를 공유한다. 역할은 다르다 — `_resumeState` 는 `waiting_for_input` 중 in-memory 유지 후 DB 영속 시 strip. `_retryState` 는 retryable error 종결 시 DB 에 영속 후 TTL 만료 또는 retry 시 소비. 두 필드가 모두 `NodeExecution.outputData` JSONB 안에 존재할 수 있는 상황은 없다 (retryable error 종결 시 `_resumeState` 는 이미 strip 됨) 따라서 같은 row 에 공존하는 충돌은 없다. `stripControlFields()` 가 `_retryState` 를 선별적으로 보존해야 하므로 구현 시 `_re` 로 시작하는 필드를 일괄 제거하는 패턴이 있다면 수정 필요.
- **제안**: `stripControlFields()` 구현에서 `_resumeState` 제거 조건을 명확히 `field === '_resumeState'` 와 같이 완전 일치 방식으로 작성하고 `_retryState` 는 별도 보존 분기로 처리하도록 구현 단계에서 확인 권장.

---

### 5. `INVALID_RESUME_TOKEN` 에러 코드 — "RESUME_TOKEN" 이름이 실제 구조와 불일치 (WARNING)

- **target 신규 식별자**: `INVALID_RESUME_TOKEN` (WS ack 에러 코드, spec §5-system/6-websocket-protocol.md §4.2)
- **기존 사용처**: spec corpus 에서 `resumeToken` 필드를 사용하는 맥락: plan §C 내 R1 결정에서 "resumeToken 필드는 plan 초안에서 제거"라고 명시되어 있음. `_retryState` 가 그 역할을 대체. WS payload 는 `nodeExecutionId` 만으로 식별.
- **상세**: plan 내 결정 완료 사항에서 "token 의 추가 의미가 없어 spec 면적·보안 표면 모두 축소"하여 `resumeToken` 을 제거했다. 그러나 에러 코드 이름 `INVALID_RESUME_TOKEN` 에는 여전히 `RESUME_TOKEN` 이라는 단어가 남아 있다. plan 본문은 "INVALID_RETRY_STATE 보다 일반적 의미를 표현해 유지 — 본 의미를 §4.2 에 명시"라고 설명하지만, 외부 개발자나 새 팀원 입장에서 `RESUME_TOKEN` 이라는 단어는 실제로 존재하지 않는 `resumeToken` 필드를 연상시켜 혼선을 줄 수 있다.
- **제안**: `INVALID_RETRY_STATE` 또는 `RETRY_STATE_NOT_FOUND` 로 변경을 재검토하거나, §4.2 비고에 "이 코드 이름은 token 이 아닌 `_retryState` DB row 의 만료/부재를 의미하며 `resumeToken` 필드는 payload 에 존재하지 않는다" 를 명시하여 혼선을 방지하도록 권장.

---

### 6. `retryable` / `retryAfterSec` — `output.error.details` 기존 필드 공간과의 충돌 검토 (INFO)

- **target 신규 식별자**: `retryable: boolean`, `retryAfterSec?: number` (`output.error.details` 하위 표준 필드, node-output.md Principle 3.2)
- **기존 사용처**: `spec/conventions/node-output.md Principle 3.2` 에 기존 "노드별 선택 스키마" 가 정의되어 있음. `spec/1-data-model.md §2.10` 의 `Integration.last_error: JSONB { code, message, at, details? }` 에서 `details` 가 자유 형식으로 사용됨.
- **상세**: `details.retryable` 은 새로운 표준 필드지만, 기존에 `details` 를 사용 중인 비-LLM 노드들이 우연히 `retryable` 이라는 이름의 다른 의미 필드를 사용 중일 가능성을 배제할 수 없다. 단, corpus 에서 확인된 `details` 사용처는 Integration.last_error 의 `details.requiresCafe24Approval: string[]` 뿐이며, 이 맥락에서 `retryable` 과 겹치지 않는다.
- **제안**: 구현 단계에서 `ai-agent.handler.ts` 외 기타 노드 핸들러의 `details` 사용처를 검색하여 `retryable` 키 충돌이 없는지 확인 권장. 충돌 없을 가능성이 높으나 확인 절차를 명시적으로 수행 권장.

---

### 7. `LLM_RATE_LIMITED` — 신규 에러 코드 vs 기존 에러 코드 체계 (INFO)

- **target 신규 식별자**: `LLM_RATE_LIMITED` (retryable=true 분류, ai-agent §10 에러 코드 표에 sub-case 분리)
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md §10` 에 `LLM_CALL_FAILED` 에러 코드가 현재 등록되어 있음. `LLM_RESPONSE_INVALID` 도 같은 표에 존재. corpus 에서 `LLM_RATE_LIMITED` 는 현재 spec 에 없고 plan 에서 신규로 도입됨.
- **상세**: 기존 `LLM_CALL_FAILED` 의 sub-case 분리 맥락에서 HTTP 429 케이스에 `LLM_RATE_LIMITED` 를 추가하는 것이다. 현재 spec 상 `LLM_CALL_FAILED` 가 HTTP 429 를 포함해 광범위하게 사용되고 있다면, 기존 코드가 `LLM_CALL_FAILED` 로 emit 하던 것을 `LLM_RATE_LIMITED` 로 바꿀 경우 `error` 포트에 연결된 다운스트림 노드나 외부 클라이언트의 에러 코드 비교 로직에 breaking change 가 발생할 수 있다.
- **제안**: `LLM_RATE_LIMITED` 를 신규 독립 코드로 추가하되, 기존 `LLM_CALL_FAILED` 가 쓰이던 컨텍스트에서 429 만 골라 새 코드로 emit 할 때 외부에 영향을 주는지 명확히 확인 권장. 기존 에러 코드 표를 "대체" 가 아니라 "sub-case 분리 + 기존 코드 유지 (5xx/timeout/auth 는 여전히 LLM_CALL_FAILED)" 패턴으로 관리하면 breaking change 없이 처리 가능.

---

### 8. `CT-S9` / `CT-S10` / `CT-S11` — 기존 `CT-S1~S8` 과의 번호 충돌 검토 (INFO)

- **target 신규 식별자**: `CT-S9`, `CT-S10`, `CT-S11` (conversation-thread §9.10 회귀 차단 시나리오)
- **기존 사용처**: `plan/in-progress/ai-presentation-tools.md` §4.7 에서 `/ai-review 실행` 을 언급하고, 동 plan 에서 `ai-presentation-tools.md` 가 `spec/conventions/conversation-thread.md §9.6` / `§9.10` 을 수정했음을 의존성 주석에서 언급함 (multiturn plan §의존성·리스크 절). ai-presentation-tools 가 main 머지 완료 (PR #269) 되었으므로 현재 §9.10 에 CT-S1~S8 이 이미 존재할 수 있음.
- **상세**: target plan 은 CT-S9/S10/S11 을 §9.10 에 신설한다고 명시한다. ai-presentation-tools plan 이 CT-S1~S8 에 해당하는 시나리오를 §9.10 에 추가했다면 번호 연속성은 유지된다. 두 plan 의 의존성 주석에서 "기존 §9.10 의 CT-S1~S8 fixture 와 정합 확인"이 명시되어 있으므로 파악은 되어 있다.
- **제안**: 구현 전 실제 `spec/conventions/conversation-thread.md §9.10` 의 현재 내용을 확인하여 CT-S1~S8 의 마지막 번호를 확인하고, CT-S9 시작이 연속성을 유지하는지 검증 권장.

---

### 9. `Inv-6` — 기존 `Inv-1~Inv-5` 번호 연속성 (INFO)

- **target 신규 식별자**: `Inv-6` (conversation-thread §9.9 신규 invariant)
- **기존 사용처**: `spec/conventions/conversation-thread.md §9.9` 에 현재 5개의 invariant(Inv-1~Inv-5) 가 정의되어 있다고 plan 이 설명한다.
- **상세**: plan 에서 "§9.9 의 5개 invariant 와 같은 의무 강도"라고 명시하고 있으며, Inv-6 추가가 연속 번호임을 내포한다. 번호 충돌 위험은 없다.
- **제안**: 충돌 없음. 구현 전 실제 spec 파일에서 Inv-5 까지만 존재하는지 확인 권장.

---

### 10. `nodeExecutionId` vs `nodeId` — WS 명령 payload 필드명 패턴 변경 (WARNING)

- **target 신규 식별자**: `nodeExecutionId` (execution.retry_last_turn payload 필드)
- **기존 사용처**: 기존 WS 실행 제어 명령 (`submit_form` / `click_button` / `submit_message` / `end_conversation`) 의 payload 는 모두 `{ executionId, nodeId }` 패턴. `spec/5-system/6-websocket-protocol.md §4.2`.
- **상세**: plan 에서 `nodeId` 대신 `nodeExecutionId` 를 사용하는 이유를 명확히 설명한다 ("동일 nodeId 의 새 NodeExecution row 를 spawn 하므로 row 단위 식별자가 필요"). 그러나 기존 WS 명령 처리 코드가 `{ executionId, nodeId }` 를 기대하는 공통 미들웨어나 파서를 사용한다면, `retry_last_turn` 이 `nodeId` 없이 `nodeExecutionId` 만 보내는 것이 파서/검증 로직에서 예외 처리를 유발할 수 있다.
- **제안**: WS 명령 라우터에서 `retry_last_turn` 이 별도의 payload 스키마 검증 경로를 갖도록 구현 시 확인 권장. 특히 공통 `nodeId` 필드가 required 로 검증되는 미들웨어가 있다면 `retry_last_turn` 을 제외 처리해야 한다.

---

## 요약

`multiturn-error-preserve` plan 이 도입하는 신규 식별자들은 기존 spec 영역과 직접 이름 충돌을 일으키는 경우가 없다. 가장 주목할 점은 두 가지다: (1) `INVALID_RESUME_TOKEN` 에러 코드명에서 실제로 제거된 `resumeToken` 필드 개념이 이름 안에 잔류하여 개발자 혼선 가능성이 있다 (WARNING). (2) `execution.retry_last_turn` 의 payload 가 기존 WS 명령 패턴에서 사용하는 `nodeId` 대신 `nodeExecutionId` 를 사용하므로, 공통 payload 검증 레이어가 있다면 예외 처리가 필요하다 (WARNING). `system_error` source 는 `system` 과 prefix 를 공유하나 exhaustiveness test 로 보호되어 있고, `_retryState` 와 `_resumeState` 의 유사 naming 은 `stripControlFields()` 구현에서 주의가 필요하다. 전반적으로 critical 한 식별자 충돌은 없으며 WARNING 2건 / INFO 8건 수준이다.

---

## 위험도

LOW
