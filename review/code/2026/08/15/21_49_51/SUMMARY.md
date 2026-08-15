# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. `testing` 리뷰어가 회귀 가드(`websocket-events.types.spec.ts`)의 간선 판별
로직에 새로운 blind spot(WARNING 1건, "default import + 전부 type 태그된 named import" 조합 오판정)을
찾아냈으나, 대상 모듈 둘 다 `export default` 가 없어 현재는 `tsc` 가 우회 경로를 컴파일 단계에서
차단한다. 나머지 7명 reviewer(security/architecture/requirement/scope/side_effect/maintainability/
documentation)는 전원 NONE. forced 화이트리스트(documentation, maintainability, requirement, scope,
security, side_effect, testing) 7명 전원 정상 실행·전문 확보 — 강제 이행 미달 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing/회귀가드 | 회귀 가드의 `leavesValueEdge`/`moduleRefs`가 `ImportDeclaration.importClause.name`(default import 바인딩)을 전혀 보지 않아, `import Def, { type Bar } from '...'` 형태를 값 간선 누락(FN)으로 오판정한다. 이 PR 이 4라운드 연속(`export…from`→별칭FN→`require()`→인라인`type`오탐) 찾아낸 것과 동일한 "distinguishing input 누락" 패턴의 5번째 사례. 오늘은 `websocket.service.ts`/`websocket-events.types.ts` 둘 다 `export default` 가 없어(grep 확인) `tsc` 컴파일 자체가 우회를 막지만, 대상 모듈이 미래에 default export 를 추가하면 이 blind spot 이 조용히 살아난다 | `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` `leavesValueEdge`(~134-142행), `moduleRefs` import 분기(~156-173행) | 뮤테이션 매트릭스에 M21(`default import + 전부 type-tagged named import`) 추가하고 `leavesValueEdge` 에 `hasDefaultBinding` 인자를 더해 `clause?.name` 유무를 반영. 선택: 대상 모듈에 "export default 없음" 전제를 캐너리 단언으로 명시해 향후 회귀 시 즉시 감지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/구조 | `moduleRefs` 내부에서 import/export 두 분기가 "네임드 바인딩 → 값 이름 추출 → `leavesValueEdge` 호출" 로직을 각각 독립 구현(사실상 중복) — 판정 로직을 고칠 때마다 두 곳을 손으로 동기화해야 하는 구조적 위험(이 세션이 반복 관측한 "자매 지점 중 하나만 고친다" 패턴과 동일 결). 현재까지는 fix 커밋(`b5ef57c3a`)이 양쪽을 다 고쳤고 19개 뮤턴트 RED 로 뒷받침됨 | `websocket-events.types.spec.ts:161-173`(import 분기), `:179-190`(export 분기) | `namedBindingValueNames(named)` 공유 헬퍼로 공통부 추출 — 판정 로직 수정 지점을 `leavesValueEdge` 하나로 좁힘 (선택, Critical/Warning 아님) |
| 2 | 아키텍처/구조 | re-export facade 가 여전히 3중 수동 동기화 지점(`websocket.service.ts` export 블록 / `websocket-events.types.ts` 선언 / 스펙 `EXPECTED_EXPORTS`) — 4개 라운드 연속 관찰·수용, `tsc` 가 drift 를 fail-closed 로 잡는다는 근거로 조치 불필요 유지 | `websocket.service.ts:31-46`, `websocket-events.types.spec.ts:49-62` | 조치 불필요(합의 유지) |
| 3 | 아키텍처/테스트배치 | 회귀 가드가 lint/CI 아키텍처 계층이 아니라 unit-test 계층에서 `src/` 전체를 스캔하는 fitness-function 배치 — 이전 라운드가 이미 검토·합의, 이번 델타(`leavesValueEdge` 세분화)는 배치를 바꾸지 않음 | `websocket-events.types.spec.ts`(`collectOffenders`, `moduleRefs`) | 조치 불필요 — 후속 PR 에서 `no-restricted-imports` 승격은 선택 사항으로 이미 인계됨 |
| 4 | Testing/커버리지 | "값·타입 선언이 실제로 존재" 테스트가 `export` 여부(`ExportKeyword` modifier)는 확인하지 않고 선언 존재만 확인 — 실질 위험은 낮음(비-export 시 소비자 `tsc` 가 즉시 깨짐) | `websocket-events.types.spec.ts` 두 번째 `it`(`declared.add(st.name.text)`) | `ts.getModifiers` 로 `ExportKeyword` 확인 추가 (우선순위 낮음, 선택) |
| 5 | Testing/성능 | `websocket-events.types.spec.ts` 가 3번째·5번째 `it` 에서 각각 `SRC_ROOT` 전체를 재파싱(캐시 없음) — 현재 스위트가 2.5초 내 통과해 실질 영향 없음 | `websocket-events.types.spec.ts`(`collectOffenders`/`allTsFiles`) | 조치 불필요 |
| 6 | 요구사항/문서정합 | spec 6곳(`KbEventType`/`ExecutionChannelEvent` 정본 위치 서술)이 물리적으로 stale — 선언이 `websocket-events.types.ts` 로 이동했으나 re-export 로 동작에는 영향 없음. `spec_impact: none` 과 무모순. developer 의 `spec/` 쓰기 권한 밖이라 plan 에 planner-턴 후속 항목으로 이미 등재(5라운드 전부터 추적 중, 새 발견 아님) | `spec/5-system/10-graph-rag.md:552`, `spec/5-system/8-embedding-pipeline.md:276`, `spec/5-system/6-websocket-protocol.md:740,1034`, `spec/data-flow/6-knowledge-base.md:288`, `spec/data-flow/0-overview.md:110` | planner 턴에서 "정의는 `websocket-events.types.ts`, 하위호환 re-export 는 `websocket.service.ts`" 로 6곳 정정 |
| 7 | 범위 | 이번 라운드 신규 델타(`b5ef57c3a`)는 직전 라운드 자신의 지적(requirement W1, 가드 오탐) 하나에만 대응 — 프로덕션 코드 무변경, 가드 스펙+plan 문서 2파일 국한 | `websocket-events.types.spec.ts`, `plan/in-progress/ws-event-types-extract.md` | 조치 불필요 |
| 8 | 부작용 | 유일한 실행-순서 의존 변경(`TERMINAL_SHAPE` 호출-시점→모듈-스코프 상수화)의 안전성은 새 모듈이 import 0줄 의존성-프리라는 사실에 근거하며, 값/shape 자체는 변경 없음 | `execution-event-emitter.service.ts`(51-84행 선언부, 143행 사용부) | 조치 불필요 |
| 9 | 부작용 | `websocket.service.ts` 공개 export 표면(re-export facade, 값4+타입8)이 원본과 1:1 완전 일치 — 기존 호출자 영향 없음 | `websocket.service.ts` re-export 블록 | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 리팩터, credential 마스킹·depth 상한 등 기존 보안 통제 바이트 단위 보존 확인. 신규 결함 없음 |
| architecture | NONE | 프로덕션 아키텍처 표면 무변경. re-export facade 3중 동기화(INFO), 가드의 test-layer 배치(INFO) — 둘 다 다회 합의 |
| requirement | NONE | plan 요구사항 정확히 충족(`tsc` 0 에러, 가드 5/5 PASS, export 표면 1:1 일치). spec 6곳 정본위치 stale(INFO, planner 턴 이관됨) |
| scope | NONE | 누적 diff 가 plan 선언 범위와 정확히 일치, 이번 델타는 가드 스펙 1파일+plan 문서로 국한 |
| side_effect | NONE | 유일한 실행순서 의존 변경(TERMINAL_SHAPE) 안전 확인, 전역상태/네트워크/FS쓰기 없음 |
| maintainability | NONE | `moduleRefs` import/export 분기 로직 중복(INFO, 동기화 위험이나 현재는 양쪽 다 반영됨) |
| testing | LOW | 가드의 `leavesValueEdge` 가 default import+전부 type 태그 named import 조합을 FN 오판정(WARNING). 오늘은 `tsc` 가 우회 차단 |
| documentation | NONE | 6라운드 누적 지적(JSDoc 고아화·중복 블록·stale 주석·import type 누락·plan 수치 오기) 전부 최종 커밋까지 반영 확인. 신규 결함 없음 |

## 발견 없는 에이전트

security, documentation — 두 에이전트 모두 "발견사항 없음"을 명시.

## 권장 조치사항

1. (WARNING) `websocket-events.types.spec.ts` 의 `leavesValueEdge`/`moduleRefs` 에 default import
   바인딩(`clause?.name`) 인식을 추가 — M21 뮤테이션 케이스(`default import + 전부 type-tagged named
   import`) 추가 및 `hasDefaultBinding` 인자 반영. 선택: 대상 모듈에 "export default 없음" 전제를
   캐너리 단언으로 명시.
2. (INFO, 선택) `moduleRefs` 의 import/export 분기 중복을 `namedBindingValueNames` 공유 헬퍼로 추출해
   향후 판정 로직 수정 시 동기화 누락 위험을 구조적으로 차단.
3. (INFO, planner 턴) spec 6곳(`KbEventType`/`ExecutionChannelEvent` 정본 위치 서술)을
   "정의는 `websocket-events.types.ts`, 하위호환 re-export 는 `websocket.service.ts`" 로 정정 —
   이미 plan 에 후속 항목으로 등재되어 있어 이번 PR 을 막을 사유는 아니다.
4. (INFO, 선택) "선언 존재" 테스트에 `ExportKeyword` modifier 확인을 추가해 완전성 소폭 개선.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 정상 실행·전문 확보 확인, 강제 이행 미달 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(순수 import 재배선 + 모듈 스코프 상수화)와 무관 |
  | dependency | 신규/변경 외부 의존성 없음(package.json/lockfile 무변경) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음(TERMINAL_SHAPE 는 값 파생 시점만 변경, 락/트랜잭션 무관) |
  | api_contract | 신규/변경 엔드포인트·API 계약 없음 |
  | user_guide_sync | 사용자 대상 문서·UI 텍스트 변경 없음 |

---