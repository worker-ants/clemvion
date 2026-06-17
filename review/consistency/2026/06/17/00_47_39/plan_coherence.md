# Plan 정합성 검토 결과

## 검토 대상

- **Target 문서**: `spec/5-system/4-execution-engine.md` (구현 변경 diff)
- **검토 모드**: --impl-done (구현 완료 후 검토)
- **변경 범위**: `NodeBootstrapService` 신설 + `WORKFLOW_EXECUTOR` DI 토큰 + `ExecutionEngineService.registerHandlers()` 제거 + `nodes.module.ts` forwardRef 제거

## 발견사항

### [INFO] C-1 m-3 step 1 체크박스 미갱신

- **target 위치**: diff 코드 전체 (NodeBootstrapService 신설)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` C-1 개선 방안 "1. `NodeBootstrapService` — m-3 과 함께 가장 먼저" (체크박스 `[ ]`) / m-3 `[ ] 미착수` 체크박스
- **상세**: 구현이 완료됐으나 plan 의 C-1 step 1 체크박스 `[ ] 1. NodeBootstrapService` 와 m-3 `[ ] 미착수` 체크박스가 아직 미갱신 상태다. 이 단계가 완료됐다는 기록이 plan 에 없어 추후 진입자가 중복 작업을 시작할 수 있다.
- **제안**: `plan/in-progress/refactor/02-architecture.md` 의 C-1 step 1 `[ ]` 을 `[x]` 로, m-3 전체 또는 해당 개선 방안 step 1~3 체크박스를 완료 표기로 갱신하고 완료 날짜·PR 번호를 기록해야 한다.

### [INFO] WORKFLOW_EXECUTOR 용처 표기 — C-1 plan 권장안과의 경미한 표면 불일치

- **target 위치**: `node-bootstrap.service.ts` JSDoc + `workflow-executor.interface.ts` 토큰 JSDoc
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` C-1 step 5 "통신 인터페이스는 `WorkflowExecutor` 재사용 대신 **엔진 내부 전용 `EngineDriver`** 신설" / m-3 "C-1 의 내부 통신과 달리 **여기는 그 계약의 정확한 용처**"
- **상세**: C-1 step 5 는 C-1 단계(AiTurnOrchestrator 등 엔진 내부 통신)에 대해 `WorkflowExecutor` 재사용을 금지하고 `EngineDriver` 신설을 권장하지만, m-3 은 bootstrap 용처에 한해 `WorkflowExecutor` DI token 화가 "spec 이 이미 정의한 계약의 정확한 용처"라고 명시적으로 구분한다. 이번 구현은 m-3 의 지침을 정확히 따른 것으로, C-1 step 5 의 금지 대상인 "엔진 내부 통신 재사용"과 다른 경로다. 충돌이 아니라 plan 내 두 항목(C-1 vs m-3)의 의도 구분이 외부 독자에게 불명확할 수 있다.
- **제안**: 충돌이 아니므로 즉각 조치 불요. 단 C-1 후속 단계(AiTurnOrchestrator 등) 착수 시 `EngineDriver` 신설 지침(C-1 step 5)이 m-3 의 `WORKFLOW_EXECUTOR` 토큰과 구별되는 별개 경로임을 plan 주석으로 명확화하면 혼동이 줄어든다.

## 요약

이번 구현(NodeBootstrapService 신설, WORKFLOW_EXECUTOR DI 토큰, forwardRef 제거)은 `plan/in-progress/refactor/02-architecture.md` m-3 의 권장안 A를 정확히 따른다. plan 이 이 항목을 "C-1 로드맵 중 최우선 실행"으로 명시했고, 구현이 그대로 이행됐다. 미해결 결정과의 충돌 없음, 선행 plan 미해소 없음. 유일한 누락은 m-3 과 C-1 step 1 의 완료 체크박스가 plan 에 갱신되지 않은 것으로, INFO 수준의 추적 메모 필요 사항이다.

## 위험도

LOW
