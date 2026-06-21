# Rationale 연속성 검토 결과

검토 모드: --impl-done (scope=spec/4-nodes/3-ai, diff-base=origin/main)
대상 구현: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (신규) + `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (개정)

---

## 발견사항

### 발견사항 없음 — Rationale 연속성 위반 0건

분석 결과 아래 4개 관점 모두 위반 사항이 발견되지 않았다.

---

### 점검 관점별 상세

#### 1. 기각된 대안의 재도입

**점검 대상 과거 결정**:

- `plan/in-progress/refactor/02-architecture.md §M-1` 은 AiAgentHandler god-handler 분할을 세 옵션(A=단계별 추출, B=빅뱅 단일 PR, C=보류)으로 검토하고 **Option A(단계별 strangler-fig)** 를 채택하며 B·C를 기각했다. 특히 B(빅뱅 단일 PR)는 "9,670줄 대상 단일 PR 회귀 위험 집중"을 이유로 기각.
- `plan/in-progress/refactor/02-architecture.md §M-1` 은 AiTurnExecutor를 `nodes/ai/ai-agent/` 하위에 co-locate하도록 결정했고, `ai/shared/` 승격은 "실공유가 확인되는 시점으로 미루는 것이 안전"하다고 기각 대안으로 명시.
- C-1의 엔진 내부 통신 방식으로 `WorkflowExecutor` 인터페이스 재사용을 기각하고 `EngineDriver` 도입을 채택 (`spec/5-system/4-execution-engine.md §Rationale`에 기록).

**구현 확인**:
- `ai-turn-executor.ts` 는 `codebase/backend/src/nodes/ai/ai-agent/` 하위 co-location 준수. `ai/shared/` 승격 없음 — 기각된 대안을 재도입하지 않음.
- 3단계 PR이 독립 단일 PR로 진행 (ai-agent.handler.ts + ai-turn-executor.ts + ai-turn-executor.spec.ts). 빅뱅 방식이 아님 — 기각 대안 재도입 없음.
- `processMultiTurnMessage` polymorphic 시그니처가 핸들러에 잔류하고 executor로 위임하는 구조 — spec §1.3 계약 보존 선언과 일치.

결과: **위반 없음**.

#### 2. 합의된 원칙 위반

**점검 대상 합의 원칙**:

(a) `spec/4-nodes/3-ai/1-ai-agent.md §12` Rationale 전반: `processMultiTurnMessage` polymorphic 시그니처(information_extractor와 공유)는 핸들러에 **반드시 잔류**해야 한다는 invariant.

(b) `spec/5-system/4-execution-engine.md §4.4`: `IExecutionEventEmitter` 류 외부 이벤트 sink 추상화 도입 금지. `ExecutionEventEmitter` 직접 주입 유지.

(c) refactor §M-1 A 방식: executor → handler **역참조 없음** (단방향 위임).

(d) `spec/4-nodes/3-ai/1-ai-agent.md §12.6–12.7`: `FORM_SUBMITTED_GUIDANCE_MESSAGE` / `FORM_SUBMITTED_MAX_BYTES` 상수의 단일 진실 위치.

**구현 확인**:

(a) `ai-agent.handler.ts:165` — `processMultiTurnMessage`가 핸들러 public 메서드로 잔류, 본문만 `turnExecutor.processMultiTurnMessage`로 위임. 원칙 준수.

(b) `AiTurnExecutor` 생성자 — `eventEmitter`가 `import()` 타입의 `ExecutionEventEmitter` 직접 타입으로 주입, 추상화 계층 없음. 원칙 준수.

(c) `ai-turn-executor.ts:512` — "executor → handler 역참조 없음"을 JSDoc에 명시. 실제 코드에서도 handler import가 없고 handler 인스턴스를 역참조하지 않음. 원칙 준수.

(d) `ai-turn-executor.ts`에 `FORM_SUBMITTED_GUIDANCE_MESSAGE`와 `FORM_SUBMITTED_MAX_BYTES`를 정의하고, `ai-agent.handler.ts:21-24`에서 **re-export** — "기존 import 경로(`./ai-agent.handler`)를 쓰는 테스트·외부 소비자가 깨지지 않도록" 한다는 주석과 함께. 이는 SoT 이전(handler→executor)이나 backward-compatible re-export로 구현됨. 원칙 준수.

결과: **위반 없음**.

#### 3. 결정의 무근거 번복

분석한 구현 범위 내에서 과거 spec Rationale에 기록된 결정을 번복하는 변경은 없다. 이번 작업은 **behavior-preserving** 리팩토링으로, spec에 명시된 동작(단일/멀티턴 실행 로직, 출력 포트, _resumeState 구조, tool 분류 우선순위, form blocking 흐름)을 변경하지 않고 물리적 코드 위치만 이동했다.

- `RagAccumulator`, `RagAccumulatorGroup` — spec §4.2 ragDiagnostics 누적 정책 그대로 이행.
- `executeProviderToolBatch` — spec §6.1 단계 3.f `Promise.all` 병렬 실행 + budget truncate 정책 그대로 이행.
- `buildRetryState` — spec §7.9 `_retryState` 생명주기·credential 미동봉·TTL 정책 그대로 이행.
- `capFormDataBytes` — spec §12.7 `FORM_SUBMITTED_MAX_BYTES` per-field string 균등 truncate 알고리즘 그대로 이행.

결과: **위반 없음**.

#### 4. 암묵적 가정 충돌

**점검 대상 invariant**:

- `spec/4-nodes/3-ai/1-ai-agent.md §7.4`: `interactionType: 'ai_form_render'` 진입 ↔ `pendingFormToolCall` set 은 1:1 invariant.
- `spec/4-nodes/3-ai/0-common.md §11.4`: systemPrompt 조립 순서 [1]~[6] (단일 SoT).
- `spec/4-nodes/3-ai/1-ai-agent.md §7` Principle 4.2: `_resumeState` / `_resumeCheckpoint` / `_retryState` 세 내부 필드가 top-level에 위치하되 expression resolver에서 비노출.
- `spec/conventions/conversation-thread.md §2.2`: ConversationThread push의 단일 mutation 진입점.

**구현 확인**:

모든 invariant가 구현에서 명시적으로 언급되거나 코드로 준수되고 있다.
- `pendingFormToolCall` 설정·클리어 경로가 `processMultiTurnMessage` 내에 단일 경로로 정리됨.
- systemPrompt 조립은 `executeSingleTurn:990-1008` / `executeMultiTurn:1519-1537`에서 [1]prefix → [2]user → [3]KB_GUIDANCE → [4]condition suffix → [5]PRESENTATION_GUIDANCE 순서 준수.
- `_resumeState`, `_retryState` 가 output top-level에 위치 (spec §7.4, §7.9 일치).
- `pushAiThreadTurn` 이 `conversationThreadService.append*` 단일 경로로 위임.

결과: **위반 없음**.

---

## 요약

M-1 3단계 `AiTurnExecutor` 추출은 `plan/in-progress/refactor/02-architecture.md §M-1` 에 기록된 Option A (단계별 strangler-fig, handler에 polymorphic 시그니처 잔류, executor→handler 역참조 없음) 의 직접 구현이다. 과거 Rationale에서 기각된 대안 (빅뱅 단일 PR, `ai/shared/` 조기 승격, `WorkflowExecutor` 인터페이스 재사용) 이 재도입되지 않았고, 합의된 invariant (단방향 위임, 이벤트 emit 추상화 금지, form blocking 1:1 invariant, systemPrompt 조립 순서 SoT) 가 모두 코드와 JSDoc 수준에서 명시적으로 준수되고 있다. 결정의 무근거 번복도 없다 — 이번 PR은 행동 보존(behavior-preserving) 리팩토링으로 spec 본문 변경 없이 코드 물리 위치만 이동했다.

---

## 위험도

NONE
