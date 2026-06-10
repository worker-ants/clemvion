# Rationale 연속성 검토 결과

## 발견사항

### [INFO] perf #14 — lazy 초기화가 plan A안(onModuleInit) 대비 변형 구현임을 Rationale 에 명시하지 않음
- **target 위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` lines 829–850 (`maxNodeIterationsOnce`, `parallelEngineFlagOnce` 필드 및 `resolveMaxNodeIterations`, `resolveParallelEngineFlag`)
- **과거 결정 출처**: `plan/in-progress/refactor/01-performance.md` §#14 — A안은 `onModuleInit` 에서 필드를 1회 적재(`resolveExecutionRunWorkerConcurrency` sanitize 패턴 준용)로 정의됨. `spec/4-nodes/1-logic/10-parallel.md` §P1 note — "모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영". `spec/5-system/4-execution-engine.md` §2.1 표 (`MAX_NODE_ITERATIONS` 행) — 동일 "모듈 로드 시 1회 읽음" 규약.
- **상세**: plan A안은 `onModuleInit` 에서 미리 적재하는 패턴(자매 env `resolveExecutionRunWorkerConcurrency` 전례)을 채택 결정으로 기록했다. 실제 구현은 `??=` nullable-field lazy 초기화로 첫 호출 시점에 읽는 방식을 선택했다. 두 방식 모두 "read-once per instance" 의미론을 달성하므로 기능적 동일성은 유지된다. 구현 주석도 이유를 설명한다("직접 생성되는 단위 테스트에서도 안전하다"). 단, plan 자체의 #14 완료 노트가 "A안 구현 (lazy read-once)" 으로 스스로 변형을 인정하면서도, 해당 코드 구현의 JSDoc 이나 spec Rationale 에 "onModuleInit 대신 lazy 를 선택한 이유(테스트 직접 생성 호환)"를 명시적으로 기록하지 않았다. 향후 리뷰어가 spec "모듈 로드 시 1회 읽음" 문구와 lazy init 코드 사이의 간극을 오해할 수 있다.
- **제안**: 현재 JSDoc 주석에 이미 이유의 핵심이 있으므로 BLOCKING 사안은 아니다. 필요하다면 spec `4-execution-engine.md §2.1` 의 `MAX_NODE_ITERATIONS` 행 비고에 "lazy 초기화로 구현(첫 호출 시 1회 읽음 = read-once 의미론 동일, onModuleInit 대신 lazy 선택 이유: 단위 테스트 직접 생성 호환)"을 한 줄 추가하면 충분하다.

---

### [INFO] perf #3/#8 — `sortByStartedAt` 함수명이 spec/코드 주석에 남아 있어 `selectSortedNodeResults` 로의 이름 전환이 spec 수준에서 미기록
- **target 위치**: diff 내 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 주석 4곳 — 기존 `sortByStartedAt` 언급이 `selectSortedNodeResults` 로 갱신됨.
- **과거 결정 출처**: 직접적으로 해당하는 spec Rationale 없음. `spec/5-system/6-websocket-protocol.md` 및 `spec/2-navigation/0-dashboard.md` 에는 timeline 정렬 관련 rationale 없음. perf #3 plan 이 "store 비정렬 + selector 정렬"(B안)을 결정 근거로 기술.
- **상세**: `sortByStartedAt` 은 과거 store 내부 정렬 함수 명칭이고, `selectSortedNodeResults` 는 B안 적용 후의 WeakMap-memoized selector 명칭이다. diff 내 주석 갱신은 내부 일관성을 유지하며 spec Rationale 와 직접 충돌하지 않는다. 다만 어느 spec 문서에도 "store 는 도착순 유지 + read 시점에 `selectSortedNodeResults` 로 정렬" 원칙이 Rationale 로 기록되지 않았다 — 향후 유사 PR 에서 "왜 store 가 정렬을 하지 않는가"를 추적할 단서가 code comment 에만 존재한다.
- **제안**: `spec/5-system/6-websocket-protocol.md` 또는 frontend execution store 관련 spec이 있다면 Rationale 에 "store 는 도착순 유지, 타임라인 정렬은 `selectSortedNodeResults` accessor가 WeakMap memoize 로 위임 (perf #3/#8 B안)" 을 한 줄 추가. 현재 미충돌이므로 INFO 수준.

---

### [INFO] perf #10 — `manager.insert` 사용의 전제(hook/cascade 부재)가 spec Rationale 에 미기록
- **target 위치**: `codebase/backend/src/modules/workflows/workflows.service.ts` lines 267–354 (importWorkflow 배치 insert 전환)
- **과거 결정 출처**: `spec/2-navigation/1-workflow-list.md` §Rationale §2 "Import 의 permissive config 정책" — import 구현 방향에 대한 기존 Rationale. `manager.insert` vs `manager.save` 선택에 대한 Rationale 는 없음.
- **상세**: 기존 spec Rationale §2 는 config soft-fail 정책만 기술하며 영속화 방식(save vs insert)에는 언급이 없다. target diff 는 `manager.save` 를 `manager.insert` 로 전환하면서 "hook/cascade 부재 전제 — Node/Edge 엔티티 2026-06-10 확인, 향후 hook 추가 시 배열 save 로 되돌릴 것" 경고를 코드 주석으로 명시했다. 이 전제는 기각된 대안이 아니라 신규 채택 결정이므로 기존 Rationale 와 충돌하지 않는다. 다만 spec Rationale 에 "batch insert 전제: hook/cascade 부재 — 변경 시 save 로 복귀" 한 줄이 없어 코드 주석에만 의존하고 있다. 테스트(W3c)가 전제를 fixture 수준에서 고정하고 있어 회귀 방어는 되어 있다.
- **제안**: `spec/2-navigation/1-workflow-list.md` §Rationale §2 또는 §3 import 절에 "Node/Edge 영속화는 배치 insert — `@BeforeInsert` hook·cascade 부재 전제(W3c 테스트가 메타데이터 가드). 전제 깨지면 `manager.save([], [])` 로 전환할 것" 을 추가하면 spec-code 단일 진실 원칙에 부합한다.

---

## 요약

본 검토 범위의 target 변경(perf 백로그 01 전 항목 구현: rehydration N+1 제거 #1, S3 deleteMany 배치 #2, 정렬 accessor 전환 #3/#8, dashboard 집계 2쿼리 #4, 컨테이너 사이클 리팩터 #5, BFS 포인터 최적화 #6, 카탈로그 WeakMap 캐시 #7, 워크플로 import 배치 insert #10, env read-once lazy 캐시 #14)는 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 항목이 없다. S3 삭제의 best-effort/warn 의미론, dashboard Success Rate 분모 의미론, PARALLEL_ENGINE/MAX_NODE_ITERATIONS read-once 규약, import permissive config 정책 등 각 spec Rationale 의 핵심 원칙이 모두 보존됐다. 발견된 세 항목은 모두 INFO 등급으로, 과거 결정 번복이 아니라 "신규 채택 근거가 spec Rationale 에 미기록"된 보완 제안 수준이다.

## 위험도

NONE
