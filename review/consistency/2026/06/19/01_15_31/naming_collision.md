# 신규 식별자 충돌 Check — 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep)  
**대상 문서**: `spec/5-system/4-execution-engine.md`  
**대상 섹션**: (없음) — 신규 spec 텍스트 없음, 기존 spec 식별자 충돌 점검

---

## 발견사항

### [INFO] 대상 섹션 신규 식별자 없음 — 기존 식별자 일관성 확인 완료

- target 신규 식별자: 없음 (target payload "(없음)")
- 기존 사용처: 해당 없음
- 상세: 이번 `--impl-prep` 대상은 기존 `spec/5-system/4-execution-engine.md` 에 이미 작성된 식별자들에 대해 구현을 착수하는 흐름이다. 신규 spec 텍스트가 도입되지 않으므로 정의 충돌 원칙상 점검 대상이 없다. 기존 식별자를 아래 항목에서 교차 확인한다.

---

### [INFO] `EngineDriver` / `ENGINE_DRIVER` — 스코프 명확, 충돌 없음

- target 신규 식별자: 기존(`4-execution-engine.md §Rationale "C-1 god-class strangler-fig 분할"`)에 이미 등재됨
- 기존 사용처: `spec/5-system/4-execution-engine.md:1465`, `spec/data-flow/3-execution.md:172`, `spec/data-flow/15-external-interaction.md:112`, `spec/4-nodes/6-presentation/0-common.md:426`
- 상세: `EngineDriver` 는 엔진 내부 전용 계약 (`useExisting: ExecutionEngineService`, token `ENGINE_DRIVER`)이며, `WorkflowExecutor` (engine↔노드 계약)와 의미가 다르다는 점이 이미 명시돼 있다. 코퍼스 전체 grep 결과 `ENGINE_DRIVER` 라는 DI 토큰이 다른 도메인에서 쓰이는 사례는 없다. `WORKFLOW_EXECUTOR` 토큰도 마찬가지 — `spec/4-nodes/0-overview.md` 에서만 교차 참조되며 동일 의미로 사용된다.
- 제안: 현 상태 유지.

---

### [INFO] `AiTurnOrchestrator` / `FormInteractionService` / `ButtonInteractionService` / `RetryTurnService` / `NodeBootstrapService` — 다중 spec 파일에서 일관 사용

- target 신규 식별자: 기존 식별자(C-1 spec-sync 커밋 `d3ccae70`으로 이미 반영됨)
- 기존 사용처:
  - `AiTurnOrchestrator`: `spec/5-system/4-execution-engine.md:193,1461`, `spec/4-nodes/3-ai/1-ai-agent.md:1099`, `spec/conventions/interaction-type-registry.md:46,47`, `spec/data-flow/3-execution.md:172`, `spec/data-flow/15-external-interaction.md:112`
  - `FormInteractionService` / `ButtonInteractionService`: `spec/5-system/4-execution-engine.md:193,1462`, `spec/conventions/interaction-type-registry.md:45`, `spec/conventions/node-output.md:194,259`, `spec/data-flow/3-execution.md:172`, `spec/data-flow/15-external-interaction.md:112`
  - `RetryTurnService`: `spec/5-system/4-execution-engine.md:193,1463`
  - `NodeBootstrapService`: `spec/5-system/4-execution-engine.md:1460`, `spec/4-nodes/0-overview.md:55`
- 상세: 5개 협력 서비스명 모두 엔진 분할 spec-sync 에서 일관되게 등재됐고, 다른 도메인(인증·통합·AI 플랫폼·채널 등)에서 동일 이름이 다른 의미로 쓰이는 사례는 코퍼스에 없다. 이름 충돌 없음.
- 제안: 현 상태 유지.

---

### [INFO] `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` — 의도적 분리, 의미 혼동 가능성 낮음

- target 신규 식별자: `EXECUTION_TIME_LIMIT_EXCEEDED` (기존 등재)
- 기존 사용처: `EXECUTION_TIMEOUT` — `spec/5-system/3-error-handling.md §1.4`(Code 노드 스크립트 타임아웃)
- 상세: `spec/5-system/4-execution-engine.md:1054,1435` 에 "Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT`과 의미가 달라 분리"라고 이미 명시되어 있다. 두 코드가 prefix `EXECUTION_` 을 공유하지만 접미사가 달라 코드 레벨에서 구별된다. 이미 기존 spec 이 이 분리를 명시하므로 추가 개입 불필요.
- 제안: 현 상태 유지.

---

### [INFO] `resumeTurnRegistry` / `dispatchResumeTurn` / `PARK_RELEASED` / `ParkSignal` / `ProcessTurnResult` — 단일 파일 출처, 충돌 없음

- target 신규 식별자: 기존 등재 식별자
- 기존 사용처: `spec/5-system/4-execution-engine.md:1372,1373`; 구현 파일 `shared/execution-resume/process-turn-result.ts`
- 상세: 이 식별자들은 `resume-turn-dispatch.ts` 와 `process-turn-result.ts` 에서 기원하며, spec 코퍼스 내에서 다른 의미로 중복 정의되는 사례가 없다. 코퍼스 전수 검색 결과 `PARK_RELEASED`, `ParkSignal`, `ProcessTurnResult` 는 실행 엔진 spec 에만 등장한다.
- 제안: 현 상태 유지.

---

### [INFO] `CHECKPOINT_SCHEMA_VERSION` / `CALL_STACK_SCHEMA_VERSION` — 별개 상수, 주석으로 이미 명시

- target 신규 식별자: 기존 등재 식별자
- 기존 사용처: `spec/5-system/4-execution-engine.md:169,779,955,959,981,1374`
- 상세: 두 상수는 각각 `_resumeCheckpoint` 와 `resume_call_stack` 의 스키마 버전 관리용 독립 상수이며, spec 텍스트가 "checkpoint 와 독립 상수"(`spec/5-system/4-execution-engine.md:779`)로 이미 명시한다. 같은 `_VERSION` 접미사를 공유하지만 전체 이름이 달라 충돌 없다.
- 제안: 현 상태 유지.

---

### [INFO] `ExecutionGraphState` / `NodeDispatchLoopParams` — impl-done INFO 후속으로 leaf 이동 예정, 충돌 없음

- target 신규 식별자: 해당 없음(spec 에 미등재, 구현 내부 타입)
- 기존 사용처: `plan/in-progress/refactor/c1-engine-split.md:108` — "후속(impl-done INFO): `ExecutionGraphState`/`NodeDispatchLoopParams` leaf 이동"
- 상세: 두 타입명은 `spec/5-system/4-execution-engine.md` 에 명시적으로 등재되지 않아 spec 식별자 충돌 검토 범위 밖이다. 구현 내부 타입이며 spec이 이름을 규정하지 않으므로 충돌 없다.
- 제안: 현 상태 유지.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 이번 검토 범위에서 신규 식별자를 도입하지 않는다 (target 섹션 "(없음)"). C-1 god-class 분할로 등재된 기존 식별자(`EngineDriver`, `ENGINE_DRIVER`, `WORKFLOW_EXECUTOR`, `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`, `NodeBootstrapService`, `resumeTurnRegistry`, `dispatchResumeTurn`, `PARK_RELEASED`, `ParkSignal`, `ProcessTurnResult`, `CHECKPOINT_SCHEMA_VERSION`, `CALL_STACK_SCHEMA_VERSION`, `EXECUTION_TIME_LIMIT_EXCEEDED`)는 코퍼스 교차 검색 결과 다른 도메인에서 다른 의미로 사용되는 사례가 없으며, `EXECUTION_TIMEOUT` 과의 의미 분리도 기존 spec 에 명시돼 있다. 명명 충돌 관점에서 차단 사유 없음.

## 위험도

NONE

STATUS: OK
