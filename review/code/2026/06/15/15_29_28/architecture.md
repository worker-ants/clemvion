# 아키텍처(Architecture) 리뷰 — execution §1.3 single-node execution (FRESH, post-resolution)

**리뷰 세션**: 2026-06-15 15:29:28  
**대상**: exec-single-node (resolution 반영 후 fresh review)  
**선행 리뷰**: review/code/2026/06/15/15_05_56/architecture.md  
**사전 DEFER 확정**: W-1(Controller-Repository 직결), W-2(forFeature 경계), W-3(god-class) — 기존 패턴 선례·추적 계획 근거로 유지

---

## 발견사항

### [INFO] SOLID — 단일 책임 (Controller 검증 책임 혼재)
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` `executeNode` 메서드
- 상세: `executeNode` 가 (1) shutdown gate, (2) workflow 존재 검증, (3) node 소속 검증, (4) previousExecutionId workflow 소속 검증, (5) 입력 조립, (6) engine 호출을 단일 메서드에서 처리한다. 이는 기존 `execute` 메서드와 동일한 구조적 특성이며, W-1/W-2 가 DEFER 처리된 선례가 있다. 본 fresh 리뷰에서도 동일하게 **기존 패턴 일관** 범주로 판정한다. 신규 Critical 이슈 아님.
- 제안: 컨트롤러 전반 레이어 정리 시 함께 처리. 기존 계획 트랙에 위임.

### [INFO] 의존성 역전 — `isCanonicalHandlerOutput` 타입 가드 SoT 단일화 완료 (resolution W-13 반영)
- 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts`
- 상세: resolution W-13 조치로 `isCanonicalHandlerOutput` 타입 가드가 `handler-output.adapter.ts` 에 export 됐다. 이전 리뷰에서 지적된 "canonical 판별 로직 인라인 중복" 문제가 해소됐으며, engine 서비스가 어댑터 모듈의 타입 가드를 참조하는 올바른 의존 방향을 형성한다. 아키텍처 관점에서 개선 완료.
- 제안: 해당 없음.

### [INFO] 모듈 경계 — `WorkflowsModule` 의 `Execution` 엔티티 `forFeature` 등록
- 위치: `codebase/backend/src/modules/workflows/workflows.module.ts`
- 상세: `WorkflowsModule` 이 `ExecutionsModule` 의 엔티티를 직접 `forFeature` 등록하는 것은 이전 리뷰 W-2 로 지적됐고 DEFER 처리됐다. 동일 컨트롤러가 `Node`, `Edge` 도 직접 `forFeature` 하는 기존 선례가 있어, `Execution` 추가는 패턴 일관 범주다. 순환 의존성을 신규로 열거나 강화하지 않는다(`forwardRef` 로 이미 처리된 기존 순환 외). 신규 Critical 이슈 아님.
- 제안: 모듈 경계 정리 시 함께 처리.

### [INFO] 레이어 책임 — 프레젠테이션/비즈니스/데이터 레이어 분리
- 위치: 전체 changeset
- 상세: resolution 후 changeset 을 전체적으로 재평가했을 때, 새로운 레이어 위반이 추가로 도입된 지점은 없다. `ExecuteNodeDto` (프레젠테이션), `ExecutionEngineService.execute()` + `runExecution()` 분기 (비즈니스), `getLatestPredecessorOutputs()` + V098 마이그레이션 (데이터) 레이어 배분이 기존 패턴을 따른다. 데이터 접근이 controller 에서 직접 발생하는 W-1/W-2 문제는 DEFER 확정 범주이므로 본 fresh 리뷰에서 재판정 없음.
- 제안: 해당 없음.

### [INFO] 확장성 — mode-encoding 컬럼 패턴 일관
- 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts`, `codebase/backend/migrations/V098__execution_single_node.sql`
- 상세: `single_node_id` / `previous_execution_id` 컬럼은 `dry_run` / `re_run_of` 의 mode-encoding 선례를 따르며 nullable/additive 방식이라 기존 실행 행에 회귀 없다. 향후 단일 노드 실행 모드의 동작 변경(downstream 일부 허용 등) 시 엔티티 필드를 재사용할 수 있어 확장성이 적절하다.
- 제안: 해당 없음.

### [INFO] 순환 의존성 — 신규 순환 없음
- 위치: `codebase/backend/src/modules/workflows/workflows.module.ts`
- 상세: 마이그레이션 주석에 기존 `WorkflowsModule → ExecutionEngineModule → WebsocketModule → WorkflowsModule` 순환이 `forwardRef` 로 처리되어 있다고 명기돼 있다. 이번 변경에서 `Execution` 엔티티를 `forFeature` 에 추가한 것은 `TypeOrmModule` 내부 등록이므로 새로운 모듈 간 순환을 형성하지 않는다.
- 제안: 해당 없음.

### [INFO] 추상화 수준 — `getLatestPredecessorOutputs` private 헬퍼 적절
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: `getLatestPredecessorOutputs` 와 `seedSingleNodePredecessorOutputs` 두 private 헬퍼가 단일 노드 실행 전용 로직을 `runExecution` 본문에서 분리한다. 추상화 수준이 적절하고 과도하지 않다. god-class 누적(W-3) 문제는 기존 추적 계획에 위임됐으며, 이번 추가 면적은 소형이다.
- 제안: 해당 없음.

---

## 요약

resolution W-13(isCanonicalHandlerOutput 타입 가드 SoT 단일화)이 반영돼 이전 리뷰에서 지적된 아키텍처 관점의 가장 실질적인 중복 문제가 해소됐다. 나머지 지속 항목(Controller-Repository 직결 W-1/W-2, god-class W-3)은 사전 DEFER 확정 근거(기존 패턴 선례, 별도 리팩토링 트랙)가 그대로 유효하며, fresh 리뷰에서 신규 Critical 또는 Warning 을 발생시키는 아키텍처 위반은 도입되지 않았다. 전체 changeset 은 mode-encoding 컬럼 패턴·forwardRef 모듈 처리·레이어 배분을 기존 코드베이스 관행에 일관되게 따르고 있으며, 순환 의존성 추가 없음, 추상화 수준 적절, 확장성 충분하다.

---

## 위험도

LOW
