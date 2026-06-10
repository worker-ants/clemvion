# 성능(Performance) 리뷰 결과

리뷰 대상: perf 백로그 01 구현 관련 spec 갱신 및 consistency 리뷰 산출물
diff-base: origin/main

---

## 발견사항

### [INFO] `S3Service.deleteMany` — 1000키/청크 상한 명시, 구현 검증 필요
- 위치: `spec/data-flow/4-file-storage.md` 라인 1309 (변경 후)
- 상세: spec 이 "1000키/요청 청크" 를 명시했다. S3 `DeleteObjects` API 의 하드 상한이 1000 이므로 청킹 자체는 올바르다. 그러나 spec 에는 청킹 루프의 동시성 전략이 기술되지 않았다 — KB 당 문서 수가 수천 건에 달하면 청크 단위 순차 직렬 삭제는 불필요한 지연을 유발한다. 실제 구현(`s3.service.ts`)이 `Promise.all` 병렬 청크 처리를 하는지, 또는 순차 직렬인지 spec 에 명시되지 않았다. 문서 수가 크지 않은 현재 사용 패턴에서는 성능 영향이 작으나, KB 규모가 커질 경우 문제가 될 수 있다.
- 제안: 현재 청크 처리가 순차라면 `Promise.all(chunks.map(...))` 로 병렬 청크 처리를 고려한다. spec 에도 "청크를 병렬 또는 순차 처리" 중 선택한 전략을 한 문장으로 병기하면 단일 진실 원칙이 강화된다.

---

### [INFO] `rehydrateContext` 배치 조회 — `startedAt DESC` 정렬 + 첫 등장 채택의 메모리 사용
- 위치: `spec/5-system/4-execution-engine.md` §7.5 rehydration, `rationale_continuity.md` 관련 기술
- 상세: 배치 조회로 전환 시 `nodeExecutionRepository.find({ where: { nodeExecutionId: In([...]) }, order: { startedAt: 'DESC' } })` 가 nodeExecution 행 전체를 메모리에 올린 뒤 JS 레벨에서 첫 등장만 채택한다. 재개 시점의 active nodeExecution 수가 수십 건이면 무시할 수준이지만, 복잡한 워크플로우에서 수천 번 반복된 노드(back-edge 순환)가 있으면 불필요하게 많은 행이 메모리에 로드된다. spec 의 "nodeId 당 최신 COMPLETED 1건 채택" 의미론은 DB 레벨 `DISTINCT ON (node_id)` 또는 윈도우 함수로 DB 단에서 해결 가능하다.
- 제안: 규모가 크지 않은 현재 워크플로우에서는 INFO 수준이지만, 순환 노드 실행 횟수가 `MAX_NODE_ITERATIONS(100)` 에 근접하는 경우를 대비해 `DISTINCT ON (node_id) ORDER BY started_at DESC` 쿼리를 도입하거나, 최소한 nodeId 수가 임계값을 넘으면 경고 로깅을 추가하는 것을 고려한다.

---

### [INFO] `resolveMaxNodeIterations` / `resolveParallelEngineFlag` lazy `??=` 패턴 — multi-instance 공유 전제
- 위치: `spec/5-system/4-execution-engine.md` §2.1 표, `spec/4-nodes/1-logic/10-parallel.md` 라인 14 (변경 후), `rationale_continuity.md` INFO 항목
- 상세: lazy 초기화(`??=`)는 인스턴스별 1회 env 읽기를 보장하므로 "모듈 로드 시 1회 읽음" 규약과 기능적으로 동등하다. 성능상 장점이 있다 — env 변수 재파싱 오버헤드를 첫 호출 1회로 상각. 단, `process.env` 읽기 자체는 이미 O(1) 이므로 이 최적화가 실질 병목을 해결하기보다는 "read-once 의미론 명확화"에 더 가깝다. spec 에 "모듈 로드 시 1회 읽음" 으로 기술된 계약이 실제로는 "첫 호출 시 1회" 인 점에 대해 혼동이 생길 수 있으나 성능 상 차이는 없다.
- 제안: 없음 (성능 영향 없는 INFO 수준 관찰).

---

### [INFO] frontend `execution-store` WeakMap-memoized `selectSortedNodeResults` — memoization key 의존성
- 위치: `codebase/frontend/src/lib/stores/execution-store.ts` (spec 의 `rationale_continuity.md` 에서 기술)
- 상세: `WeakMap` memoization 은 배열 참조가 변경될 때 자동으로 캐시 무효화된다는 점에서 안전하다. 그러나 mutation 마다 새 배열 참조가 생성된다면 매 mutation 후 첫 접근 시 재정렬이 발생한다 — O(n log n). `nodeResults` 배열이 매 WebSocket 이벤트마다 갱신되고 컴포넌트가 매 갱신 직후 정렬된 결과를 읽는 경우, WeakMap-memoize 의 이점이 약화된다. 실행 완료 후 "읽기 전용" 단계에서는 이점이 명확하지만 실행 진행 중 빈번한 mutation 구간에서의 실질 이득은 구현 세부에 따라 달라진다.
- 제안: 실행 완료 후 타임라인 렌더링에는 확실한 이득이 있다. 진행 중 재정렬 빈도가 높은 경우 `nodeResults` 를 `startedAtEpoch` 기준 정렬 상태로 유지하는 삽입 정렬(O(n))이 WeakMap 재정렬(O(n log n))보다 유리할 수 있다. 현재 구현이 도착순 유지 + 읽기 시 정렬 방식이므로, 이벤트 빈도가 낮은 일반 워크플로우에서는 INFO 수준.

---

## 요약

이번 변경은 주로 spec 문서 갱신(S3 배치 삭제 API 추가, env read-once 규약 명시, rehydration 배치 조회)과 consistency·plan 정합 리뷰 산출물이다. 성능 최적화가 목적인 구현(N+1 → 배치, 반복 env 읽기 → lazy 캐시, frontend 정렬 최적화)을 반영한 spec 갱신이므로 변경 방향 자체는 성능 관점에서 올바르다. 주요 관찰 사항은 두 가지다: (1) S3 `deleteMany` 청킹 전략에서 청크 간 병렬 처리 여부가 spec 에 미기재 — KB 규모 성장 시 잠재 병목. (2) `rehydrateContext` 배치 조회가 DB 필터링 없이 JS 레벨에서 첫 등장 채택 방식을 쓰는데, back-edge 순환이 많은 워크플로우에서 불필요한 메모리 로드 가능성이 있다. 두 사항 모두 현재 일반적 사용 규모에서는 INFO 수준이며 기능 회귀는 없다.

---

## 위험도

NONE
