# 신규 식별자 충돌 검토 — naming_collision (4차 라운드, 종결)

## 검토 범위·방법

- target: `spec/conventions/` (`--impl-done`, diff-base `origin/main`)
- 직전 라운드(`01_53_28`)는 NONE. 이번 라운드는 그 이후 반영된 **주석 정정 1건**(`plan-frontmatter.test.ts` 헤더가 `collectLivePlanMarkdown` 의 정본을 `spec-links.ts` 가 아니라 `plan-scan.ts` 로 가리키도록 정정)만을 확인하는 종결 라운드.
- diff 섹션이 프롬프트 번들에 없어 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)를 직접 확인:
  - `git diff --stat origin/main -- spec/conventions/` → `spec-impl-evidence.md` 1파일, +3/-1 만 변경 (나머지 `spec/conventions/**` 는 origin/main 과 동일).
  - `git grep -n collectLivePlanMarkdown` 로 코드 전수 확인.
  - `git log --oneline -10` 로 직전 커밋 `f5f454844 fix(harness): 헤더 주석의 정본을 plan-scan.ts 로 정정 (ai-review W1)` 확인.

## 핵심 확인 — `collectLivePlanMarkdown` 이중 노출 상태

1. **정의는 한 곳** — `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:83` 의 `export function collectLivePlanMarkdown(root: string): PlanMdFile[]` 가 유일한 구현이다.
2. **`spec-links.ts` 는 재-export 일 뿐** — `spec-links.ts:17` 에서 `import { collectLivePlanMarkdown } from "./plan-scan"` 한 뒤 `spec-links.ts:302-304` 에서
   ```
   // plan 수집은 `plan-scan.ts` 소관이다 — 링크 모듈이 plan 트리 규칙까지 갖고 있으면
   // 그 규칙이 두 곳으로 갈린다(이 PR 이 고치고 있는 바로 그 형태).
   export { collectLivePlanMarkdown };
   ```
   로 하위호환 재-export 임을 명시적으로 밝힌다. 별도 정의가 아니라 같은 바인딩을 다시 내보내는 것뿐이라 "같은 이름, 다른 의미" 충돌은 애초에 성립하지 않는다.
3. **`plan-frontmatter.test.ts` 헤더가 이번 라운드에 정정됨** (`plan-frontmatter.test.ts:17-26`):
   > "그 규칙의 **단일 구현**은 `plan-scan.ts` 의 `collectLivePlanMarkdown` 이고 … (`spec-links.ts` 도 같은 이름을 export 하지만 그건 **하위호환 re-export** 다 …)"
   > "이 주석은 추출 직후 `spec-links.ts` 를 정본으로 적은 채 남아 있었다. 같은 PR 이 `spec-impl-evidence.md §4.2` 를 '판정 로직은 `plan-scan.ts` 소관' 으로 갱신했으므로 **문서끼리 정면으로 어긋난 상태**였다(ai-review documentation WARNING)."

   즉 이번 정정으로 코드 주석과 spec 문서(§4.2)가 "정본 = `plan-scan.ts`" 로 **일치**한다.
4. **target spec(`spec-impl-evidence.md`) §4.2 표**(`plan-frontmatter.test.ts` 행)도 동일하게 서술한다: "판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크) 소관이고 이 파일은 호출부다" — `spec-links.ts` 는 **링크 검사 로직**(`findBrokenPlanLinks` 등)의 소관이지 `collectLivePlanMarkdown` 정의의 소관이 아니라고 정확히 구분해 서술하고 있어 코드 주석과 모순이 없다.
5. **`spec-impl-evidence.md` frontmatter `code:`** 에도 `plan-scan.ts` 가 별도 항목으로 등재돼(diff 상 신규 추가) `spec-links.ts` 와 구분된 파일로 인정된다.

## 폐기된 참조 잔존 여부

- `git grep -n collectLivePlanMarkdown` 전수 결과: `plan-scan.ts`(정의) · `plan-scan.test.ts` · `spec-links.ts`(재-export) · `spec-links.test.ts` · `plan-frontmatter.test.ts` 뿐. `.claude/docs/plan-lifecycle.md` 등 다른 SoT 문서에는 이 식별자에 대한 언급 자체가 없어(구현 위치가 아니라 규약만 다룸) 상충 서술이 있을 여지가 없다.
- `plan/in-progress/docs-guard-walker-dedup.md:67-69` 가 이 정본 드리프트 사례를 **과거형 역사적 전례**("전례가 있다: … 어긋나 있었고, 주석은 '같은 스코프' 라고 말하고 있었다")로 인용하지만, 이는 별도 진행 중 plan 이 walker 통합 우선순위(P3) 근거로 쓰는 서술이지 현재 상태를 오기술하지 않는다. 현재형 주장이 아니므로 충돌/오탐 아님.
- 그 외 `spec/conventions/**` 나머지 파일(cafe24-api-catalog, audit-actions 등)은 origin/main 대비 변경이 없어 직전 3라운드(모두 NONE 으로 수렴)의 판정이 그대로 유효하다.

## 발견사항

없음. 새로 도입되거나 재정의된 식별자가 기존 사용처와 의미가 충돌하는 사례를 찾지 못했다. 이번 라운드에서 검토 대상이던 `collectLivePlanMarkdown` 이중 노출은 "재-export + 정본 명시 주석" 구조로 이미 문서상 명확히 구분돼 있고, 코드 주석·target spec(§4.2)·직전 커밋 이력이 서로 일치한다.

## 요약

target 문서(`spec/conventions/`, 특히 `spec-impl-evidence.md`)가 도입한 식별자(요구사항 `id:`, 필드명, ENV/설정키, 가드 파일 경로 등)는 기존 사용처와 충돌하지 않는다. 이번 4차 라운드가 특정해 확인을 요구한 `collectLivePlanMarkdown` 이중 노출도, `plan-scan.ts` 를 유일한 정본으로 두고 `spec-links.ts` 는 명시적 하위호환 재-export 로만 노출하는 구조이며, 코드 주석의 최신 정정(`f5f454844`)이 target spec §4.2 서술과 완전히 일치해 더 이상 "정본이 어디인지" 혼선이 남지 않는다. 폐기되거나 상충하는 참조도 코드베이스·spec·plan 전수 grep 상 발견되지 않았다. 게이트를 여는 종결 라운드로서 새로운 CRITICAL/WARNING/INFO 없음.

## 위험도

NONE

STATUS=success
