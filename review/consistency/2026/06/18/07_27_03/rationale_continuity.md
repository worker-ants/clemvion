# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done, scope=spec/5-system/4-execution-engine.md)
diff-base: claude/engine-split-s3-formbutton → HEAD (claude/engine-split-s4-retry)

---

## 발견사항

### 발견 없음 — 합의 원칙 전부 준수

분석 결과 Rationale 에서 명시적으로 기각된 대안의 재도입, 합의된 invariant 위반, 무근거 결정 번복이 발견되지 않았다. 세부 검증 내역은 아래와 같다.

---

### [INFO] `ExecutionCancelledError` file-level 이동 — Rationale 침묵 영역, 충돌 없음

- **target 위치**: `execution-engine.service.ts` diff — 클래스 정의 삭제 (`class ExecutionCancelledError extends Error`), 대신 `workflow-errors.ts` 에서 import.
- **과거 결정 출처**: spec/5-system/4-execution-engine.md `## Rationale` — `_retryState`·DLQ·park 관련 결정들은 클래스 위치를 규정하지 않는다. `c1-engine-split.md §spec 무변 확인 항목` 이 명시적으로 "`ExecutionCancelledError` 의 `workflow-errors.ts` 이동: spec 은 클래스 파일 위치 미정의 → 침묵 영역, 변경 불요"로 선언.
- **상세**: 이동은 순수 파일-위치 변경이며 Rationale 어디에도 이 클래스의 위치를 제약하는 항목이 없다. plan 도 명시적으로 침묵 영역으로 분류했다.
- **제안**: 없음.

---

### [INFO] `private → public` 승격 (`rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`) — EngineDriver 계약 일관, Rationale 비충돌

- **target 위치**: `execution-engine.service.ts` diff — 세 메서드에 `@internal` JSDoc 추가와 함께 `private` → `public` 승격.
- **과거 결정 출처**: spec/5-system/4-execution-engine.md `## Rationale "Durable Continuation" / "park 즉시 해제 + slow-path 일원화"` — 이 결정들은 메서드 가시성(private/public)을 규정하지 않는다. `plan/in-progress/refactor/02-architecture.md` 옵션 A 채택 근거 는 "`EngineDriver` 신설(엔진 내부 전용, in-process 전제)" — 분리 서비스가 엔진 capability 를 driver 토큰 경유로 호출하는 패턴과 완전히 일치.
- **상세**: `@internal` 어노테이션으로 "EngineDriver 계약 경유로만 호출" 의도를 명시했고, NestJS DI 수준에서는 `private` 이 실질적으로 강제되지 않으므로 인터페이스(EngineDriver) 가 계약 경계 역할을 수행하는 패턴이다. 과거 Rationale 의 어떤 결정("엔진 내부 분산 분리 아님", "항상 BullMQ enqueue" 등)과도 충돌하지 않는다.
- **제안**: 없음.

---

### [INFO] `RetryTurnService` 에 `EngineDriver` 주입 — 기각된 대안(C. 직접 호출) 재도입 아님

- **target 위치**: `retry-turn.service.ts` — `@Inject(ENGINE_DRIVER) private readonly driver: EngineDriver` 주입.
- **과거 결정 출처**: `plan/in-progress/refactor/02-architecture.md` C-1 옵션 표:
  - **옵션 C 기각** ("분리 서비스가 엔진 public 메서드를 직접 호출 — 인터페이스 신설 없이"): "forwardRef 순환 재생산·엔진 표면 암묵 계약화·이후 분리 더 어려워짐".
  - **옵션 A 채택** ("엔진 내부 전용 `EngineDriver` 신설"): PR2(`AiTurnOrchestrator`) · PR3(`Form/ButtonInteractionService`) · PR4(`RetryTurnService`) 공통 패턴.
- **상세**: `RetryTurnService` 가 `ENGINE_DRIVER` 토큰 경유(`this.driver.rehydrateContext`, `this.driver.loadAndBuildGraph`, 등)로 엔진 capability 를 호출하는 것은 옵션 A의 지속적 적용이며 기각된 옵션 C 의 재도입이 아니다.
- **제안**: 없음.

---

### [INFO] `retryLastTurn`·`applyRetryLastTurn` 엔진 thin delegator 잔류 — PR2·PR3 선례와 일관

- **target 위치**: `execution-engine.service.ts` diff — 두 메서드 본문을 `this.retryTurnService.X(...)` 단발 위임으로 교체.
- **과거 결정 출처**: spec/5-system/4-execution-engine.md `## Rationale "per-node task queue → execution-level intake 큐"` 항은 외부 표면(WS gateway · continuation processor 진입점) 보존을 언급하지 않으나, `c1-engine-split.md §PR4` 가 "WS gateway 가 호출하는 `retryLastTurn` / `applyRetryLastTurn` 외부 표면을 보존 (PR2 `continueAiConversation` / PR3 `continueButtonClick` 선례와 동일)"로 명시. Rationale 의 어떤 항목과도 충돌하지 않는다.
- **제안**: 없음.

---

### [INFO] `retryLastTurn` 단위 테스트 `execution-engine.service.spec.ts` 에서 제거 → `retry-turn.service.spec.ts` 로 이동

- **target 위치**: `execution-engine.service.spec.ts` diff — `describe('retryLastTurn (_retryState consume + spawn)', ...)` 블록 전체 삭제.
- **과거 결정 출처**: spec Rationale 에는 테스트 배치에 대한 결정이 없다. 구현이 `RetryTurnService` 로 이동됐으므로 테스트가 해당 서비스 spec 파일로 이동하는 것은 SRP 원칙의 자연 귀결.
- **상세**: `retry-turn.service.spec.ts` 파일이 새로 생성됐으며(git status: `??`) 테스트가 이관된 것으로 확인된다. Rationale 의 어떤 결정과도 충돌하지 않는다.
- **제안**: 없음.

---

### [INFO] `ExecutionGraphState`·`NodeDispatchLoopParams` export 전환 — Rationale 에 명시된 "in-process 전제" 와 정합

- **target 위치**: `execution-engine.service.ts` diff — `interface ExecutionGraphState` / `interface NodeDispatchLoopParams` 에 `export` 추가.
- **과거 결정 출처**: `plan/in-progress/refactor/02-architecture.md` 옵션 A 채택 근거: "`EngineDriver` 는 엔진 내부 계약이라 §4.4 가 금지하는 외부 이벤트 sink 추상화와 무관". `c1-engine-split.md §통신 방식(A 방식 핵심 결정)`: "`EngineDriver` 엔진 내부 전용 계약 ... **in-process 전제 — 분산 분리 아님**".
- **상세**: 두 타입은 `EngineDriver` 인터페이스가 `loadAndBuildGraph` / `runNodeDispatchLoop` 시그니처에서 참조하기 위해 export 됐다. "in-process 전제"는 타입의 모듈 바깥 가시성을 금지하지 않는다 — 분산 분리(별도 프로세스/네트워크 경계 이탈)가 없으면 원칙 위반이 아니다. `RetryTurnService` 는 동일 `execution-engine` 모듈 내에 있으므로 "분산 분리" 경계를 넘지 않는다.
- **제안**: 없음.

---

## 요약

PR4(`RetryTurnService` 추출) 의 구현 변경은 `spec/5-system/4-execution-engine.md ## Rationale` 에 기록된 모든 합의 결정과 충돌하지 않는다. (1) 기각된 `R2(waiting_for_retry 신설)` / `옵션 C(인터페이스 없이 직접 호출)` / `per-node task queue` / `sticky fast-path` 등 어느 대안도 재도입되지 않았다. (2) `_retryState` atomic consume + spawn 검증 순서·TTL·concurrent guard 로직은 그대로 `RetryTurnService.retryLastTurn` 으로 verbatim 이동됐다. (3) `resumeGraphAfterRetry` 가 `runNodeDispatchLoop`(EngineDriver) 를 경유하는 구조는 Rationale 의 "park 즉시 해제 + slow-path 일원화(Phase B)" 결정과 정합한다. (4) `publishRetryLastTurn` 을 엔진 publisher cluster 에 잔류시키는 결정은 "항상 BullMQ enqueue" / "sticky fast-path 제거" Rationale 과 일관하다. 발견사항은 모두 INFO(참고) 수준이며 차단 사유가 없다.

## 위험도

NONE
