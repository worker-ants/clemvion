# Cross-Spec 일관성 검토 결과

**검토 모드**: --impl-done (구현 완료 후 사후 정합 검증)
**검토 대상 diff**: perf 백로그 01 구현 (rehydration 배치/KB deleteMany/dashboard 집계/import 배치/env read-once/frontend execution-store B안)
**diff-base**: origin/main

---

## 발견사항

### INFO-01: `spec/data-flow/4-file-storage.md` — deleteMany 진입점 기술이 구현과 일치
- **target 위치**: `knowledge-base.service.ts` `remove()` 메서드 (diff +1094~+1111)
- **충돌 대상**: `spec/data-flow/4-file-storage.md §1.1 Source → Sink` 표 / `§3 라이프사이클` / `코드 진입점` 목록
- **상세**: `spec/data-flow/4-file-storage.md` 의 코드 진입점 목록에 `deleteMany(keys)` 가 이미 `(DeleteObjects 배치 — KB 삭제 cleanup 전용)` 으로 등재되어 있고, `§3 라이프사이클` 의 "KB 삭제" 행도 `DeleteObjects 배치` + best-effort 의미론을 정확히 서술한다. Rationale 절도 `단건 경로(removeDocument)는 try/catch warn, 배치 경로(remove 의 deleteMany)는 응답 Errors[].Key 를 일괄 warn` 을 명시한다. 구현이 spec 과 완전히 정합한다.
- **제안**: 현 상태 유지. 동기화 불필요.

### INFO-02: `spec/5-system/4-execution-engine.md §1.6` — MAX_NODE_ITERATIONS read-once 규약 명시됨
- **target 위치**: `execution-engine.service.ts` `resolveMaxNodeIterations()` / `resolveParallelEngineFlag()` 신설 (diff +807~+819)
- **충돌 대상**: `spec/5-system/4-execution-engine.md §1.6 환경변수` 표 및 `spec/4-nodes/1-logic/10-parallel.md` P1 구현 메모
- **상세**: 
  - `spec/5-system/4-execution-engine.md §1.6` 의 `MAX_NODE_ITERATIONS` 행: "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영 (§11 worker env 들과 동일 규약)" 으로 명시.
  - `spec/4-nodes/1-logic/10-parallel.md` P1 구현 메모: "`PARALLEL_ENGINE=off` 로 명시 설정 시 … 본 env 는 모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영".
  - 구현의 lazy-init 캐시 패턴(`maxNodeIterationsOnce` / `parallelEngineFlagOnce` nullable + `??=`) 은 "모듈 로드 시 1회 읽음" 의미론과 동등하며, 코드 주석도 이를 `resolveExecutionRunWorkerConcurrency` 의 read-once 정신과 정렬됨을 서술한다.
  - spec 이 "모듈 로드 시 1회" 를 명시하고 구현은 "인스턴스 생성 후 첫 호출 시 lazy 1회" 로 구현한 것은 관측 동작 동일(인스턴스 수명 내 단일 읽기)이다. 특히 `EXECUTION_RUN_WORKER_CONCURRENCY` 의 `resolveExecutionRunWorkerConcurrency` 도 spec §1.6 에 같은 표현("모듈 로드 시 1회 읽음")을 사용하며 실제 구현은 `onModuleInit` hook 에서 1회 읽는 패턴인데, 새 perf #14 캐시는 생성자 이후 첫 execute 시점 읽기다. 둘 다 "인스턴스 재시작 시 갱신" 불변식은 동일하게 만족한다.
- **제안**: 현 상태 유지. spec 의 "모듈 로드 시 1회" 표현이 lazy 캐시도 포괄하므로 spec 갱신 불필요. 다만 향후 spec §1.6 에 lazy-init 의미론임을 명시하면 다음 리뷰어 혼선을 줄일 수 있다(의무 아님).

### INFO-03: `spec/5-system/4-execution-engine.md §7.5` — rehydration 내 nodeExecution 배치 조회 구현 패턴 미서술
- **target 위치**: `execution-engine.service.ts` `rehydrateContext()` 내 N+1 → `In()` 배치 교체 (diff +829~+873)
- **충돌 대상**: `spec/5-system/4-execution-engine.md §7.5 Resume after Restart — Rehydration`
- **상세**: spec §7.5 는 rehydration 의 의미론(어떤 노드를 복원하는가, `_executedNodes` set 복원, `setNodeOutput` 호출 등)을 기술하지만 DB 조회 방식(per-node findOne vs 배치 In())을 의도적으로 기술하지 않는다. 이는 spec 과 구현 간 계층 분리가 올바르게 된 상태다 — spec 은 "어떤 결과를 내야 하는가"를 정의하고, 구현은 "어떻게"를 결정한다. 배치 조회 의미론(startedAt DESC 전역 정렬에서 nodeId 별 첫 등장 = 최신 COMPLETED, loop iteration 중복 처리)은 spec 의 "nodeId 당 최신 완료 row 를 컨텍스트에 복원" 의미론과 완전히 일치한다. 구현 diff 주석도 "기존 per-node findOne(order DESC) 와 동일 의미론"을 명시한다.
- **제안**: 현 상태 유지. spec 에 조회 구현 방식 추가는 불필요 — 의미론 정합으로 충분.

### INFO-04: `spec/2-navigation/0-dashboard.md` — getSummary 응답 필드 정합
- **target 위치**: `dashboard.service.ts` `getSummary()` 집계 쿼리 교체 (diff +473~+554)
- **충돌 대상**: `spec/2-navigation/0-dashboard.md §7 API` 응답 DTO 정의
- **상세**: spec §7 의 `DashboardSummaryDto` 필드 목록(`totalWorkflows`, `activeWorkflows`, `runs7d`, `runs7dPrevious`, `runs7dChangePercent`, `successRate`, `avgExecutionTime`)이 구현의 반환 객체와 정확히 일치한다. `successRate` 분모("status 무관 7일 내 전체 실행 건수")도 spec Rationale 에 명시되어 있고 구현의 FILTER 표현(`total7d` = status 무관 전체, `success7d` = COMPLETED FILTER)이 일치한다. `runs7dPrevious` 의 [14d, 7d) 구간 경계도 spec §7 "직전 7일(14~7일 전)" 과 일치한다. 특히 `prev7d=0` 시 `runs7dChangePercent = null` 이 spec "직전 7일 실행이 0건이면 `null`" 과 완전 정합한다.
- **제안**: 현 상태 유지.

### INFO-05: `spec/2-navigation/1-workflow-list.md §3.2` — importWorkflow 배치 insert 내부 구현 미서술 (정상)
- **target 위치**: `workflows.service.ts` `importWorkflow()` 배치 insert 교체 (diff +1423~+1541)
- **충돌 대상**: `spec/2-navigation/1-workflow-list.md §3.2 Import 동작 순서`
- **상세**: spec §3.2 는 import 의 외부 계약(검증 순서, UUID remap, 기본값 채움, 중복 label 거부)을 정의한다. 내부 저장 방식(save-loop vs manager.insert 배치)은 명시하지 않는다 — 올바른 계층 분리다. 배치 insert 교체는 외부 계약(동일한 UUID remap, 동일한 결과 워크플로우)을 완전히 보존한다. 단, spec §3.2 에 "index 기반 참조를 신규 UUID 로 remap 되어 저장된다(§5)" 가 기술되어 있으며, 구현은 `randomUUID()` 사전 생성으로 이를 수행 — 완전 정합.
- **제안**: 현 상태 유지.

### INFO-06: `spec/3-workflow-editor/3-execution.md §10.5` — 타임라인 정렬 기준 변경 미반영 가능성
- **target 위치**: `execution-store.ts` B안 — `nodeResults` 를 도착순 유지, `selectSortedNodeResults` WeakMap 메모 accessor 신설 (diff +1887~+1970 등)
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md §10.5 타임라인 리스트`
- **상세**: spec §10.5 는 "모든 실행된 노드를 시간순으로 나열하는 컴팩트 리스트" 라고 기술하며, 정렬의 내부 구현 방식(store 내부 정렬 vs read-time accessor 정렬)을 명시하지 않는다. B안 구현에서 `nodeResults` 는 도착순을 유지하고 `selectSortedNodeResults` 가 read 시점에 `startedAt` 기준 정렬을 적용하므로 사용자에게 노출되는 시간순 타임라인 의미론은 보존된다. spec 은 "시간순" 이라는 결과 의미론을 정의하고 있으므로 모순은 없다. 그러나 spec 문서에 정렬 책임이 store 내부에서 read-time accessor 로 이동했다는 구현 사실이 반영되어 있지 않다 — spec 을 읽는 다른 개발자가 "store 가 sort-on-write 를 한다"고 잘못 이해할 수 있다.
- **제안**: 낮은 우선순위 동기화 권장. `spec/3-workflow-editor/3-execution.md §10.5` 에 "정렬은 `selectSortedNodeResults(nodeResults)` accessor 가 read-time 에 수행한다 (store 는 도착순 유지)" 정도의 구현 노트를 추가하면 혼선을 방지할 수 있다. Critical 사항이 아님.

### INFO-07: `spec/5-system/4-execution-engine.md §Rationale` — assertNoContainerCycle 시그니처 변경 미반영
- **target 위치**: `execution-engine.service.ts` `assertNoContainerCycle(containerNode, children, byId)` 시그니처 변경 (diff +7866~+7955)
- **충돌 대상**: `spec/5-system/4-execution-engine.md` 또는 관련 코드 설명
- **상세**: spec 에는 `assertNoContainerCycle` 의 시그니처가 직접 기술된 곳이 없다. spec 은 `container_id` 체인의 순환 금지 의미론 및 `CONTAINER_CYCLE` 에러 코드 발생 조건만 정의한다(`spec/1-data-model.md §2.6`, `spec/5-system/4-execution-engine.md §3.x`). 시그니처는 private internal API 이므로 spec 에서 다루지 않는 것이 올바른 계층 분리다. 변경 전 `allNodes` 수신→`Map 이중 생성` vs 변경 후 `children+byId 재사용` 은 순수 성능 최적화이며 의미론(사이클 감지·CONTAINER_CYCLE throw) 은 불변이다.
- **제안**: 현 상태 유지.

---

## 요약

검토 대상 diff (perf 백로그 01: rehydration 배치/KB deleteMany/dashboard 집계/import 배치/env read-once/frontend execution-store B안) 는 모두 **내부 구현 최적화**로, 외부 계약(API endpoint·request/response shape·데이터 모델·상태 전이·RBAC)을 변경하지 않는다. `spec/data-flow/4-file-storage.md` 는 deleteMany 배치 의미론을 이미 정확히 기술하고 있으며, `spec/5-system/4-execution-engine.md §1.6` 은 MAX_NODE_ITERATIONS / PARALLEL_ENGINE 의 read-once 규약을 명시하고 있어 구현과 정합한다. `spec/2-navigation/0-dashboard.md` 의 getSummary 응답 DTO 및 분모 의미론도 집계 쿼리 교체 이후 변함없이 일치한다. 유일한 경미한 동기화 권장 항목은 execution-store B안에서 타임라인 정렬 책임이 store write-time 에서 accessor read-time 으로 이동한 사실이 `spec/3-workflow-editor/3-execution.md §10.5` 에 반영되지 않은 점이나, 이는 의미론 모순이 아니라 구현 노트 갱신 수준이다. Critical 또는 Warning 등급의 충돌은 발견되지 않았다.

---

## 위험도

**NONE**
