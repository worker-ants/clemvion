# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(`findUnguarded` 허용목록 선언 count 가 실측 discover() 결과와 교차검증되지 않음 — 오늘은 4개 항목 전부 일치해 활성 버그 아님). 나머지는 전부 INFO(3라운드 누적 지적사항 해소 확인, 설계 의도 확인). forced whitelist 7명(`requirement, testing, documentation, scope, security, side_effect, maintainability`) 전원 결과 확보 완료 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `ALLOWED` 3-tuple 의 "허용 지점 수"가 선언값일 뿐 오늘의 실측(`discover()`)과 교차검증되지 않는다. scratch 재현으로, 선언값을 부풀리면(오타·과다 선언) 그 파일 안에 새로 생긴 미가드 지점이 `findUnguarded` 를 조용히 통과함을 실증. 오늘 4개 ALLOWED 항목(2/2/2/1)은 실제 소스와 grep 대조 결과 정확히 일치해 활성 버그는 아니나, 이 PR 이 3라운드에 걸쳐 반복 닫아 온 "가드 자신의 결함 클래스"의 다음 겹으로 보인다. docstring 이 "이 수는 실측값이다"라고 주장하지만 코드는 상한 검사만 할 뿐 정합성 검사는 하지 않는다. | `codebase/backend/src/common/utils/update-returning-rows.spec.ts:167-182`(`findUnguarded`), docstring `:194-198` | `discover()` 결과를 `Map` 화해 ALLOWED 각 항목의 선언 count 가 실측 `rawCount` 와 정확히 일치하는지 검증하는 `it` 추가(예: `expect(discoveredMap.get(rel)).toBe(declaredCount)`), 최소한 docstring 에 "선언값이 실측보다 크면 그 차이만큼 미검증 상태가 남는다"는 한계 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement, testing, documentation | 3라운드에 걸쳐 지적된 모든 항목(중첩 제네릭 미탐지·전용 단위테스트 부재·파일단위 존재-only 판정·허용목록 파일단위 전면 면제·다중 unguarded 미검증·CTE 접두 blind spot·CHANGELOG 수치 오기·plan 완료 배너 낡은 서술)이 커밋 `94985c55a` 로 실제 코드/문서에 반영돼 해소됨을 각 reviewer 가 직접 코드 대조 + `3 suites / 46 tests` 실행(GREEN)으로 재확인 | `source-scan.ts`, `source-scan.spec.ts`, `update-returning-rows.spec.ts`, `CHANGELOG.md`, `plan/in-progress/update-returning-tuple-shape.md` | 조치 불요 — 기록용 |
| 2 | testing | `countRawUpdateReturning` 의 양성 6·음성 7 fixture 가 전부 한 줄짜리 SQL 리터럴이라 "멀티라인 SQL(UPDATE 와 RETURNING 이 다른 줄)에서도 탐지되는가" 축이 합성 입력으로 직접 고정돼 있지 않다(정규식 구조상 정상 동작할 것으로 보이고 실제 `kb-stats.helper.ts` 발견으로 간접 확인되지만, 오늘의 실제 소스 형태에 의존하는 간접 검증) | `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:67-165` | 급하지 않음. 여력 있으면 양성 `it.each` 에 멀티라인 백틱 케이스 1개 추가 |
| 3 | testing | `findUnguarded` 합성 테스트의 `guardCountOf` 스텁이 상수 함수뿐이라 `discover()` 가 실제 넘기는 클로저의 호출 인자를 스파이로 검증하지 않음 — 결함 아니라 순수 함수/통합 배선의 계층 분리 설계 | `update-returning-rows.spec.ts:306-379` | 조치 불요 |
| 4 | documentation, maintainability | `hasRawUpdateReturning` 이 여전히 자기 테스트 파일(`source-scan.spec.ts`) 외 소비자가 없음 — 2·3라운드에서 "두 번째 소비자 생기기 전까지 현행 유지"로 이미 명시 유예된 상태, 이번 라운드도 변화 없음(carry-forward) | `codebase/backend/src/common/__test-utils__/source-scan.ts:136` | 조치 불요 |
| 5 | documentation | `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` 미등재 — 기존 추적 중인 항목, developer 권한 밖 | `spec/conventions/node-cancellation.md` | planner 턴에서 처리(기존 추적) |
| 6 | requirement | raw UPDATE/DELETE…RETURNING → `updateReturningRows` 불변식이 `spec/conventions/` 에 정식 규약으로 아직 문서화돼 있지 않음(부재이지 위반 아님) — 이미 planner 위임으로 추적 중 | `spec/conventions/` 전수 grep 0건, `plan/in-progress/update-returning-tuple-shape.md:409` | 조치 불요 — planner 턴에서 처리(기존 추적) |
| 7 | maintainability | `findUnguarded` 의 설계 근거를 담은 JSDoc 블록이 함수 선언에 바로 붙어 있지 않고 그 앞의 별도 블록으로 떨어져 있어(빈 줄 하나 사이 연속 `/** */` 두 블록), IDE/TypeDoc 등 도구 기반 탐색에서 앞 블록(핵심 설계 결정: 왜 발견형인지, 왜 개수 판정인지, 왜 래퍼로 안 갔는지)이 누락될 수 있음 | `update-returning-rows.spec.ts:119-146`(연결 안 되는 블록) vs `:148-166`(실제 연결 블록), 함수 `:167` | 급하지 않음. 두 블록을 합치거나 앞 블록을 `//` 섹션 헤더로 전환 |
| 8 | side_effect | 신설 발견형 가드가 테스트 실행마다 `src/**` 전체(약 800여 파일)를 재귀적으로 읽음 — 읽기 전용·저장소 내부 한정이며 diff 가 스스로 명시한 설계 의도("입력 집합을 발견한다"). 다만 테스트 실행 시간·`discovered` 배열 크기가 소스 트리 전체 상태에 결합된다는 특성은 기록해 둠 | `update-returning-rows.spec.ts:225`(`listSources`), `:247`(`discover`) | 조치 불요 |
| 9 | security, side_effect | `kb-stats.helper.ts` 유일한 실질 변경은 `.query<>()` 제네릭 타입 인자(`{...}[]` → `[{...}[], number]`) — SQL·파라미터 바인딩·공개 시그니처·런타임 동작 불변, 반환값 미소비도 diff 전후 동일 | `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:36-38` | 조치 불요 |
| 10 | scope | 이번 diff 52개 파일은 실질 코드/문서 변경 7개(+576/-11) + 이 프로젝트가 상시 승인한 리뷰/일관성-검토 워크플로 산출물 44개(`review/code/**`, `review/consistency/**`)로 명확히 나뉘며 스코프 이탈 없음. 최신 커밋 `94985c55a` 도 직전 라운드 자신의 WARNING 4건 처리에 정확히 국한 | 전체 diff | 조치 불요 |
| 11 | security | 하드코딩 시크릿(API 키·비밀번호·토큰·인증서) 전무, 인증/인가/암호화/의존성 표면 변경 없음, 신설 스캐너·파일시스템 순회는 전부 1st-party 소스만 대상으로 인젝션·경로탐색·ReDoS 어느 축에도 해당 안 됨(정규식 구조 분석 + 이전 라운드 실측 벤치마크 일치) | 전체 diff | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | ALLOWED 3-tuple 선언값 vs 실측 교차검증 부재(WARNING) — 오늘은 활성 버그 아님. 나머지는 3라운드 지적사항 해소 확인 |
| testing | NONE | 3라운드 WARNING 7건 전부 해소(코드 대조), 46/46 테스트 GREEN. 남은 것은 INFO 2건(멀티라인 fixture 부재, 계층 분리 확인) |
| documentation | NONE | 3라운드 WARNING 4건(CHANGELOG 수치·plan 배너·다중보고 테스트·CTE blind spot)이 커밋 `94985c55a` 로 정확히 조치됨을 실측 확인 |
| scope | NONE | 실질 변경 7개 파일(+576/-11), 나머지는 워크플로 산출물. 스코프 이탈 없음 |
| security | NONE | 시크릿·인젝션·경로탐색·ReDoS·인증/인가·의존성 표면 어디에도 해당 없음 |
| side_effect | LOW | 신설 가드의 전체 소스 트리 재귀 스캔은 읽기 전용·의도된 설계. `kb-stats.helper.ts` 변경은 컴파일타임 타입 주석뿐 |
| maintainability | LOW | 3라운드 WARNING 전부 해소 유지 확인. 신규 INFO 1건(JSDoc 블록 분리, 도구 탐색 누락 가능) |

## 발견 없는 에이전트

없음 — 7개 reviewer 전원 최소 INFO 이상의 발견사항을 보고함(대부분 "이전 라운드 지적 해소 확인" 성격).

## 권장 조치사항

1. `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 의 `findUnguarded` / `describe('ALLOWED')` 에 `discover()` 실측 rawCount 와 ALLOWED 선언 count 의 정확 일치를 검증하는 테스트를 추가한다(WARNING #1). 최소한 docstring(`:194-198`)에 "선언값이 실측보다 크면 그 차이만큼 미검증 상태가 남는다"는 한계를 명시한다.
2. (선택, 급하지 않음) `source-scan.spec.ts` 양성 fixture 에 멀티라인 SQL 백틱 케이스 1개를 추가해 "SQL 리터럴이 여러 줄에 걸쳐도 탐지되는가" 축을 오늘의 실제 소스 형태와 무관하게 직접 고정한다(INFO #2).
3. (선택, 급하지 않음) `update-returning-rows.spec.ts:119-146` 의 연결 안 되는 JSDoc 블록을 `findUnguarded` 선언에 붙이거나 `//` 섹션 헤더로 전환해 도구 기반 탐색 누락을 방지한다(INFO #7).
4. `hasRawUpdateReturning` 미소비, `spec/conventions/` 불변식 미문서화, `spec/conventions/node-cancellation.md` `pending_plans` 미등재는 이미 유예/추적 중인 항목으로 재차 액션 불요 — planner 턴 또는 두 번째 소비자 등장 시점까지 현행 유지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement, testing, documentation, scope, security, side_effect, maintainability` (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (전원 강제 화이트리스트 대상이었고, 7명 전원 결과 확보 완료 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | 제외된 reviewer 없음 |