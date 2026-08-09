# Requirement Review — plan-lifecycle gates (plan-frontmatter.test.ts / spec-links.ts)

## 컨텍스트

대상 두 파일은 `.claude/docs/plan-lifecycle.md` §4/§5 가 SoT 인 두 신설 게이트(완료 plan `status` 종료값 강제, 살아있는 plan 상대링크 무결성)의 구현이다. 직전 리뷰 라운드(`review/code/2026/08/09/23_43_28/`)의 WARNING 2건 — (1) 링크 스캐너를 `spec-links.ts` 공유 구현으로 교체, (2) `plan-lifecycle.md §5` 이동 체크리스트에 신설 규칙 반영 — 은 이후 커밋(`f4a1723be`, `9e880e908`)에서 조치되어 현재 코드·문서에 실제로 반영돼 있음을 확인했다 (`spec-links.ts:302-306` `findBrokenPlanLinks`, `plan-lifecycle.md` §5 체크리스트에 두 항목 존재). `pnpm vitest run plan-frontmatter.test.ts` 149/149 PASS 실측 확인.

`TERMINAL_STATUSES = new Set(["complete", "implemented", "applied", "superseded"])` (`plan-frontmatter.test.ts:87`) 은 `plan-lifecycle.md` §4 의 "`complete` · `implemented` · `applied` · `superseded`" 와 line-level 로 정확히 일치. `WORKTREE_SENTINEL = "(unstarted)"` (`plan-frontmatter.test.ts:43`) 도 §4 의 sentinel 표기와 정확히 일치.

## 발견사항

- **[WARNING]** `findBrokenPlanLinks` 의 스코프가 주석이 주장하는 것과 실제로 다르다 — `collectTopLevelPlans` 와 "같은 top-level 스코프" 라고 명시했지만, 실제로는 `0-`/`_` 접두 index 파일을 걸러내지 않는 별도 함수(`collectLivePlanMarkdown`)를 쓴다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:36` (주석 "— (b) 는 위 `collectTopLevelPlans` 와 **같은 top-level 스코프**다") 및 `:45-59` (`collectTopLevelPlans` 정의, `!e.name.startsWith("0-") && !e.name.startsWith("_")` 필터 보유) / `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:267-282` (`collectLivePlanMarkdown` 정의, 해당 필터 없음)
  - 상세: `plan-frontmatter.test.ts` 상단 주석(파일 8-19줄)은 이 가드 스위트 전반의 스코프로 "`0-`/`_`-prefixed index files are exempt" 를 선언한다. §4 신설 두 검사 중 (a)(status)는 `collectCompletedPlans` 로 별도 구현돼 이 문제가 없지만, (b)(링크)는 `35-36`줄에서 "`collectTopLevelPlans` 와 같은 top-level 스코프" 라고 명시적으로 주장하면서 실제로는 `spec-links.ts` 의 `collectLivePlanMarkdown` 을 호출한다(`plan-frontmatter.test.ts:175` → `spec-links.ts:302-306`). 이 함수는 `isFile() && endsWith(".md")` 만 걸러 그룹 서브폴더 제외는 동일하지만, `0-`/`_` 접두 제외 필터가 없다. 현재 `plan/in-progress/` 최상위에 그런 이름의 파일이 없어 실제 실패는 0건(런타임 관측 확인)이지만, 향후 top-level index 파일(예: 클러스터 인덱스를 서브폴더 대신 최상위에 `0-`로 두는 경우)이 생기면 frontmatter 검사는 면제되는데 링크 검사만 걸려 주석이 약속한 대칭성이 깨진다. `plan-lifecycle.md` 자체는 이 (b) 검사에 대해 0-/_ 접두 면제를 규정하지 않으므로 spec 위반은 아니고, 순수하게 **코드 내부 주석과 실제 구현 간의 불일치**다.
  - 제안: 주석을 "그룹 서브폴더만 동일하게 제외되고 `0-`/`_` 접두 면제는 적용되지 않는다"로 정정하거나, `collectLivePlanMarkdown` 에도 동일한 접두 필터를 추가해 주석이 약속한 대칭 스코프를 실제로 만족시킨다.

- **[INFO]** `status` 필드가 문자열이 아니면(`status: [complete]` 등) 조용히 skip 됨 — `plan-frontmatter.test.ts:215` `if (typeof status !== "string") continue;`. 직전 RESOLUTION(`review/code/2026/08/09/23_43_28/RESOLUTION.md` INFO#2)에서 이미 검토·유보(실측 0건)된 항목으로, 재조치 요구 아님. 참고로만 남김.

- **[INFO]** `in-progress/` 에 종료 status(`complete`/`implemented`/`applied`/`superseded`)를 선언한 거울상 케이스는 검사하지 않음. 마찬가지로 직전 RESOLUTION(INFO#1)에서 "실측 0건, 대칭 가드는 표면만 늘림" 으로 의식적으로 유보된 결정. 재조치 요구 아님.

## 요구사항 충족 평가

두 신설 게이트(§4 `status` 종료값 강제, 살아있는 plan 상대링크 무결성)는 `plan-lifecycle.md` §4/§5 본문과 필드명·허용값 집합·sentinel 문자열까지 line-level 로 정확히 일치하며, 149개 관련 테스트가 실측 GREEN 이다. 에러 시나리오(frontmatter 파싱 실패, 존재하지 않는 디렉터리, 빈 컬렉션)는 모두 vacuous-pass 방지 하한 단언으로 방어돼 있고, TODO/FIXME 류 미완성 표식은 없다. 직전 라운드 WARNING 2건은 실제로 해소됐음을 커밋 히스토리·현재 코드로 교차 확인했다. 유일한 잔여 발견은 링크 검사 스코프에 대한 주석-구현 불일치 하나이며 현재 데이터로는 무해(0건)한 잠재적 드리프트다.

## 위험도
LOW
