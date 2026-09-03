# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 실제 동작 결함도 발견되지 않았으나(전부 정적 분석/테스트 인프라 리팩터), 테스트 커버리지 갭 2건과 문서/재사용 관련 WARNING 2건이 있어 MEDIUM 으로 판정. router 강제(forced) 화이트리스트 7명 전원 결과 확보됨 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `sort()` 회귀를 "이 환경에서는 원리적으로 못 잡는다"는 docstring 의 단언이 실측으로 반증됨 — 픽스처에 `-` 등 `/` 보다 사전식으로 앞서는 문자를 포함한 형제 파일 하나만 추가해도 DFS 순서와 `Array.sort()` 순서가 갈려 이 환경에서도 RED 로 잡힌다(직접 재현 확인). 다음 사람이 이 주석을 믿으면 닫을 수 있는 커버리지 갭을 영구히 열어 둔다 | `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:225-241` (docstring), 구현은 `source-scan.ts:270`(`return out.sort();`) | `beforeEach` 픽스처에 `nested-sibling.ts` 류(사전식으로 `nested/` 와 인접) 형제 파일을 추가해 실제로 뮤턴트를 RED 로 잡거나, docstring 의 "원리적으로 못 잡는다" 문장을 정정 |
| 2 | testing | `stripLiterals` 가 "다음 가드의 재사용"을 명시적 존재 이유로 export 됐음에도 직접 단위 테스트가 0개 — 자매 함수 `stripComments` 는 6개 전용 테스트를 갖는데 비대칭. `findStaleSpecCasts` 를 통한 간접 커버리지만 있어, 백틱 중첩(`${...}` 안 백틱, docstring 이 스스로 적은 한계)·이스케이프 따옴표 등 고유 경계조건이 검증되지 않음 | `codebase/backend/src/common/__test-utils__/source-scan.ts:63`(export 이유 docstring), `:83`(`export function stripLiterals`) | `source-scan.spec.ts` 에 `stripLiterals` 전용 `describe` 추가 — 따옴표/백틱 보존, 이스케이프 따옴표 비-조기종료, docstring 이 적은 중첩 백틱 한계를 RED 방향으로 고정 |
| 3 | maintainability | 신규 fixture 헬퍼 `withFiles` 가 같은 파일의 기존 `withFixture` 와 거의 동일한 골격(`mkdtempSync`→write→try/finally rmSync)을 복제 — 다중 파일 지원 유무만 다름. 이번 diff 자체가 "walker 5사본 통합" 인데 같은 diff 안에서 유사 복제를 새로 만든 셈 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:188-204`(신규 `withFiles`) vs `:109-118`(기존 `withFixture`) | `withFixture` 를 `Record<string,string>` 을 받도록 일반화하고 `withFiles` 제거 |
| 4 | documentation | `stripLiterals` 와 그 JSDoc 을 `countCalls` 의 기존 JSDoc 과 `export function countCalls` 선언 사이에 끼워 넣어, `countCalls` 를 설명하던 주석이 `stripLiterals` 바로 위에 붙게 되고 `countCalls` 자신은 문서가 없는 것처럼 보임(orphan) | `codebase/backend/src/common/__test-utils__/source-scan.ts:57-93` | `countCalls` 원래 JSDoc(57~62줄)을 `export function countCalls` 선언(90줄) 바로 위로 이동 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / maintainability / testing (3개 리뷰어 공통 지적) | `WIDENED_DECL` 정규식이 데코레이터를 **최대 1개**까지만 추가 허용(`(?:\s*@\w+\(...\)\s*\n)?` — `*`/`+` 아닌 `?`) — 필드에 데코레이터 2개 이상 스택되면 매치 실패로 `widenedEntityFields` 가 그 필드를 조용히 누락, `findStaleSpecCasts` 가 그 필드를 겨눈 낡은 캐스트를 영구히 못 잡음(위음성 방향). 현재 저장소 전수 확인상 그런 조합 없음(잠재적, 라이브 회귀 아님). 상수명도 "widened" 만 가리키는 것으로 오독 가능(필터링은 호출부에서), 이 파일의 다른 정규식과 달리 한계가 docstring 에 미기재 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:128-135` | 급하지 않음. 데코레이터 그룹을 `(?:...)*` 로 넓히거나, 최소한 이 파일의 관례대로 "추가 데코레이터 1개까지만 지원" 한계를 docstring 에 한 줄 명시 |
| 2 | security / scope / side_effect (3개 리뷰어 공통 지적) | 통합된 `collectTsFiles` 가 `.d.ts` 를 항상 제외 — `masked-reject-callers-guard.ts`(`.d.ts` 도 포함하던 구 `listSourceFiles`)와 `engine-error-code-anchor-guard.ts`(필터 없던 구 `walkTsFiles`)의 스캔 범위가 조용히 좁아짐. `find` 로 `src` 하위 `.d.ts` 0개 확인돼 오늘은 무해, plan 문서에도 실측 근거 명시됨 | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:48-52`, `common/__test-utils__/source-scan.ts:261-263` | 이미 문서화된 의도적 결정. `src/` 에 `.d.ts` 가 생기는 시나리오가 생기면 이 가정 재검토 |
| 3 | scope / side_effect (2개 리뷰어 공통 지적) | `stripComments` 가 module-private → `export` 로 가시성 확대 — `findStaleSpecCasts` 재사용 목적, diff 자체에 근거 문단 있음, 순수 additive(기존 호출자 영향 없음) | `codebase/backend/src/common/__test-utils__/source-scan.ts:53` | 조치 불필요 |
| 4 | security | `stripLiterals`/`WIDENED_DECL` 정규식의 이론적 backtracking 특성 검토 — prefix-disjoint 구조라 catastrophic backtracking 조건 미성립, 입력도 신뢰된 저장소 소스라 실질 DoS 벡터 아님 | `common/__test-utils__/source-scan.ts:83`, `repo-guards/__tests__/nullable-type-lie-cast-guard.ts:135` | 조치 불필요. 스캔 대상이 크게 늘면 벤치마크 재확인 권장 |
| 5 | security | `stripComments`→`stripLiterals` 순서로 인한 기존 blind spot(문자열 내 `//` 를 주석으로 오인해 절단)이 신설 `findStaleSpecCasts` 에도 상속 — 저탐지 방향, 공격 표면 아님 | `repo-guards/__tests__/nullable-type-lie-cast-guard.ts:182` | 참고로만 기록, 기존 한계와 동일 계열 |
| 6 | side_effect | 5개 가드가 공유 함수 `collectTsFiles` 하나에 위임하며 blast radius 확대 — 향후 그 함수 하나의 결함이 5곳에 동시 파급 가능. 리팩터 전후 파일 집합 완전 동일(507/818/1261/818/818) 실측 검증됨, 전용 유닛 테스트도 있어 회귀 방어는 갖춤 | `common/__test-utils__/source-scan.ts:249` 및 5개 소비처 | 조치 불필요 — 이후 `collectTsFiles` 를 고치는 PR 은 5개 소비처 전부 리뷰 필요 |
| 7 | side_effect | "저장소 전수" 스캔이 `beforeAll`/`it` 이 아니라 `describe` 콜백 본문에서 즉시 실행 — 읽기 전용, 기존 관례(`collectScanTargets()` 호출)와 일치 | `repo-guards/__tests__/nullable-type-lie-cast.spec.ts:298-304` | 조치 불필요 |
| 8 | testing | 5-way 동등성(507/818/1261/818/818) 대조가 plan 문서 서술로만 남고 저장소에 재현 가능한 테스트로 고정되지 않음 — 각 소비처 spec 의 간접 검증은 있으나 "파일 집합 자체의 동등성"을 직접 겨누는 테스트는 아님 | `plan/in-progress/entity-nullable-column-type-mismatch.md:261-262` | 낮은 우선순위. 후속 PR 에서 `collectTsFiles` 를 건드릴 때 5개 소비처 spec 을 함께 확인 |
| 9 | maintainability | DRY 통합 후에도 4개의 동일한 한 줄 래퍼가 서로 다른 이름(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)으로 잔존 — 다음 독자가 서로 다른 로직으로 오인 가능 | `audit-action-binding-guard.ts:47-49`, `masked-reject-callers-guard.ts:48-52`, `nullable-type-lie-cast-guard.ts:38-40`, `redis-fail-open-catalog-guard.ts:93-95` | 지금 당장 불필요. 다음에 이 파일들을 만질 때 이름 통일 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정적 분석 도구라 공격 표면 없음. INFO 2건(backtracking 이론 검토, `.d.ts` 스캔 범위 축소) |
| requirement | LOW | 105/105 테스트·tsc·eslint 클린 실측 재검증. `WIDENED_DECL` 재현율 한계(잠재적) 1건 |
| scope | NONE | plan 의 두 후속 항목에 정확히 결속. `.d.ts` 필터·`stripComments` export 확대 2건 INFO |
| side_effect | LOW | 상태 변경/전역/네트워크 부작용 없음. blast radius 확대·`.d.ts` 필터 변경 등 INFO 4건 |
| maintainability | LOW | 전반적으로 우수. `withFiles`/`withFixture` 중복 WARNING 1건 + INFO 3건 |
| testing | MEDIUM | `stripLiterals` 무테스트, `sort()` "못 잡는다" 주장 반증 — WARNING 2건(가장 높은 개별 위험도) |
| documentation | LOW | 문서화 규율 높음. `countCalls` JSDoc orphan WARNING 1건 |

## 발견 없는 에이전트

없음 (7개 전원 최소 INFO 이상 발견).

## 권장 조치사항

1. `source-scan.spec.ts` 의 `beforeEach` 픽스처에 사전식으로 `/` 보다 앞서는 형제 파일(예: `nested-sibling.ts`)을 추가해 `sort()` 뮤턴트를 실제로 RED 로 잡거나, docstring 의 "원리적으로 못 잡는다" 단언을 정정한다 (WARNING #1).
2. `stripLiterals` 전용 단위 테스트를 `source-scan.spec.ts` 에 추가해 자매 함수 `stripComments` 와 커버리지 수준을 맞춘다 — 특히 docstring 이 스스로 적은 중첩 백틱 한계를 RED 로 고정 (WARNING #2).
3. `nullable-type-lie-cast.spec.ts` 의 `withFiles` 를 제거하고 기존 `withFixture` 를 다중 파일 지원으로 일반화한다 (WARNING #3).
4. `source-scan.ts` 에서 `countCalls` 의 원래 JSDoc 을 `stripLiterals` 삽입 지점 뒤, `export function countCalls` 선언 바로 위로 옮긴다 (WARNING #4).
5. (낮은 우선순위) `WIDENED_DECL` 정규식의 데코레이터 개수 제한을 docstring 에 명시하거나 `(?:...)*` 로 넓힌다 — 3개 리뷰어가 공통 지적한 유일한 잠재적 위음성 축.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 전원 forced)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 전원 결과 확보됨(미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관 (정적 분석 도구 리팩터, 런타임 성능 영향 없음) |
  | architecture | router 판단상 이번 diff 와 무관 |
  | dependency | router 판단상 이번 diff 와 무관 (신규 의존성 없음) |
  | database | router 판단상 이번 diff 와 무관 (DB 접촉 없음) |
  | concurrency | router 판단상 이번 diff 와 무관 |
  | api_contract | router 판단상 이번 diff 와 무관 (API 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 무관 (사용자 가이드 대상 아님) |