# Rationale 연속성 검토 결과

검토 범위: perf 백로그 01 구현 (rehydration 배치/KB deleteMany/dashboard 집계/import 배치/env read-once/frontend execution-store B안)
diff-base: origin/main

---

## 발견사항

### [INFO] KB `deleteMany` best-effort 의미론 — Rationale 갱신 완료, 정합 확인
- target 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `remove()`, `codebase/backend/src/common/services/s3.service.ts` `deleteMany()`
- 과거 결정 출처: `spec/data-flow/4-file-storage.md` `## Rationale > s3Service.delete 실패가 warn 처리인 이유`
- 상세: 기존 Rationale 는 단건 경로(`removeDocument`)의 try/catch warn 만 언급하던 최초 서술에서 이미 `spec-update-perf-backlog-01.md` 동반 spec 갱신으로 "배치 경로(`remove` 의 `deleteMany`)는 응답 `Errors[].Key` 를 일괄 warn — 둘 다 동일한 best-effort 의미론" 이라는 병기가 반영됐다. 구현도 이 서술과 일치한다. 이미 기각된 대안(단건 루프)은 코드에서 제거됐으며 Rationale 는 새 경로를 합의 원칙의 연장으로 명시하고 있다.
- 제안: 없음 (정합 완료).

### [INFO] dashboard `getSummary` 집계 쿼리 통합 — 분모 의미론 Rationale 정합 확인
- target 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts` `getSummary()`
- 과거 결정 출처: `spec/2-navigation/0-dashboard.md` `## Rationale > Success Rate 분모 = 7일 전체 실행 건수 (§3)`
- 상세: 6쿼리 5왕복을 2쿼리로 통합하면서 성공률 분모("status 무관 7일 내 전체 실행 건수")가 `COUNT(*) FILTER (WHERE e.started_at >= :sevenDaysAgo)` 로 유지됐고, 분자는 `FILTER (WHERE ... AND e.status = :completedStatus)` 로 분리됐다. Rationale 에서 "분모를 `completed+failed` 로 바꾸려면 구현 변경이 필요 — 현 시점 미채택"으로 명시적으로 기각된 분모 정의와 충돌하지 않는다. 구현이 합의 원칙(분모 = 전체 7일 건수)을 그대로 준수한다.
- 제안: 없음 (정합 완료).

### [INFO] env read-once 캐시 (`resolveMaxNodeIterations` / `resolveParallelEngineFlag`) — Rationale 정합 확인
- target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `resolveMaxNodeIterations()`, `resolveParallelEngineFlag()`
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §2.1 표 `MAX_NODE_ITERATIONS` 행("모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영"), `spec/4-nodes/1-logic/10-parallel.md` line 14 `PARALLEL_ENGINE` 서술("모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영")
- 상세: lazy 초기화 패턴(`??=`)은 인스턴스 생성 후 첫 사용 시 1회 읽어 캐시하므로 "모듈 로드 시 1회 읽음" 규약과 동등하다. 코드 주석도 "lifecycle hook 대신 lazy 초기화라 직접 생성되는 단위 테스트에서도 안전"을 명시, 기존 `resolveExecutionRunWorkerConcurrency` 선례와 정렬된다.
- 제안: 없음 (정합 완료).

### [INFO] `assertNoContainerCycle` 시그니처 변경 — spec 미언급 내부 리팩터, 번복 없음
- target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `assertNoContainerCycle()` 및 `planContainerBody()` 호출 위치
- 과거 결정 출처: `spec/1-data-model.md`·`spec/3-workflow-editor/0-canvas.md`·`spec/data-flow/11-workflow.md` — `CONTAINER_CYCLE` 에러로 거부한다는 원칙 기록 (구체 시그니처는 spec 비기재 내부 구현)
- 상세: `allNodes: Node[]` 전수 스캔에서 이미 빌드된 `children: Node[]` + `byId: Map` 재사용으로 시그니처가 바뀌었다. cycle 검출 로직(직접 자식에서 `containerId` 조상 체인 추적)은 동일하고 에러 코드(`CONTAINER_CYCLE`)도 보존된다. spec 의 "순환 거부" 원칙에 반하는 변경이 없다.
- 제안: 없음 (정합 완료).

### [INFO] `importWorkflow` 배치 insert — hook/cascade 부재 전제 코드 주석 있으나 spec 비기재
- target 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `importWorkflow()` + `workflows.service.spec.ts` W3c 가드
- 과거 결정 출처: `spec/2-navigation/1-workflow-list.md` `## Rationale > Import 의 permissive config 정책 (§3.2)` (import 정책의 hard/soft fail 분리 원칙)
- 상세: 구현이 `manager.insert` 배치로 전환하면서 `@BeforeInsert` hook·cascade 부재를 **런타임 전제**로 둔다. 이 전제는 현재 코드에서 사실이고 W3c 회귀 가드로 고정됐다. spec Rationale 에는 이 배치 insert 전제(hook 부재 등)가 명시되지 않았으나, import 행위의 외부 계약(permissive config 정책, hard-fail 구조 기준)은 변경이 없다. "향후 hook 추가 시 배열 save 로 되돌릴 것" 경고가 코드 주석에만 있고 spec Rationale 에는 부재한다.
- 제안: `spec/2-navigation/1-workflow-list.md` `## Rationale` 에 "현 구현은 `manager.insert` 배치를 사용해 `@BeforeInsert` hook·cascade 부재를 전제한다. 향후 hook 추가 시 배열 `save` 로 복귀 필요" 한 문장을 INFO 수준 병기하면 코드 주석과 spec 이 일치하게 된다.

### [INFO] frontend execution-store `selectSortedNodeResults` accessor + index Map — spec 미기재 내부 최적화
- target 위치: `codebase/frontend/src/lib/stores/execution-store.ts` `selectSortedNodeResults`, `nodeResultIndexByExecId`, `lastIndexByNodeId`, `firstNoExecIdIndexByNodeId` 및 관련 컴포넌트
- 과거 결정 출처: `spec/3-workflow-editor/3-execution.md` (§5 nodeResults 타임라인 — 시간순 정렬 언급 없이 기능 기술), `spec/conventions/interaction-type-registry.md` (execution-store.ts 파일 참조)
- 상세: 정렬을 store 내부에서 매 mutation 에 수행하던 방식에서 "store = 도착순 유지, 읽기 시 WeakMap-memoized accessor 적용"으로 변경됐다. spec 의 타임라인 UI 표시 동작(시간순 정렬)은 변경되지 않는다. 외부 계약(표시 순서) 불변, 내부 구현(정렬 위치) 최적화다. ghost-row fallback(no-exec-id 이벤트)과 `findNodeResult` O(1) index Map 도 spec 비기재 내부 구현이며 기존 Rationale 와 충돌하지 않는다.
- 제안: 없음 (spec 은 UI 동작 기술, 내부 정렬 구현은 spec 기술 범위 밖).

### [INFO] rehydration N+1 → 배치 `In()` 조회 — spec 불변식 보존 확인
- target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `rehydrateContext()` 내 `nodeExecutionRepository.find` 배치 조회
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale > park 즉시 해제 + slow-path 일원화 (Phase B)` — "무손실 전제 — durable 영속 (Phase A)" 서술. §7.5 rehydration 의 "startedAt DESC 전역 정렬에서 nodeId 별 첫 등장 row = 최신 COMPLETED" 의미론
- 상세: 배치 조회로 전환하면서 "nodeId 당 최신 COMPLETED 1건 채택" 의미는 `completedRows` 배열에서 `if (!latestCompletedByNodeId.has(row.nodeId))` 첫 등장만 취하는 방식으로 구현됐고, 이는 기존 per-node `findOne(order DESC)` 와 동일 의미론이다. spec Rationale 의 "무손실 rehydration" 불변식을 준수한다.
- 제안: 없음 (의미 동일 검증됨).

---

## 요약

검토된 perf 백로그 01 구현 변경사항 전체(KB deleteMany, dashboard 집계, rehydration 배치, env read-once, importWorkflow 배치 insert, frontend execution-store B안)에 걸쳐, 과거 spec Rationale 에서 명시적으로 기각된 대안의 재도입이나 합의된 설계 원칙 위반은 발견되지 않았다. KB deleteMany의 best-effort/warn 의미론, dashboard 성공률 분모 원칙, env read-once 규약, CONTAINER_CYCLE 에러 거부 원칙 모두 기존 Rationale 와 정합하게 구현됐다. 하나의 INFO 사항으로 `importWorkflow`의 `manager.insert` 배치 전제(hook/cascade 부재)가 코드 주석에만 기술되고 spec Rationale 에는 미기재된 점이 있어 향후 hook 추가 시 가이던스를 spec 에 병기하면 단일 진실 원칙이 강화된다.

---

## 위험도

NONE
