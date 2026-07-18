# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건은 모두 이번 PR 자체가 강화하려는 "AST 가드 self-test"의 커버리지 갭(테스트 인프라 문제)이며, 등록 사이트가 전부 `.ts`인 현재 시점에는 프로덕션 가드 판정 결과에 실질 영향이 없다(전원 mutation/재현 실측으로 확인). forced(router_safety) 7개 reviewer 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing/Documentation | `.tsx` 오파싱 방지(정방향)만 self-test 로 구조적 검증됨. `scriptKindForFile` 자신의 JSDoc 이 명시하는 역방향 리스크(`.ts` 파일 안 `<Config>{...}` 형 각괄호 타입 단언이 TSX 로 잘못 파싱되면 리터럴이 통째로 유실됨)는 어떤 테스트로도 고정돼 있지 않다. 두 reviewer 모두 직접 재현해 사실임을 확인(`ts.createSourceFile("probe.tsx", 'const cfg = <Config>{ foo: 1, bar: "baz" };', ..., ts.ScriptKind.TSX)` → 문자열 리터럴 0개 수집). | `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` L44-46(`scriptKindForFile` JSDoc), L173-196(정방향 케이스만 존재), L338-345(`treeContainsJsx`) | `.ts` 사이트에 각괄호 캐스트 리터럴을 넣고 `collectCodeStringLiterals(tsSite, "fixture.ts").has(...)` 가 `true` 임을 단언하는 역방향 self-test 추가 (testing 리뷰어가 구체 fixture 코드 제시). |
| 2 | Requirement | 이번 diff 의 실제 fix 라인(`collectCodeStringLiterals` 내부 `scriptKindForFile(fileName)` 호출, 舊 `ts.ScriptKind.TS` 하드코딩)을 되돌리는 mutation 을 주입해도 `.tsx` self-test 를 포함한 7/7 테스트가 모두 green 을 유지함을 실측 확인. 원인: self-test 의 `treeContainsJsx(tsxSite, scriptKindForFile("result-view.tsx"))` 호출이 `scriptKindForFile` 을 **직접** 호출할 뿐 `collectCodeStringLiterals` 를 거치지 않아, `collectCodeStringLiterals` 가 실제로 그 함수를 호출하는지는 검증되지 않는다(`.has("ai_form_render")` 쪽 단언도 에러 복구로 항상 true라 무의미). 이 plan 자체가 "가드의 false-negative 제거"가 주제인데, 그 fix 를 고정하는 self-test 안에 동일 계열 false-negative 가 남아 있음. | `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` `collectCodeStringLiterals` L96-103(특히 L102), `treeContainsJsx` L123 이하, self-test L247-263 | `collectCodeStringLiterals` 가 파싱한 `sourceFile` 을 (테스트 전용으로) 노출해 `treeContainsJsx` 가 그것을 재사용하도록 배선 — self-test 가 프로덕션 호출부를 실제로 관통하게 만든다. |

## SPEC-DRIFT

| # | 발견사항 | 위치 | 제안 |
|---|----------|------|------|
| 1 | `[SPEC-DRIFT]` `spec/conventions/interaction-type-registry.md` §1.2 rule 3("등록된 grep 대상 파일"), §2.1(`system_error`/`rag` 행, "grep 검증 대상") 등 4곳(L56, 77, 78, 143)이 여전히 가드를 "grep" 기반으로 서술한다. 그러나 이번 diff 는 코드 측(`interaction-type-registry.ts` JSDoc) 3곳 전부를 실제 구현(TS AST 파싱)에 맞춰 "AST 가드"로 정확히 정정했다 — 즉 코드가 옳고 spec 서술이 낡은 전형적 SPEC-DRIFT. | `spec/conventions/interaction-type-registry.md` L56/77/78/143; 대응 코드는 `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` L14/63-64(이미 정정됨) | 코드를 되돌릴 사안 아님. `plan/in-progress/interaction-type-guard-comment-false-negative.md` 후속 섹션에 이미 `[project-planner]` 담당으로 등록돼 있고 impl-prep/`/ai-review`/impl-done 세 게이트가 독립적으로 동일 항목을 지적해 비차단 합의된 기존 추적 항목 — spec 표현만 후속 정정하면 됨. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `collectCodeStringLiterals` 와 `treeContainsJsx` 의 AST 순회(`ts.createSourceFile` → 재귀 `visit` 클로저 → `ts.forEachChild`) 보일러플레이트가 2회 반복. | `interaction-type-exhaustiveness.test.ts` L96-113, L123-144 | 즉각 추출 불요(2회뿐). 3번째 유사 순회 추가 시 공용 `walkAst` 헬퍼 고려. |
| 2 | Maintainability/Documentation | `treeContainsJsx` 가 `kind` 인자와 무관하게 파일명을 항상 `"probe.tsx"` 로 고정하는 이유가 문서화돼 있지 않음(동작엔 문제 없음 — `scriptKind` 명시 시 파일명 확장자는 파싱에 영향 없음). | L338-345 | JSDoc 에 "fileName 은 라벨일 뿐, kind 가 파싱 종류를 전적으로 결정" 한 줄 추가. |
| 3 | Maintainability | 가드 테스트 파일이 지속 성장 중(337줄, self-test 2→4건, 헬퍼 2→4개), 서술형 주석 비중 높음. | `interaction-type-exhaustiveness.test.ts` 전체 | 현 규모에선 정당화됨(방어적 문서화). 향후 헬퍼가 더 늘면 별도 유틸 모듈(`__tests__/ast-guard-helpers.ts`) 분리 고려. |
| 4 | Testing | `treeContainsJsx` 가 검사하는 3가지 JSX 노드 형태(`JsxElement`/`JsxSelfClosingElement`/`JsxFragment`) 중 실제 fixture 로 exercise 되는 것은 `JsxElement` 하나뿐. | L82-103(`treeContainsJsx` 정의), L173-196(유일 호출부) | 우선순위 낮음. 필요 시 `describe("treeContainsJsx")` 로 세 분기 개별 확인. |
| 5 | Testing | `scriptKindForFile` 은 `.ts`/`.tsx` 두 갈래만 분기, `.mts`/`.cts`/`.mtsx` 등 미고려(fallback 이 "tsx 아니면 TS"). | L44-46 | 현재 스코프에서 조치 불요. 등록 사이트 확장자 확대 시 함께 확장. |
| 6 | Scope | 신규 헬퍼 `treeContainsJsx` 가 plan 체크리스트 문구에 이름이 명시적으로 나열돼 있지 않음. | `interaction-type-exhaustiveness.test.ts` 신규 함수 | 범위 이탈 아님(`.tsx` ScriptKind 분기 검증이라는 동일 후속 항목의 필수 구현 디테일). 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 테스트/문서 전용 diff, 사용자 입력·시크릿·인증·의존성 무관 — 실질 발견 없음 |
| requirement | LOW | WARNING #2(.tsx self-test가 실제 fix 라인 미검증, mutation 실측), SPEC-DRIFT #1(추적 중, 비차단) |
| scope | NONE | plan 후속 체크리스트 2항목에 정확히 대응, 범위 이탈 없음(INFO #6 비이슈) |
| side_effect | NONE | 신규 헬퍼 전부 순수 함수, 전역/파일시스템/네트워크 부작용 없음 |
| maintainability | LOW | INFO #1·#2·#3(보일러플레이트 소폭 중복, 문서화 갭, 파일 성장) — 모두 경미 |
| testing | LOW | WARNING #1(역방향 커버리지 갭), INFO #4·#5(부분 커버리지, 확장자 미고려). Mock 미사용·mutation 실측 문서화 등 긍정 관찰 다수 |
| documentation | LOW | WARNING #1과 동일 이슈 재확인(INFO로 별도 제기), INFO #2(파일명 문서화 갭), SPEC-DRIFT #1 확인 |

## 발견 없는 에이전트

- security — 실질 위험 없음(전 항목 "해당 없음/위험 성립 안 함" 확인)
- side_effect — 실질 위험 없음(순수 함수, export 표면 무변경)

## 권장 조치사항

1. (WARNING #1) `.ts` 사이트의 각괄호 캐스트 리터럴이 TSX 오파싱으로 유실되지 않음을 검증하는 역방향 self-test 추가 — `scriptKindForFile` JSDoc 이 스스로 언급한 리스크를 실행 가능한 단언으로 고정.
2. (WARNING #2) `treeContainsJsx` 가 `collectCodeStringLiterals` 의 실제 내부 파싱 경로(`sourceFile`)를 재사용하도록 배선해, self-test 가 이번 diff 의 진짜 fix 라인(`scriptKindForFile(fileName)` 호출부)을 관통하게 만든다 — 현재는 그 라인을 되돌려도 테스트가 안 잡음.
3. (SPEC-DRIFT #1) `spec/conventions/interaction-type-registry.md` 의 "grep" 잔여 표현 4곳을 "AST 가드" 로 정정 — project-planner 담당, 기존 plan 후속 항목에 이미 등록되어 있으므로 별도 신규 작업 불요(진행 시 반영만).
4. (INFO 항목들) 현재 조치 불요, 향후 확장 시점(헬퍼 추가·등록 사이트 확장자 다양화)에 함께 고려.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 전원 forced)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 전원 — router 자체 선별은 없었고 router_safety 가 전원 강제 포함. forced 전원 결과 확보됨, 미이행 없음)
  - **제외**: 7명 (아래 표)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 테스트/문서 전용 diff 로 성능 영향 표면 없음 |
  | architecture | 라우터 판단 — 아키텍처 변경 없음(주석·self-test 추가뿐) |
  | dependency | 라우터 판단 — 의존성(package.json 등) 변경 없음 |
  | database | 라우터 판단 — DB/스키마 관련 없음 |
  | concurrency | 라우터 판단 — 동시성 로직 무관 |
  | api_contract | 라우터 판단 — API 계약 변경 없음 |
  | user_guide_sync | 라우터 판단 — 사용자 가시 기능/문서 변경 없음(내부 테스트 인프라) |