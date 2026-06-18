# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` 구현 diff (origin/main...HEAD)
검토 모드: --impl-done (구현 완료 후 검토)
검토 파일: `engine-driver.interface.ts`, `execution-engine.service.ts`, `types/graph-dispatch.types.ts`, `workflow-errors.ts`

---

### 발견사항

- **[INFO]** `@internal` JSDoc 태그 추가 — spec 원칙과 정합, 보완 제안 없음
  - target 위치: `engine-driver.interface.ts` 내 `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache` 메서드 및 `EngineDriver` 인터페이스 헤더 주석
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "C-1 god-class strangler-fig 분할" 항, "EngineDriver = 엔진 내부 전용 계약", "in-process 전제 — 분산 분리가 아니라 같은 프로세스 안의 클래스 경계 정리"
  - 상세: Rationale 은 `ENGINE_DRIVER` 토큰이 "추출 서비스가 엔진의 잔류 메서드를 호출하는 엔진 내부 전용 계약"임을 명시한다. diff 의 `@internal` 태그는 이 원칙을 JSDoc 에 명시적으로 문서화한 것으로, 기각된 대안의 재도입이나 원칙 위반이 없다. `WorkflowExecutor` 재사용 기각 결정도 건드리지 않는다.
  - 제안: 현 diff 는 정합하며 수정 불필요. 참고로 `EngineDriver` 인터페이스 레벨 주석("모든 멤버는 `ENGINE_DRIVER` 토큰을 통해서만 호출") 은 spec Rationale 의 "엔진 내부 전용 계약" 문구를 코드 표면에 반영한 것으로 Rationale 연속성을 강화한다.

- **[INFO]** `ExecutionGraphState` / `NodeDispatchLoopParams` 를 `types/graph-dispatch.types.ts` leaf 모듈로 이동
  - target 위치: `execution-engine.service.ts` 내 기존 두 인터페이스 제거, `types/graph-dispatch.types.ts` 신설
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "C-1 god-class 분할" 항, "메서드 물리 위치는 spec 이 정의하지 않는 구현 재량 영역"; `spec/0-overview.md ## Rationale` — "실행 엔진: Redis 큐 + 분산 워커 풀" 항(in-process dispatch 전제 유지 확인)
  - 상세: 두 인터페이스의 의미·필드·JSDoc 이 원본과 동일하게 이동됐으며(verbatim 이동), 타입 레벨 순환 해소가 목적임을 인라인 주석이 명시한다. Rationale 의 "behavior-preserving(verbatim 이동)" 원칙을 그대로 따른다. 인터페이스 소유 위치가 바뀌었으나 이는 C-1 Rationale 이 "메서드 물리 위치는 구현 재량"으로 선언한 범위와 동일하다.
  - 제안: 현 diff 는 정합하며 수정 불필요. Rationale 에 이 이동을 명시하는 별도 항을 추가할 수 있으나(예: "타입 레벨 순환 해소 — `graph-dispatch.types.ts` leaf"), C-1 Rationale 의 범위 기술("메서드 물리 위치는 구현 재량") 이 이 이동도 커버하므로 의무는 아니다.

- **[INFO]** `ExecutionCancelledError` 에 `@internal` 태그 추가
  - target 위치: `workflow-errors.ts` 내 `ExecutionCancelledError` 클래스
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "C-1 god-class 분할" 항, "이벤트 발행은 불변 … 추상화 레이어를 새로 도입하지 않는다"
  - 상세: `ExecutionCancelledError` 는 C-1 분할 이전부터 존재했으며, `@internal` 태그는 기존 "engine↔retry value cross-import 순환 회피" 목적을 코드 표면에 재확인한 것이다. 기각된 대안 재도입이나 invariant 위반 없다.
  - 제안: 현 diff 는 정합하며 수정 불필요.

---

### 요약

이번 diff 는 C-1 strangler-fig 분할(PR #622·#625·#626·#627)의 직접 후속으로, 타입 레벨 순환 해소(`graph-dispatch.types.ts` leaf 이동)와 `EngineDriver` 계약의 `@internal` 명시화를 수행한다. `spec/5-system/4-execution-engine.md ## Rationale`의 "C-1 god-class 분할" 항이 "메서드 물리 위치는 spec 이 정의하지 않는 구현 재량 영역", "behavior-preserving(verbatim 이동)", "EngineDriver = 엔진 내부 전용 계약"을 명시적으로 선언하고 있으며, diff 는 이 세 원칙을 모두 준수한다. 기각된 대안(per-node task queue, `_continuationCheckpoint` 컬럼 신설, `WorkflowExecutor` 재사용, sticky fast-path 등)은 어느 것도 재도입되지 않았다. 합의된 invariant(in-process 전제, 단일 sink 정책, 항상 rehydration 경로, BullMQ 단일 큐 모델)도 훼손되지 않는다. 발견사항은 모두 INFO 수준으로, 개선 제안이지 차단 사항이 없다.

---

### 위험도

NONE
