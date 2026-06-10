# Code Review 통합 보고서

## 전체 위험도
**LOW** — perf 백로그 01 순수 성능 리팩터(N+1 제거·집계 통합·O(N²)→O(N)·배치 insert/delete·메모이즈). 행위 의미론은 회귀 가드 테스트로 잘 고정됐고 CRITICAL 없음. 잔여 WARNING 은 frontend store 인덱스 동기화 복잡도와 DB 의미론·hook 우회 전제의 단위 테스트 갭(integration 보강 권장).

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Architecture / Maintainability | `execution-store` 의 파생 인덱스 Map 3종(`nodeResultIndexByExecId`/`lastIndexByNodeId`/`firstNoExecIdIndexByNodeId`)이 store 상태로 승격돼 `addNodeResult`/`startExecution`/`reset` 가 손으로 정합 유지. 불변식이 여러 지점에 흩어져(약 80줄, 분기 깊이 3) 향후 mutation 추가 시 누락하면 silent desync. 현재는 reset 3경로 재초기화 + read/write 양측 stale 가드(`nodeResults[idx]?.nodeExecutionId === ...`)로 안전하나 규율(주석)에만 의존 | `codebase/frontend/src/lib/stores/execution-store.ts` (인터페이스 :213-241, `addNodeResult` :521-635) | 인덱스 갱신/초기화를 `appendRow`/`updateRow`/`EMPTY_RESULT_INDICES()` 단일 헬퍼로 캡슐화(차기 리팩터, 본 PR 차단 아님). 현 stale 가드는 적절한 방어선 |
| W2 | Testing / Side Effect | env read-once 캐시(`resolveMaxNodeIterations`/`resolveParallelEngineFlag`)가 인스턴스 수명 첫 값으로 동결 — 런타임 동적 재읽기 의미 상실. 자매 env 규약과 정렬되나 "configService.get 1회만 호출" 직접 테스트 부재(값이 default 와 같아 캐시 회귀해도 침묵) | `execution-engine.service.ts` `resolveMaxNodeIterations`/`resolveParallelEngineFlag` (:1353-1368) | 코드 유지. spec §1.6 read-once 문구 동기화는 `spec-update-perf-backlog-01.md §2` draft 에 포함(SPEC-DRIFT S2 참조). 선택: 두 번째 호출이 `get` 재호출 안 함을 spy call-count 로 1건 |
| W3 | Testing | 단위 테스트가 닿지 못하는 의미론 갭 3종: (a) dashboard `prev7d` [14d,7d) 구간이 WHERE `>= 14d` 하한 + FILTER `< 7d` 상한 **조합**으로 표현되는데 mock QB 라 off-by-one 미검증, (b) `assertNoContainerCycle` 시그니처 변경(#5)·BFS `shift()`→head 포인터(#6)에 diff 내 직접 가드 부재, (c) `importWorkflow` 배치 insert 의 hook/cascade 우회 전제가 mock insert 라 단위로 강제 불가 | `dashboard.service.ts:1064-1098`; `execution-engine.service.ts` (cycle :7902-7935, BFS :8266-8523); `workflows.service.ts` importWorkflow | integration/e2e 보강 정석: (a) 6d/8d/13d/15d 경계 fixture 로 total7d/prev7d 분류 고정, (b) 컨테이너 사이클 named-error 1건 + branch reachability 순서 1건(기존 테스트 간접 커버 여부 먼저 확인), (c) import 왕복 후 실제 Node 행 컬럼 검증 또는 Node/Edge `@BeforeInsert`/cascade 부재 메타데이터 가드 테스트 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | Performance / Concurrency | dashboard 두 독립 집계 쿼리(`wfCounts`/`execAgg`)를 직렬 await — `Promise.all` 로 묶으면 왕복 1회 추가 절감(읽기 전용, race 없음) | `dashboard.service.ts` `getSummary` | 선택적 latency 최적화. 6→2 핵심 성과는 이미 달성 |
| I2 | Maintainability | `selectSortedNodeResults` 가 소비처 4곳으로 확산 — "정렬된 뷰는 accessor 로만" 이 컴파일러 강제 없는 암묵 계약. `nodeResults` JSDoc "Arrival-ordered(NOT sorted)" 경고가 1차 방어 | `use-expression-context.ts`/`run-results-drawer.tsx`/`transform/preview.tsx` | 선택: `useSortedNodeResults()` 훅으로 진입점 좁히기 |
| I3 | Maintainability | dashboard `Math.round(...*10000)/100` 백분율 식이 changePercent·successRate 2곳 중복(기존 답습, 회귀 아님) | `dashboard.service.ts` | 선택: `roundPercent2dp()` 헬퍼 통일 |
| I4 | Dependency | `typeorm/query-builder/QueryPartialEntity` 내부 deep-path 타입 import — `import type` 이라 런타임 0, 빌드 타임 결합만. caret+lock 으로 안정 | `workflows.service.ts:10` | 선택: 루트 노출 시 루트 import 로 교체 |
| I5 | Security | dashboard raw SQL FILTER, S3 `deleteMany`, rehydration `In()` 배치 — 동적 값 전부 ORM/SDK 파라미터 바인딩, 인젝션 표면 없음. `randomUUID` CSPRNG. 신규 하드코딩 시크릿 없음 | backend 6파일 | 조치 불요 |
| I6 | Testing | S3/KB/system-prompt/execution-store 회귀 가드 테스트 충실(청크 경계 0/1/1000/1001, best-effort 4분기, WeakMap hit/miss/reset, ghost-row fallback). 미커버: `deleteMany` `?? []` 무-Errors 경로, execution-store stale-index fallback 직접 단언 | 각 `*.spec.ts` | 선택 보강 |

## SPEC-DRIFT (코드가 옳고 spec 이 낡음 — planner 트랙)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| S1 | SPEC-DRIFT | `[SPEC-DRIFT]` KB 삭제 S3 정리: spec 본문이 아직 단건 for 루프(`s3Service.delete(doc.fileUrl)`) 서술. 코드는 `deleteMany` 배치 1회로 교체(best-effort/warn 의미 보존). `spec-update-perf-backlog-01.md §1` draft 로 추적 중 | spec `spec/data-flow/4-file-storage.md` §3 표/인용 (:102-103); 코드 `knowledge-base.service.ts` `remove` | 코드 유지. project-planner 가 draft §1 문구로 spec 갱신(코드 revert 아님) |
| S2 | SPEC-DRIFT | `[SPEC-DRIFT]` env read-once: §1.6 `MAX_NODE_ITERATIONS`/`PARALLEL_ENGINE` 행에 read-once 문구 부재(자매 env 행에는 존재, 비대칭). 코드는 lazy read-once 로 전환. `spec-update-perf-backlog-01.md §2` draft 로 추적 | spec `spec/5-system/4-execution-engine.md` §1.6 (:206); 코드 `resolveMaxNodeIterations`/`resolveParallelEngineFlag` | 코드 유지. project-planner 가 §1.6 표에 read-once 문구 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿/인가 변화 없음. 모든 동적 값 파라미터 바인딩 |
| performance | LOW | 일관된 명백한 개선. 잠재 부채는 `manager.insert` hook 우회 전제(코드 가드 부재) |
| architecture | LOW | 경계/레이어 보존·개선. W1 store 파생 인덱스 정합 책임 승격 |
| requirement | LOW | 의미론 정확 보존(검증 완료). SPEC-DRIFT 2건 추적됨 |
| scope | NONE | 전 변경 `perf #N` 백로그와 1:1, 범위 밖·잡음 없음 |
| side_effect | LOW | W2 env read-once 동적 재읽기 상실(수용 가능). hook 우회 Node/Edge 한정 안전 |
| maintainability | LOW | 패턴 일관·주석 충실. W1 인덱스 3종 수동 동기화 인지 부하 |
| testing | LOW | 테스트 품질 높음. W3 DB 의미론·hook 전제·cycle/BFS 단위 갭 |
| documentation | LOW | JSDoc 충실, stale 주석 없음. spec 2건 draft 로 추적 |
| dependency | LOW | manifest 변경 0, deep-path 타입 import(I4)만 미미 |
| database | LOW | DDL/마이그레이션 0. 기존 인덱스(V034 등) 커버 확인 |
| concurrency | LOW | 단일 스레드 전제 안전, 데드락·찢김 없음. I1 병렬화 여지 |
| api_contract | NONE | HTTP 계약 표면 무변경, 반환 형태 테스트로 고정 |
| user_guide_sync | NONE | 매트릭스 18 trigger 매칭 0, 누락 0 |

## 발견 없는 에이전트
실질 발견 없음(NONE, "해당 없음"): **api_contract**, **user_guide_sync**, **scope**, **security** — 모두 차단/수정 대상 0건의 정보성·무해당 확인.

## 권장 조치사항
1. **(W3) integration/e2e 보강** — (a) dashboard prev7d [14d,7d) 경계 fixture(6d/8d/13d/15d), (b) `importWorkflow` 왕복 후 Node 행 컬럼 검증 또는 Node/Edge `@BeforeInsert`/cascade 부재 메타데이터 가드, (c) 컨테이너 사이클·BFS reachability 직접 가드(기존 간접 커버 확인 후). 단위로 닿지 못하는 의미론·안전 전제라 회귀 비용이 높음.
2. **(W1) execution-store 인덱스 동기화 헬퍼 추출** — `appendRow`/`updateRow`/`EMPTY_RESULT_INDICES()` 캡슐화로 불변식 단일화(차기 리팩터, 본 PR 차단 아님).
3. **(W2) env read-once 캐시 회귀 가드(선택)** — `get` call-count spy 1건 + 향후 동적 reconfiguration 시 캐시 무효화 부재 주석화.
4. **(S1·S2) project-planner 트랙** — `spec-update-perf-backlog-01.md` §1·§2 draft 를 spec 본문에 반영(코드 revert 아님, spec 갱신).
5. **(선택 INFO)** dashboard 집계 `Promise.all` 병렬화(I1), `roundPercent2dp` 헬퍼(I3), deep-path 타입 import 루트화(I4).

## 라우터 결정

라우터 미사용 — 사유: routing=skipped. 전체 reviewer 실행.
