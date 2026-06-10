# 아키텍처(Architecture) 리뷰 결과

리뷰 대상: perf 백로그 01 구현 (rehydration N+1 배치화, KB deleteMany, dashboard 집계 통합, import 배치 insert, env read-once 캐시, frontend execution-store B안, system-prompt 노드 카탈로그 캐시, assertNoContainerCycle 리팩터, BFS 큐 최적화)

---

## 발견사항

### [INFO] `ExecutionEngineService` God Object 압력 지속 — 신규 상태 필드 2종 추가
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `maxNodeIterationsOnce`, `parallelEngineFlagOnce` 필드 추가 (약 9,254 라인)
- 상세: read-once 캐시를 서비스 인스턴스 필드로 직접 추가했다. 기존 `resolveExecutionRunWorkerConcurrency` 패턴을 따른 것이므로 일관성은 있으나, 실행 엔진 단일 서비스가 설정 캐시 관리·그래프 순회·노드 dispatch·상태 머신 전이 등 다수 책임을 계속 흡수하고 있다. 이번 변경 자체는 최소 침습이며 해당 패턴의 반복이지만, God Object 경향의 지표다.
- 제안: 단기적으로 문제없음. 중기적으로 `ExecutionConfigCache` 전담 서비스나 별도 value object로 분리하면 단일 책임 원칙 준수에 도움이 된다. spec §4.4 Rationale 의 "단일 sink 정책" 결정과 마찬가지로 현 시점에서는 YAGNI 범주이므로 INFO 처리.

---

### [INFO] `importWorkflow`의 `manager.insert` — 레이어 투과 전제 조건이 서비스 레이어에 노출
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts`, `importWorkflow` 메서드 내 배치 insert 블록
- 상세: ORM Entity 내부 구현 세부사항(`@BeforeInsert` hook 부재, cascade 부재)을 서비스 레이어 코드 주석에 "런타임 전제"로 명시했다. 이는 데이터 레이어의 내부 구조가 서비스 레이어의 동작 정확성 조건이 되는 결합이다. 코드 주석 + W3c 회귀 가드로 보강한 점은 긍정적이지만, hook이 나중에 추가되어도 컴파일 타임에 이를 감지할 방법이 없다.
- 제안: `consistency-check`의 rationale 섹션에 명시하도록 `rationale_continuity.md`의 INFO 제안(spec에 한 줄 병기)을 이행하면 단일 진실 원칙을 강화할 수 있다. 아키텍처 위반보다는 취약 결합 지점이므로 INFO 등급.

---

### [INFO] frontend `execution-store`의 파생 인덱스 Map 관리 — Store 내 중복 상태 도입
- 위치: `codebase/frontend/src/lib/stores/execution-store.ts` — `nodeResultIndexByExecId`, `lastIndexByNodeId`, `firstNoExecIdIndexByNodeId` 3개 Map + `nodeResults` 배열
- 상세: 동일 데이터에서 파생되는 인덱스 Map 4종(원본 포함)이 store 상태로 공존한다. Zustand store가 단순 이벤트 리듀서 역할에 더해 파생 캐시 정합성 관리 책임을 가지게 됐다. 인덱스 Map은 `nodeResults` 배열의 함수이지만 `setState`로 우회 주입할 경우 인덱스가 stale해지는 코너 케이스를 코드 주석으로 방어하고 있다. `selectSortedNodeResults`의 WeakMap 메모화와 달리, 이 인덱스 Map은 store state 객체 자체에 포함돼 있어 "도출 가능한 상태를 도출하지 않는다"는 단일 진실 원칙과 긴장 관계에 있다.
- 제안: 현재 구현은 O(1) 탐색 성능을 확보하기 위한 명시적 trade-off이며 코드 주석에 이유가 기술돼 있다. 향후 `nodeResults` 변경 경로가 증가하면 인덱스 정합성 유지 부담이 커질 수 있다. Immer/selector 패턴이나 `useMemo` 기반 파생 Map을 활용하면 store에서 파생 상태를 분리할 수 있다. 현 시점은 성능 요구가 명확하므로 INFO 등급.

---

### [INFO] `findNodeResult` 공개 메서드 — Store 쿼리 책임을 외부에서 store로 이동
- 위치: `codebase/frontend/src/lib/stores/execution-store.ts` + `codebase/frontend/src/lib/websocket/use-execution-events.ts`
- 상세: `use-execution-events.ts`에서 반복되던 `nodeResults.find(...)` inline 탐색 로직이 store의 `findNodeResult` 메서드로 일원화됐다. 이는 응집도 향상(탐색 로직이 store로 집중)과 동시에 store가 단순 상태 컨테이너를 넘어 쿼리 메서드를 가지는 형태가 된다. Zustand store의 일반적 패턴(action + selector)과 일치하는 방향이며 잘못된 것은 아니나, store 인터페이스가 점진적으로 확장되는 경향이다.
- 제안: 탐색 로직의 store 집중은 올바른 응집도 개선이다. 이슈 없음.

---

### [INFO] `assertNoContainerCycle` 시그니처 변경 — 성능 최적화와 인터페이스 결합도 조정
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `assertNoContainerCycle` private 메서드
- 상세: 기존 `(containerNode, allNodes)` → `(containerNode, children, byId)` 로 변경되어 호출자(`planContainerBody`)가 이미 계산한 자료구조를 재사용한다. 성능 개선이 목적이며 검사 의미는 동일하게 보존된다. 단, private 메서드를 호출자가 이미 보유한 파생 자료구조에 의존하도록 설계하면 메서드가 호출 컨텍스트에 암묵적으로 결합된다. `children`이 `containerNode`의 직접 자식이어야 한다는 전제가 시그니처에서 명시되지 않는다.
- 제안: 현재 private 메서드이고 호출처가 단일이므로 실질적 위험은 없다. 코드 주석으로 "children = containerNode의 직접 자식" 전제를 명시하면 충분하다.

---

### [INFO] `S3Service.deleteMany` — `common/services` 레이어에 도메인 의미론 주석 포함
- 위치: `codebase/backend/src/common/services/s3.service.ts` — `deleteMany` JSDoc 내 "KB 삭제 cleanup 전용" 문구
- 상세: `s3.service.ts`는 공통 인프라 서비스(`common/services`)에 위치하며 도메인 비종속이어야 한다. `deleteMany`의 JSDoc에 "KB 삭제 cleanup 전용"이라는 도메인 한정 설명이 포함돼 인프라 레이어에 도메인 컨텍스트가 누출됐다. `spec/data-flow/4-file-storage.md` 코드 진입점 설명에도 "(DeleteObjects 배치 — KB 삭제 cleanup 전용)"이 명시돼 있어 동일 의도의 반복이다.
- 제안: `deleteMany`의 JSDoc에서 "KB 삭제 cleanup 전용" 문구를 제거하고 "다수 키를 배치 삭제한다"는 범용 설명으로 교체한다. KB 특화 용도 기술은 `knowledge-base.service.ts` 호출부 주석 또는 spec 파일에 위치시키는 것이 레이어 책임 분리에 맞다. 기능에 영향 없으므로 INFO 등급.

---

## 요약

perf 백로그 01 구현 전반에서 아키텍처적으로 심각한 위반은 없다. SOLID 원칙 및 레이어 책임 측면에서 가장 주목할 점은 두 가지다: (1) `ExecutionEngineService`가 이미 약 9,250 라인 규모의 God Object 압력을 받는 상황에서 read-once 캐시 필드가 서비스 인스턴스에 직접 추가되는 패턴이 반복되고 있다는 점 — 당장의 위험은 없으나 이 모듈에 기능이 누적될수록 단일 책임 원칙 준수가 어려워진다. (2) frontend `execution-store`에 파생 인덱스 Map 3종이 도입됨으로써 store가 단순 상태 컨테이너를 넘어 정합성 관리 책임을 가지게 됐다 — 성능 요구사항에 의한 명시적 trade-off이나 향후 변경 경로가 늘어나면 정합성 유지 부담이 증가할 수 있다. `importWorkflow`의 hook/cascade 부재 런타임 전제가 서비스 레이어에 노출된 점과 `S3Service.deleteMany`의 도메인 문구 누출도 INFO 수준의 레이어 경계 문제다. 전반적으로 구현이 기존 패턴을 일관성 있게 따르고 있고 순환 의존성·모듈 경계 위반은 발견되지 않는다.

---

## 위험도

LOW
