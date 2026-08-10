# Code Review 통합 보고서

## 전체 위험도
**LOW** — Gate C(spec_impact) fail-open 버그를 닫은 리팩터 PR. 새로 도입된 CRITICAL 은 없으나, 3개 reviewer(testing/requirement/side_effect)가 동일 근본원인(같은 클래스)의 잔여 결함 하나를 각자 독립적으로 발견 — `makeSpecExists` 의 `spec/` 접두사 가드가 `..` 경로 순회로 재우회 가능. forced whitelist(testing, requirement, scope, side_effect, maintainability) 5명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / Requirement / Testing (중복 통합) | `makeSpecExists` 의 `spec/` 접두사 검사(`p.startsWith("spec/")`)가 문자열 검사만 수행하고 `path.join(root, p)` 이후 경로 정규화를 재검증하지 않아, `spec_impact: ["spec/../CLAUDE.md"]` 같은 `..` 경로 순회가 그대로 통과한다. 이번 커밋이 막으려던 "spec 밖 파일이 게이트 통과" 결함과 **동일 클래스**의 구멍이 형태만 바뀌어 재발. 실측(node): `"spec/../CLAUDE.md".startsWith("spec/")===true`, `path.join(root,"spec/../CLAUDE.md")` 이 저장소 루트 파일로 정규화되어 `isFile()===true`. 더 깊은 `spec/../../../etc/hostname` 형태로는 저장소 루트 밖 파일까지 대상이 될 수 있음(불리언 pass/fail 만 영향, 내용 유출 없음). 위협 모델상(신뢰된 내부 plan frontmatter) 실질 위험은 낮으나, 이 게이트 자신이 반복 경계해온 실패 형태와 정확히 같은 모양이라 기존 fixture 매트릭스에서 빠져 있는 점이 결함. | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:117` (`makeSpecExists` 함수, `if (!p.startsWith("spec/")) return false;`), 소비: `:139` | `path.resolve`/`path.relative` 로 정규화한 뒤 `spec/` 하위인지 재검증. 예: `const resolved = path.resolve(root, p); if (!resolved.startsWith(path.join(root, "spec") + path.sep)) return false;`. fixture 에 `"spec/../CLAUDE.md"` 케이스 추가(회귀 고정). |
| 2 | Maintainability | `rawScalar` 가 `key` 인자를 이스케이프 없이 그대로 `RegExp` 리터럴에 삽입(`` new RegExp(`^${key}:[ \t]*(.*)$`, "m") ``). 현재 호출부는 `rawScalar(block, "started")` 한 곳뿐이라 즉시 위험은 없으나, `export` 된 범용 유틸이라 향후 `.`/`*` 등 메타문자가 포함된 키로 호출되면 매치가 조용히 틀어질 수 있다. | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:214-222` (함수 `rawScalar`, 정규식은 `:219`) | `key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` 로 이스케이프하거나 JSDoc 에 "key 는 영숫자/하이픈만 허용" 명시. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `rawScalar` 의 "top-level 만 매치" 규약 중 "들여쓴 줄만 있고 top-level 줄이 아예 없을 때 `null` 반환" 경로를 직접 겨누는 fixture 가 없음(정규식 형태상 갈릴 여지 적고 하위 로직에서 간접 커버됨). | `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:259` | 선택 사항. `rawScalar("\nnote: |\n  started: 본문\n", "started")` → `toBeNull()` 단언 한 줄 추가. |
| 2 | Scope | `plan-scan.ts` 추출이 Gate C(spec_impact) 협의 범위를 넘어 `checkPlanFrontmatter`/`findFrontmatterViolations`/`TERMINAL_PLAN_STATUSES` 등 완료 plan status 검사까지 포함하나, 워크트리명(`plan-lifecycle-gates`, 복수 gates)·짝을 이루는 `plan-frontmatter.test.ts` 변경분·후속 plan 문서(`docs-guard-walker-dedup.md`)가 스코프 경계를 실측·문서화한 흔적이 뚜렷해 의도된 동일 PR 작업으로 판단됨. | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:130-322` | 조치 불필요. 다음 라운드에 `plan-frontmatter.test.ts` 를 함께 라우팅하면 더 정확한 판정 가능. |
| 3 | Scope | 코드 주석(`WORKTREE_PLACEHOLDER` JSDoc)이 PR 밖 파일 `.claude/docs/plan-lifecycle.md` 의 낡은 rationale 을 함께 정정했다고 자체 명시. 은폐된 범위 확장은 아님. | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:200-203` | 조치 불필요. `plan-lifecycle.md` diff 자체는 별도 라운드에서 확인 가능. |
| 4 | Scope | 세 파일 모두 실질 로직 변경마다 뮤테이션 실측 근거를 단 JSDoc/인라인 주석이 길지만, 무관한 장식이 아니라 구체적 결함과 발견 방법을 설명하는 실질 rationale. | `spec-plan-completion.test.ts:73-95`, `plan-scan.ts:104-120` | 조치 불필요. |
| 5 | Side Effect | `rawScalar` 정규식 축소(`^[ \t]*key:` → `^key:`)가 리뷰 payload 밖 소비처(`plan-frontmatter.test.ts` → `checkPlanFrontmatter` → `isIsoDate` → `rawScalar`)에도 전파됨. 매치를 줄이는 방향의 안전한 변경이며 커밋 메시지가 전체 스위트(19파일/2873 tests) 통과를 보고. | `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:219` | 조치 불필요(정보성). |
| 6 | Side Effect | `makeSpecExists` 강화가 `plan/complete/**` 기존 233건 `spec_impact` 선언에 소급 적용되는 공유 검증 로직 변경(넓은 blast radius). 커밋 메시지가 실측으로 회귀 없음을 보고. | `spec-plan-completion.test.ts:112-127`, 소비 `:139` | 조치 불필요(정보성). |
| 7 | Maintainability | `plan-scan.test.ts` 안에 frontmatter 문자열 생성 헬퍼가 두 벌(`fm`, `frontmatter`) 존재 — 동일 목적, `fm(status)` 는 `frontmatter({...})` 로 대체 가능해 보임. | `plan-scan.test.ts:31-32`, `:217-218` | 선택 사항. 인접한 두 describe 블록을 하나로 합치는 것 고려. |
| 8 | Maintainability | `toBeGreaterThan(10)` 의 `10` 이 근거 주석 없이 하드코딩됨. 저장소 `plan/complete/**` 개수가 줄면 무관한 이유로 테스트가 깨질 수 있음. | `spec-plan-completion.test.ts:165` | `toBeGreaterThan(0)` 으로 완화하거나 임계값 선택 이유를 주석으로 명시. |
| 9 | Maintainability | `fs.mkdtempSync`+`afterAll(rmSync)` 보일러플레이트가 파일 내 3개 describe 블록에 반복. | `plan-scan.test.ts:38,73` / `:201-207` / `:363,373` | 선택 사항, 우선순위 낮음. 공통 헬퍼로 추출 가능. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | LOW | 두 fix(`makeSpecExists` spec 경로 검증, `rawScalar` top-level 매치) 모두 뮤테이션 테스트로 실제 검증됨(RED 확인 후 복원). `..` 경로 순회 잔존 WARNING 발견. |
| requirement | LOW | 핵심 요구사항(Gate C 컷오프, 4어휘 status, ISO 날짜, 필수 3필드 등) spec 문서와 line-level 일치. `..` traversal WARNING + `.claude/docs/plan-lifecycle.md` §5 서술이 코드보다 낡음 [SPEC-DRIFT]. |
| scope | NONE | 3파일 모두 Gate C fail-open 수정 + 중복 walker 통합에 집중. 목적 불명 리팩터·설정 변경 없음. 4번째 파일(`plan-frontmatter.test.ts`) 미포함은 후속 plan 문서로 의도 확인. |
| side_effect | LOW | 함수 시그니처/공개 인터페이스/네트워크 변경 없음. `..` traversal WARNING(동일 근본원인) + 공유 유틸 변경의 blast radius 기록(정보성). |
| maintainability | LOW | 핵심 로직 순수 함수 분리, DRY 통합 양호. 정규식 미이스케이프 WARNING + 경미한 테스트 중복/매직넘버 INFO 3건. |

## 발견 없는 에이전트

없음 — 5개 reviewer 모두 최소 1건 이상의 발견사항을 보고함(scope 는 WARNING/Critical 없이 INFO만).

## 권장 조치사항

1. **[WARNING #1, 최우선]** `makeSpecExists` 의 `spec/` 접두사 가드에 경로 정규화 재검증 추가(`path.resolve`/`path.relative` 기반) + `"spec/../CLAUDE.md"` 회귀 fixture 등록. 3개 reviewer(testing/requirement/side_effect)가 독립적으로 동일 결함을 지적했고, 이번 PR 자신이 막으려던 결함과 같은 클래스라 우선순위가 높음.
2. **[WARNING #2]** `rawScalar` 의 `key` 인자에 정규식 이스케이프 적용(`key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`) — 현재 호출부는 안전하지만 export 된 범용 유틸이므로 향후 호출자를 위한 방어.
3. **[SPEC-DRIFT]** `project-planner` 경유로 `.claude/docs/plan-lifecycle.md` §5 판정 로직 서술을 실제 강화된 동작(`none`/`없음`/`n/a`/`na` 어휘 매칭, 그 외 비-빈 문자열 fail)에 맞춰 갱신. `spec/conventions/spec-impl-evidence.md` R-8 은 이미 정확하므로 코드 변경 불필요, 문서만 갱신.
4. (선택) INFO 항목들(테스트 헬퍼 중복, 매직넘버 `10`, `rawScalar` null-path 명시적 fixture)은 우선순위 낮음 — 다음 정리 라운드에서 일괄 처리 가능.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. prompt 명시: forced(router_safety) whitelist `maintainability, requirement, scope, side_effect, testing` 5명 전원 강제 실행되었고 결과 전원 확보됨(누락 없음). 제외된 reviewer 없음.