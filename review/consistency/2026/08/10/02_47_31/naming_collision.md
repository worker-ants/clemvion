# 신규 식별자 충돌 검토 — spec/conventions/ (impl-done, diff-base=origin/main)

## 검토 방법

`origin/main` 대비 diff 를 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서
`git diff origin/main -- codebase/ plan/ spec/conventions/ .claude/` 로 직접 확인했다(번들에는 diff 섹션이
빠져 있다는 알려진 결함이 있어 이 경로로 우회). 직전 라운드(`02_33_44`, NONE)에서 이번 라운드까지
반영된 세 변경분을 표적 확인했다:

1. `describe("plan-frontmatter guard")` → `describe("plan lifecycle guards (frontmatter + live-plan links)")`
   (`codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`)
2. 헤더 주석 축약 (동일 파일)
3. 신규 plan 파일 `plan/in-progress/docs-guard-legacy-fixture-coverage.md`

## 발견사항

새로 보고할 CRITICAL/WARNING/INFO 없음. 확인한 6개 관점 중 이번 델타와 관련 있는 것은 ②(엔티티/타입명)와
⑥(파일 경로)이며, 둘 다 충돌 없음을 실측으로 확인했다.

### ⑥ 파일 경로 — 신규 plan 파일명 충돌 여부

- **target 신규 식별자**: `plan/in-progress/docs-guard-legacy-fixture-coverage.md`
- **비교 대상**: `plan/in-progress/docs-guard-walker-dedup.md` (기존, 같은 라운드에 함께 생성됨) +
  `plan/in-progress/` 전체 34개 + `plan/complete/` 전체
- **확인**: `find plan/in-progress plan/complete -maxdepth 2` 로 전수 조회 — 정확히 동일한 파일명은
  없음. `docs-guard-` 접두를 공유하는 파일은 위 두 개뿐이며, 나머지 32개 in-progress 파일 중 어느
  것도 `docs-guard-` 로 시작하지 않는다.
- **판단**: 접두 공유는 우연이 아니라 **의도된 클러스터링**이다 — `docs-guard-legacy-fixture-coverage.md`
  본문이 `docs-guard-walker-dedup.md` 를 `> 관련: ... 같은 디렉터리의 walker 중복 판정. 축이 달라
  별 plan 이지만 착수 시점은 겹쳐도 좋다` 로 명시 교차 링크하고, 반대쪽도 자신을 다른 후보 plan
  (`harness-env-value-subpattern-dedup.md`)에서 명시적으로 분리한 이유를 적어 뒀다(코드베이스·언어·
  실패 모드가 다르다는 근거). 두 파일의 나머지 부분(`-walker-dedup` vs `-legacy-fixture-coverage`)이
  충분히 달라 `ls`/grep 상 혼동 가능성도 낮다. 파일명 컨벤션(`plan/<kebab-case-slug>.md`, 사전 접두
  규칙 없음)도 위반하지 않는다.
- **등급**: 충돌 아님 — 보고 생략 대상이나 확인 근거로 남김.

### ② 엔티티/타입명 — `plan-scan.ts`/`spec-links.ts` 신규 export

- **target 신규 식별자**: `PlanMdFile`, `TERMINAL_PLAN_STATUSES`, `NonTerminalPlan`,
  `findNonTerminalCompletedPlans`, `collectLivePlanMarkdown`, `collectCompletePlanMarkdown` (모두
  `plan-scan.ts` 신규) + `collectCodebaseSources`, `findBrokenSpecLinksInSources`,
  `findBrokenPlanLinks` (`spec-links.ts` 확장)
- **확인**: `codebase/**/*.ts,*.tsx` 전역에서 각 식별자를 `grep -rl` — 정의 파일과 직접 소비 파일
  (`plan-frontmatter.test.ts`, `plan-scan.test.ts`, `spec-link-integrity.test.ts`, `spec-links.test.ts`)
  외 다른 의미로 쓰이는 곳 없음.
- **등급**: 충돌 아님.

### `describe` 이름 재명명 — `-t` 필터 오염 여부

- **target 신규 식별자**: `describe("plan lifecycle guards (frontmatter + live-plan links)", ...)`
- **확인 1 (동일 텍스트/근접 텍스트 충돌)**: `codebase/frontend/src/lib/docs/__tests__/*.test.ts` 전체
  36개 `describe(...)` 블록을 열거 — "plan lifecycle" 문자열을 포함하는 다른 블록 없음. 가장 가까운
  이웃은 같은 파일의 두 번째 블록 `"completed plans declare a terminal status"`(다른 이름, 다른
  스코프)와 `plan-scan.test.ts` 의 `"plan-scan"` 뿐이며 어느 쪽도 부분 문자열로 겹치지 않는다.
- **확인 2 (구 이름 `-t` 참조처 파괴 여부)**: 구 이름 `"plan-frontmatter guard"` 를
  `.github/workflows/*.yml`, `Makefile`, `.claude/**`, 그 밖의 `*.md`/`*.ts`/`*.yml` 전체에서
  검색 — CI/스크립트에서 `-t`/`--grep` 필터로 참조하는 곳은 0건. 유일한 매치는 (a) 과거 리뷰
  산출물(`review/code/**/*.md`, `review/consistency/2026/07/16/14_57_19/plan_coherence.md`)의
  정적 로그 텍스트뿐이며 이들은 재실행 대상이 아닌 시점 기록이다, (b) `.claude/docs/plan-lifecycle.md`
  에 남은 참조는 **파일명** `plan-frontmatter.test.ts` 를 가리키는 것이지 `describe` 문자열이
  아니므로 영향 없음.
- **확인 3**: 리포지토리 `.github/workflows/*.yml` 전체에서 `-t "` / `--grep` 패턴 자체가 0건 —
  현재 이 프로젝트의 프론트엔드 vitest 실행에는 `describe` 이름 기반 필터가 CI 경로에 존재하지
  않는다(수동 로컬 실행 시나리오만 영향권이나, 그 경우도 이번 이름이 더 구체적이라 오히려
  필터링이 쉬워졌다).
- **등급**: 충돌 아님. (참고로 이 항목은 `review/code/2026/08/10/02_47_31/side_effect.md` 의
  코드 리뷰에서도 동일 결론으로 이미 확인된 바 있다 — 본 검토는 독립적으로 재확인했다.)

## 요약

이번 라운드에서 반영된 세 변경(`describe` 이름 재명명, 헤더 주석 축약, 신규 plan 파일
`docs-guard-legacy-fixture-coverage.md`) 모두 신규 식별자 충돌 관점에서 문제가 없다. 신규
plan 파일명은 `docs-guard-walker-dedup.md` 와 접두만 공유할 뿐 전체 파일명·내용이 명확히
구분되고 두 문서가 서로를 교차 링크해 의도된 클러스터링임을 스스로 밝히고 있으며, 기존
34개 plan 중 어느 것과도 정확히 겹치지 않는다. 재명명된 `describe` 문자열은 같은 테스트
디렉터리의 다른 36개 `describe` 블록 및 CI/스크립트의 `-t`/`--grep` 참조처 전체를 확인한
결과 어디에도 오염을 일으키지 않는다. `plan-scan.ts`/`spec-links.ts` 의 신규 export 도
저장소 전역에서 다른 의미로 재사용되는 곳이 없다. 새로 보고할 CRITICAL/WARNING/INFO는 없다.

## 위험도

NONE

STATUS=success
