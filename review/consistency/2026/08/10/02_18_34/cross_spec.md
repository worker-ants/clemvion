# Cross-Spec 일관성 검토 — cross_spec (4차 라운드)

## 검토 범위

- target: `spec/conventions/` (impl-done, diff-base=`origin/main`)
- 4차 라운드는 직전(`01_53_28`, 5종 전원 NONE) 이후 발생한 **단일 커밋**
  `f5f454848` (`fix(harness): 헤더 주석의 정본을 plan-scan.ts 로 정정 (ai-review W1)`)
  의 파급만 확인 대상. `git diff origin/main...HEAD --stat -- spec/conventions/`
  로 재확인한 결과 target scope 안에서 이 라운드 전체를 통틀어 변경된 spec 파일은
  `spec-impl-evidence.md` 1건(+3/-1줄)뿐이고, 그 변경은 이미 `01_53_28`(NONE) 이전
  커밋(`dd7da2d1b`/`88555a52b`)에서 반영되어 검토를 통과한 상태였다. 이번 라운드의
  실제 신규 diff 는 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
  의 헤더 주석 8줄 수정뿐이며, spec 파일 자체는 건드리지 않았다.

## 확인 절차

1. `git diff origin/main...HEAD -- codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
   — 주석이 "단일 구현은 `spec-links.ts`" → "단일 구현은 `plan-scan.ts` 의
   `collectLivePlanMarkdown`, `spec-links.ts` 는 하위호환 re-export" 로 정정된 것을 확인.
2. `git diff origin/main...HEAD -- codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
   — `export { collectLivePlanMarkdown }`(from `plan-scan.ts`, re-export) +
   `findBrokenPlanLinks`(자체 구현, `findBrokenLinksInFiles` 래핑)로 실제 코드가
   주석의 새 서술과 일치함을 확인.
3. `git show HEAD:codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` — `collectLivePlanMarkdown`
   /`collectCompletePlanMarkdown`/`findNonTerminalCompletedPlans`/`TERMINAL_PLAN_STATUSES`
   가 실제로 이 파일에 정의되어 있음(= 정본)을 확인.
4. 4개 층 교차 대조:
   - **`PROJECT.md:277`**: "판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크)."
   - **`spec-impl-evidence.md §4.2` `plan-frontmatter.test.ts` 행**: "판정 로직은
     `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크) 소관이고 이 파일은 호출부다"
   - **`spec-impl-evidence.md` frontmatter `code:`**: `plan-scan.ts` 등재됨 (line 16 근처)
   - **`plan-lifecycle.md §4/§5`**: status 종료값 검사(→ `plan/complete/**`)와 상대링크
     검사(→ top-level `in-progress`)의 스코프 차이를 서술 — `plan-scan.ts`/`spec-links.ts`
     의 실제 함수 스코프(`walkPlanMarkdown("complete", recurse:true)` vs
     `walkPlanMarkdown("in-progress", recurse:false)`)와 정확히 일치.
   - **가드 코드**: `plan-frontmatter.test.ts` 가 `findBrokenPlanLinks`(from `spec-links.ts`)
     와 `collectCompletePlanMarkdown`/`findNonTerminalCompletedPlans`(from `plan-scan.ts`)
     를 각각 import 해 두 테스트 스위트("no broken relative links" / "no completed plan
     declares a non-terminal status")를 구성 — 4개 문서 층의 서술과 코드가 1:1 로 맞음.
5. `grep -rn "단일 구현"` / `"spec-links.ts"` 를 `spec/`, `PROJECT.md`,
   `.claude/docs/plan-lifecycle.md`, 가드 코드 전역에 재실행 — `spec-links.ts` 를
   "(유일) 정본 구현"이라 주장하는 잔여 서술 없음. 남은 `spec-links.ts` 언급은 모두
   "그 파일이 실제로 구현을 갖는 `findBrokenPlanLinks`" 또는 "재추출 대상"이라는
   정확한 맥락이라 오탐 아님.
6. `plan-scan.ts` 주석이 인용하는 `plan/in-progress/docs-guard-walker-dedup.md`
   (walker 3벌 통합 판정 후속 plan) 실존 확인 — 날조 아님, 실제로 diff 에 신규 파일로
   존재하고 내용도 인용과 일치.

## 발견사항

없음. 이번 라운드가 검토한 유일한 변경(주석 8줄 정정)은 이미 정합했던 3개 문서 층
(`PROJECT.md`, `spec-impl-evidence.md §4.2`, `plan-lifecycle.md §4/§5`)에 코드 주석을
맞춘 것으로, 새로운 모순을 만들지 않았다. 데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC·계층 책임 6개 관점 전부에서 target(`spec/conventions/`)과 다른 spec 영역
사이의 충돌 신호를 찾지 못했다.

## 요약

4차 라운드는 직전 NONE 판정(`01_53_28`) 이후 유일한 실질 diff — `plan-frontmatter.test.ts`
헤더 주석의 정본 참조를 `spec-links.ts` → `plan-scan.ts` 로 정정한 8줄 — 의 파급만
검토했다. 코드(`plan-scan.ts` 정의 + `spec-links.ts` re-export/구현 분리)와 4개 문서 층
(`PROJECT.md:277`, `spec-impl-evidence.md §2.2/§4.2`+frontmatter `code:`,
`plan-lifecycle.md §4/§5`)이 서로 정확히 일치함을 diff·소스 대조로 확인했으며, 새 불일치는
발견되지 않았다. Cross-Spec 일관성 관점에서 target 은 안전하게 게이트를 통과할 수 있다.

## 위험도

NONE

STATUS=success
