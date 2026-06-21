# Rationale 연속성 검토 결과

검토 모드: --impl-prep (구현 착수 전)
대상 영역: `spec/4-nodes/3-ai`
구현 대상: M-1 3단계 — `AiTurnExecutor` 추출 (`ai-agent.handler.ts` → `ai-turn-executor.ts`)

---

## 발견사항

### INFO: `processMultiTurnMessage` polymorphic 계약 보존 확인

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 + plan `02-architecture.md` M-1 §3단계 비고
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §1.3` Rationale + `plan/in-progress/refactor/02-architecture.md` M-1 Option A 권장안
- 상세: plan M-1 §3단계는 "`processMultiTurnMessage` 시그니처는 핸들러에 남기고 내부 위임만"을 명시한다. 구현 `ai-agent.handler.ts` line 165는 `processMultiTurnMessage`를 핸들러 표면에 유지한 채 `this.turnExecutor.processMultiTurnMessage()`로 단방향 위임하고 있어 이 결정과 정합한다. information_extractor 와의 polymorphic 계약(`spec/5-system/4-execution-engine.md §1.3`)이 보존된다. 별도 수정 불요.
- 제안: 없음 (정합 확인).

### INFO: co-location 규칙 준수 확인

- target 위치: `ai-turn-executor.ts` 배치 위치 (`codebase/backend/src/nodes/ai/ai-agent/`)
- 과거 결정 출처: `plan/in-progress/refactor/02-architecture.md` M-1 Option B 기각 — "실공유 미확인 상태의 추측성 일반화 — co-location 이탈. 공유 확인 후 승격(A 의 4번)으로 충분히 늦출 수 있음"
- 상세: 기각된 Option B는 `ai/shared/` 로 즉시 승격하는 것이었다. 현행 구현은 `nodes/ai/ai-agent/` 하위에 `ai-turn-executor.ts`를 배치해 기각된 대안을 채택하지 않고 있다. information_extractor 가 이 클래스를 실제로 공유하지 않는 한 `ai/shared/` 이동은 여전히 deferred 상태이어야 한다. 별도 수정 불요.
- 제안: 없음 (기각 대안 미채택 확인).

### INFO: `IExecutionEventEmitter` 추상화 인터페이스 미도입 확인

- target 위치: `ai-turn-executor.ts` line 526 — optional `ExecutionEventEmitter` 생성자 주입
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §4.4` Rationale — "별도 추상화(`IExecutionEventEmitter` 같은 인터페이스 / Nest `EventEmitter2`)를 도입하지 않는다" + `15-chat-channel.md §R4` — "WebsocketService.executionEvents$ 를 EventEmitter2 기반으로 교체"를 명시 배제
- 상세: `ai-turn-executor.ts`의 eventEmitter 파라미터는 `ExecutionEventEmitter`(기존 thin wrapper)의 optional 주입이며, 신규 `IExecutionEventEmitter` 인터페이스나 `EventEmitter2` 교체를 도입하지 않는다. 단일 sink 정책을 위반하지 않는다. 별도 수정 불요.
- 제안: 없음 (금지 대안 미채택 확인).

### INFO: §12.9~12.14 Rationale 불변식 체크리스트

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §12.9~12.14`
- 과거 결정 출처: 동 §12.9 (memoryStrategy 별도 필드 근거), §12.10 (language-aware 토큰 추정 근사 · tokenizer-exact 미도입), §12.11 (안정 프리픽스 캐시 보호), §12.12 (summaryModelConfigId/extractionModelConfigId provider 디커플), §12.13 (요약 유실 graceful degrade), §12.14 (user 경계 물리 압축)
- 상세: plan M-1 §2단계 완료 노트(commit `3369fcef`)에서 이미 §12.9~12.14 불변식 전체 보존이 검증됐으며, 3단계(`AiTurnExecutor` 추출)는 이 로직을 핸들러에서 executor 로 물리 이동하는 behavior-preserving 작업이다. `AiTurnExecutor`가 `AiMemoryManager`(2단계 추출물)를 collaborator 주입으로 수용하므로 §12.9~12.14의 메모리 불변식 구현은 `AiMemoryManager`가 단일 진실로 보유한다 — executor 는 이를 호출만 한다. 불변식이 executor 안에 중복 구현되거나 우회되지 않아야 한다.
- 제안: 구현 착수 시 `AiTurnExecutor` 내부에 `memoryManager.injectMemoryContext()` / `memoryManager.scheduleMemoryExtraction()` 호출 경로가 §6.1/§6.2 실행 단계 순서와 동일한지 확인. 특히 §12.14 (user 경계 물리 압축 — `compactMessagesToTail`) 호출이 요약 갱신 이후 올바른 위치에 있는지 검토 필요(기존 handler 코드 이동이라 회귀 없어야 하나, 이동 중 순서가 바뀌면 압축 불변식이 깨질 수 있음).

---

## 요약

M-1 3단계 `AiTurnExecutor` 추출은 이전 2단계(AiConditionEvaluator, AiMemoryManager)와 동일한 strangler-fig 방식의 behavior-preserving refactor 이다. 검토 대상 `spec/4-nodes/3-ai` 문서군의 Rationale(`1-ai-agent.md §12.9~12.14`, `0-common.md §Rationale`)과 `spec/5-system/4-execution-engine.md §4.4` Rationale에 기록된 핵심 결정들 — `processMultiTurnMessage` polymorphic 계약 보존, co-location 우선(ai/shared 승격 deferred), IExecutionEventEmitter 미도입, WebsocketService 단일 sink 유지 — 이 모두 현행 구현 설계에서 준수되고 있다. 기각된 대안(Option B: ai/shared 즉시 승격, IExecutionEventEmitter 도입, EventEmitter2 교체)이 재채택된 증거는 없다. CRITICAL/WARNING 등급 발견사항 없음.

---

## 위험도

NONE
