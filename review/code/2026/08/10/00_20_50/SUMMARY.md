# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 세 명의 reviewer(requirement, maintainability, testing)가 서로 다른 각도에서 같은 근본 원인 — "이 PR 자신이 경계하는 '손 재구현 walker/검사 로직이 조용히 어긋난다' 패턴이 완전히 해소되지 않았다" — 을 지적했고, 그중 testing 의 지적은 실측(158 tests 전량 GREEN 중 `wrong.push` 분기 unexercised 확인)으로 vacuous-pass 위험을 증명해 MEDIUM 으로 판정한다. forced whitelist(6개) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/중복 | `plan/complete/**` 를 재귀 순회하는 신규 `collectCompletedPlans` 가 이 PR 자신이 헤더 주석에서 명시적으로 경계하는 "손 재구현 walker 가 조용히 어긋난다" 패턴을 재발시킴. (a) 기존 Gate C 의 `collectCompletePlans`(spec-plan-completion.test.ts) 와 스코프가 다르다 — 후자는 `0-`/`_` 접두 파일을 명시적으로 제외하지만 신규 함수는 전부 포함(실측으로 확인, 현재 데이터상 무해). (b) `spec-links.ts` 내 `collectSpecMarkdown`/`collectCodebaseSources` 와 구조적으로 거의 동일한 DFS 워커라 3~4번째 변종이 됨. | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:55-71` (collectCompletedPlans); 비교대상 `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59-83` (collectCompletePlans); `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:130-150, 345-369` (collectSpecMarkdown, collectCodebaseSources) | 공용 `walkFiles(roots, {skipDir, matchFile})` 저수준 헬퍼로 추출하거나, `collectLivePlanMarkdown` 과 동형으로 `collectCompletePlanMarkdown` 류 공유 export 함수를 만들어 `plan-frontmatter.test.ts`/`spec-plan-completion.test.ts` 양쪽이 사용하게 할 것. 스코프 차이가 의도적이라면 최소 1줄 근거를 코드에 명시. |
| 2 | 테스트 | "완료 plan 의 status 모순" 검사(`no completed plan still declares status: in-progress`) 로직이 export 되지 않은 로컬 함수/인라인 코드로만 존재해 negative-path/fixture 검증이 구조적으로 불가능 — vacuous-pass 위험. 실측: `pnpm vitest run` 158 tests 전량 GREEN 동안 `wrong.push(...)` 분기가 한 번도 실행되지 않음을 확인. 같은 PR 의 자매 검사(`findBrokenPlanLinks`)는 이미 로직을 `spec-links.ts` 로 추출해 fixture 로 실제 탐지를 증명했으나, 이 검사만 그 교훈을 적용받지 못함. 파일 헤더 자신이 "뮤테이션 시 전량 GREEN" 이라는 정확히 이 실패 클래스를 두 번(#1108, #1117) 겪었다고 명시. | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:195-218` (검사 로직), `:55-71` (collectCompletedPlans), `:80` (TERMINAL_STATUSES) | 로직을 `spec-links.ts`(또는 별도 shared 모듈)의 `root` 파라미터를 받는 export 함수(예: `findNonTerminalCompletedPlans(root): string[]`)로 추출하고, `spec-links.test.ts` 에 `status: in-progress`(또는 임의 non-terminal 값)를 가진 합성 fixture 로 "실제로 위반이 잡히는지" 증명하는 negative-path 테스트 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 정확성 | `collectCompletedPlans` 의 파일 판정이 `isDirectory()` 의 부정(`else`)만으로 `.md` 취급 — 형제 함수(`collectCompletePlans`)는 `isFile()` 을 명시적으로 검사. `.md` 로 끝나는 심볼릭 링크가 있으면 이론상 포함될 수 있음(현재 저장소엔 없어 무해). | `plan-frontmatter.test.ts:64` | `e.isFile() && e.name.endsWith(".md")` 로 통일 |
| 2 | 유지보수성 | `Dirent` 순회 변수명이 파일 내에서 `e`(collectLivePlanMarkdown) / `entry`(collectSpecMarkdown, collectCodebaseSources) 로 혼용 | `spec-links.ts:551` vs `:137`, `:353` | 한 파일 내 동일 개념에 동일 이름 사용 |
| 3 | 유지보수성 | `findBrokenLinksInFiles` 가 self-anchor/cross-file DEAD/cross-file ANCHOR 처리를 한 함수 안에서 모두 담당해 분기 수가 많음(설계 의도는 주석에 명시돼 있어 리스크는 낮음) | `spec-links.ts` ~181-252 | `resolveSelfAnchorViolation`/`resolveCrossFileViolation` 서브 헬퍼로 분리(선택) |
| 4 | 테스트 | `toBeGreaterThan(20)` 이 과거 정확히 실패했던(grooming 후 정확히 20 이 되어 발화) 것과 같은 종류의 매직넘버를 재사용. `in-progress` 쪽은 이미 `5`로 낮춰 회피했으나 `completed` 쪽은 `20` 그대로 | `plan-frontmatter.test.ts:192` | 낮은 하한(예: `5`)으로 통일하거나 이름 있는 상수로 양쪽이 공유 |
| 5 | 테스트 | 테스트명이 실제 검사 범위(allowlist — `TERMINAL_STATUSES` 밖 모든 값을 위반 처리)보다 좁게 서술됨(`in-progress` 리터럴만 언급) | `plan-frontmatter.test.ts:195` | "declares a non-terminal status" 등으로 일반화 |
| 6 | 테스트 | `collectCompletedPlans` 의 재귀 walk(임의 깊이, `archive` 디렉터리 스킵)가 합성 fixture 없이 라이브 저장소의 우연한 트리 형태에만 의존해 검증됨 | `plan-frontmatter.test.ts:55-71` | WARNING #2 추출 시 nested `archive`/non-`archive` fixture 로 단위 테스트 병행 추가 |
| 7 | 보안 | markdown 링크의 상대경로 해석에 정규화/이스케이프 검증이 없어 이론상 저장소 루트 밖 경로 열람이 가능(`path.resolve` + `fs.readFileSync`). 다만 입력이 전부 같은 저장소 커밋 작성자가 적은 신뢰된 값이라 실질 위협 모델 성립 안 함 | `spec-links.ts:224-236` | 필수 아님. 원한다면 `path.relative(root, resolved).startsWith("..")` 가드 추가 |
| 8 | 보안 | frontmatter YAML 파싱(`gray-matter`/`js-yaml`) 의존성 버전 인지 — 4.x 이후는 안전 스키마 기본값이라 현재 위험 없음 | `plan-frontmatter.test.ts:116, :201` | 정기 의존성 점검 시 버전 확인(이번 diff 범위 조치 불요) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | SoT(`.claude/docs/plan-lifecycle.md` §3·§4)와 line-level 일치 확인(실측 데이터 정확히 부합); `plan/complete/**` walker 재-중복 인스턴스 1건(WARNING #1 기여) |
| scope | NONE | 발견 없음 — 3파일 변경분 전부 "plan 이동 갭 게이트" 목표에 부합, 스코프 이탈 없음 |
| side_effect | NONE | 신규 함수 순수 추가, 기존 함수 시그니처 불변, 신규 fixture 는 `os.tmpdir()` 격리, 신규 저장소 순회 코드는 전부 read-only |
| maintainability | LOW | walker 로직 3중 구조적 중복(WARNING #1 기여); 네이밍 혼용·매직넘버·분기과다는 INFO |
| testing | MEDIUM | status 모순 검사 vacuous-pass 위험(WARNING #2) — 실측으로 미실행 분기 확인. `findBrokenPlanLinks` 쪽은 fixture 품질 우수 |
| security | NONE | 신뢰된 저장소 콘텐츠만 다루는 CI/테스트 도구, 공격표면 없음. path traversal/의존성 인지는 INFO |

## 발견 없는 에이전트

- **scope** — 발견사항 없음. 리팩터링(`collectTopLevelPlans` 위임화) 포함 모든 변경이 "plan 이동 갭 게이트" 단일 목표에 부합.
- **side_effect** — CRITICAL/WARNING 급 발견 없음. 확인용 INFO(정렬 기준 변경, temp-dir 격리, read-only 순회)만 존재하며 전부 "문제 없음" 결론.

## 권장 조치사항

1. (최우선) testing WARNING #2 조치 — `collectCompletedPlans` + status 비교 로직을 export 가능한 공유 함수로 추출하고 non-terminal status 합성 fixture 로 negative-path 테스트 추가. vacuous-pass 위험을 해소하는 것이 이번 라운드의 유일한 실질 위험(MEDIUM) 근본 원인.
2. walker 로직 통합(WARNING #1) — `collectCompletedPlans`/`collectCompletePlans`(Gate C)/`collectSpecMarkdown`/`collectCodebaseSources` 를 공용 `walkFiles` 헬퍼 또는 공유 export 함수로 합치거나, 스코프 차이가 의도적이면 최소 1줄 근거를 코드에 명시. #1 조치 시 이 통합을 함께 수행하면 중복 작업을 줄일 수 있음(둘 다 `collectCompletedPlans` 를 건드림).
3. (낮은 우선순위, 선택) INFO 항목 일괄 정리 — `isFile()` 명시적 체크, `e`/`entry` 네이밍 통일, `toBeGreaterThan(20)` 상수화, 테스트명 일반화, path traversal 방어 가드.

## 라우터 결정

- **실행**: `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `security` (6명, 전원)
- **제외**: 없음 (0명)
- **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전원 forced whitelist — 6명 전원 결과 확보됨, 미이행 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |

routing 값은 `all` — 라우터가 전체 reviewer 실행을 결정, skip 없음.