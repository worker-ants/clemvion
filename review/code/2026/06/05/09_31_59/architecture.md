# 아키텍처(Architecture) 리뷰

**대상 커밋**: b8f2f18 — feat(execution-engine): PR-A1 conversationThread durable park 영속 + rehydration 무손실 복원
**리뷰어**: Architecture
**일시**: 2026-06-05

---

## 발견사항

### [INFO] rehydrateConversationThread 의 위치 — shared 타입 파일에 로직이 혼재
- **위치**: `/codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` (신규 함수 `rehydrateConversationThread`, 라인 199 이후)
- **상세**: `conversation-thread.types.ts` 는 타입 정의와 팩토리 함수(`createEmptyConversationThread`)를 담는 파일이다. 그런데 이번 변경에서 실질적인 정규화/복원 로직을 포함하는 `rehydrateConversationThread` 가 같은 파일에 추가됐다. 이 함수는 단순 팩토리가 아닌 eviction-aware nextSeq 보정, totalChars 재계산, 손상 감지·리셋 등 비자명한 도메인 로직을 포함한다. `.types.ts` 파일이 타입 정의 + 팩토리 + 정규화 로직을 모두 담으면 단일 책임 원칙(SRP) 경계가 모호해진다.
- **제안**: 허용 가능한 수준이지만, 향후 thread 관련 로직이 증가할 경우 `conversation-thread.normalizer.ts` 또는 `conversation-thread-rehydration.ts` 로 분리할 것을 권장한다. 현 규모에서는 INFO — 즉각 수정 불필요.

### [INFO] stageConversationThreadSnapshot 의 사이드 이펙트 패턴
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `stageConversationThreadSnapshot` (라인 8408~8614)
- **상세**: `stageConversationThreadSnapshot` 은 `execution` 엔티티 객체를 직접 mutation 하는 사이드 이펙트 방식으로 동작한다(`execution.conversationThread = cloneThread(...)`). 이 메서드의 계약은 "호출 직후 `updateExecutionStatus` 가 반드시 실행되어야 DB 에 commit 된다" 는 암묵적 선행 가정을 가진다. 메서드 이름이 "stage" 라는 의도적 표현이고, docstring 에도 이를 명시했으므로 인지적 부담은 낮다. 그러나 3개 park 지점에서 각각 동일한 2-line 패턴(stageConversationThreadSnapshot → updateExecutionStatus)이 반복되며 이 둘이 항상 함께 호출되어야 한다는 불변식이 코드 수준에서는 강제되지 않는다.
- **제안**: 현재는 docstring + 테스트로 계약이 명시됐으므로 INFO 수준. 향후 park 지점이 추가될 때 "stage + commit 를 단일 메서드로 묶기"(`parkWithThread` 같은 합성 메서드)를 고려할 수 있다.

### [INFO] ExecutionEngineService 의 책임 집중 심화
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- **상세**: 이번 변경은 `ExecutionEngineService` 에 `stageConversationThreadSnapshot` private 메서드를 추가하고 3개 park 경로(`form`, `button`, `ai`)에 각각 호출을 삽입한다. `ExecutionEngineService` 는 이미 실행 오케스트레이션, 노드 dispatch, rehydration, park/resume 상태 전이, 트랜잭션 관리 등 많은 책임을 가진 서비스다. 이번 변경 자체는 소규모 추가이고 올바른 위치를 선택했으나, 장기적으로 이 서비스의 크기와 책임이 계속 증가하는 패턴이 반복되고 있다.
- **제안**: 현 PR 범위에서 즉각 분리는 불필요하다. 다만 향후 park 관련 로직이 누적될 때(Phase B 이후) `ParkResumeService` 또는 `ExecutionParkService` 로 park/resume 책임을 분리하는 리팩터링을 고려할 것을 권장한다. 현 변경은 INFO.

### [INFO] Execution 엔티티에 실행 상태(execution-engine 내부 관심사)가 직접 매핑
- **위치**: `/codebase/backend/src/modules/executions/entities/execution.entity.ts` (신규 `conversationThread` 컬럼)
- **상세**: `Execution` 엔티티는 `executions` 모듈에 속하는 데이터 레이어 객체다. 그런데 `conversationThread` 는 실질적으로 `execution-engine` 모듈의 내부 런타임 상태(`ExecutionContext.conversationThread`) 를 park 시점에 스냅샷한 것이다. 이는 실행 엔진의 내부 관심사가 데이터 모델 엔티티에 직접 노출되는 형태다. 현재 아키텍처에서 `Execution` 엔티티는 여러 모듈(executions API, execution-engine 서비스 등)이 공유하므로 불가피한 측면이 있으며, spec 에서도 이를 채택 결정(D1)으로 명시하고 있다. 대안(derived view, 별도 컬럼 없이 Redis/별도 테이블)은 spec §8.4 에서 기각됐으며 기각 Rationale도 문서화됐다.
- **제안**: 현재 결정은 트레이드오프 분석이 완료된 상태이고 spec 에 근거가 있으므로 위험 없음. 향후 실행 엔진 내부 상태가 엔티티에 더 많이 노출될 경우 별도 `ExecutionRuntimeState` 테이블 분리를 검토할 것을 INFO 로 기록.

### [INFO] 타입 경계 — ConversationThread vs MutableConversationThread 구분
- **위치**: `/codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` (`CreateContextOptions.conversationThread?: MutableConversationThread`)
- **상세**: `CreateContextOptions` 의 `conversationThread` 옵션이 `MutableConversationThread` 타입으로 받으면서 rehydration 경로에서는 이 값이 `rehydrateConversationThread(...)` 의 반환값 — 즉 이미 정규화된 `MutableConversationThread` — 으로 전달된다. 타입 계약은 명확하게 분리돼 있다. `ConversationThread` (불변 외부 인터페이스)와 `MutableConversationThread` (엔진 내부 변경 가능 상태)의 구분이 유지되고 있으므로 인터페이스 분리 측면은 양호하다.
- **제안**: 없음. 현재 타입 경계는 적절하다.

---

## 요약

PR-A1 의 아키텍처적 설계는 전반적으로 견고하다. park 시 스냅샷 저장과 rehydration 복원이 명확히 분리된 두 경로(`stageConversationThreadSnapshot` → DB, `rehydrateConversationThread` ← DB)로 구성되어 있고, 원자성은 기존 `updateExecutionStatus` 트랜잭션을 재사용함으로써 추가 DB 왕복 없이 보장된다. `rehydrateConversationThread` 의 방어적 정규화(손상 graceful, eviction-aware nextSeq) 는 데이터 레이어에서 외부 입력을 안전하게 흡수하는 바람직한 패턴이다. 주요 아키텍처 우려 사항은 모두 INFO 수준이며, `ExecutionEngineService` 의 책임 집중, `conversation-thread.types.ts` 에 정규화 로직 혼재, `stageConversationThreadSnapshot` 의 암묵적 호출 계약 등은 현 규모에서는 허용 범위다. Phase B 이후 park/resume 로직이 추가될 시점에 `ParkResumeService` 분리를 재검토할 것을 권장한다.

---

## 위험도

LOW

---

STATUS: OK
