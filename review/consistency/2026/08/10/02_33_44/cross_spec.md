# Cross-Spec 일관성 검토 — cross_spec (5차 라운드)

## 검토 범위

- target: `spec/conventions/` (impl-done, diff-base=`origin/main`)
- 직전 라운드(`02_18_34`)는 5종 전원 NONE. 그 이후 반영된 것은 테스트 캐너리 강화
  1건(`6101a04b2` — `fix(harness): non-vacuity 캐너리가 discovery 만 증명하던 것을 추출
  단계로 강화 (ai-review W1)`)뿐이라는 프롬프트 서술을 `git log --oneline --format="%H
  %ad %s" -5`(워킹트리 절대경로, HEAD=`c703039ba`)로 직접 재확인했다.

## 확인 절차

1. `git diff origin/main...HEAD --stat` 전체 재확인 — `02_18_34` 이후 새 커밋은
   `6101a04b2`(테스트 파일)와 `c703039ba`(`review/code/.../02_18_34/RESOLUTION.md` 1줄
   doc 확정)뿐. **`spec/**` 은 이 두 커밋 어디에서도 건드리지 않음** —
   `git show --stat 6101a04b2` / `git show --stat c703039ba` 로 각각 확인.
2. `git show 6101a04b2 -- codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
   — 변경 내용은 두 캐너리(non-vacuity 단언)뿐:
   - "the plan link scanner actually sees links (non-vacuity)" — 종전엔
     `collectLivePlanMarkdown(root).length > 5`(파일 수집 개수)만 세던 것을,
     `extractLinks`(from `spec-links.ts`)를 각 파일에 적용해 **실제 추출된 링크 총합
     > 50** 을 세도록 강화.
   - "finds completed plans to validate" → "... (discovery only)" 로 개명, 주석에
     실제 위반 판정 증명은 `plan-scan.test.ts`(합성 fixture) 소관임을 명시.
3. `grep -n "export function extractLinks" codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
   — `extractLinks` 는 이미 export 되어 있던 기존 함수(이번 커밋 이전 라운드에서 도입)라,
   신규 import 가 존재하지 않는 심볼을 가리키는 참조 오류가 아님을 확인.
4. `spec/conventions/spec-impl-evidence.md §4.2` 의 `plan-frontmatter.test.ts` 행을 재대조 —
   "판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크) 소관이고 이 파일은
   호출부다" 라는 서술은 이번 강화 후에도 그대로 유효하다: 캐너리는 여전히 `plan-scan.ts`
   의 `collectLivePlanMarkdown`/`collectCompletePlanMarkdown` 과 `spec-links.ts` 의
   `extractLinks`/`findBrokenPlanLinks` 를 호출만 할 뿐 판정 로직을 자체 보유하지 않는다.
   두 함수의 소속(파일)도 바뀌지 않았다.
5. `spec/`, `.claude/docs/plan-lifecycle.md`, `PROJECT.md` 전역에 `grep -rn` 으로
   "non-vacuity" / "toBeGreaterThan" / "discovery only" / "extractLinks" 를 재검색 —
   spec 계층 문서 어디에도 이 캐너리들의 구체 임계값(`>5`, `>50`)이나 개별 테스트
   케이스명("the plan link scanner actually sees links" 등)을 인용하는 서술이 없음을
   확인. 즉 spec 문서가 이 테스트의 **세부 구현**을 텍스트로 약속한 적이 없으므로,
   테스트 내부 단언 강화가 spec 서술과 모순을 만들 표면 자체가 없다.
6. `spec-impl-evidence.md` frontmatter `code:` 목록 — `plan-frontmatter.test.ts` 는
   이미 등재되어 있고, 이번 커밋은 그 파일의 **내용**만 바꿨을 뿐 새 파일을 추가하지
   않았으므로 frontmatter 갱신 의무도 발생하지 않는다(§2.1 "code: 는 spec 이 약속한
   surface 의 구현 경로" — 파일 목록 자체는 불변).

## 발견사항

없음. `02_18_34` 이후 유일한 실질 diff(`6101a04b2`)는 `spec/conventions/` 를 포함해
`spec/**` 어디도 건드리지 않는 **테스트 파일 내부 단언 강화**이며, 참조 대상 함수
(`extractLinks`, `collectLivePlanMarkdown`, `collectCompletePlanMarkdown`)는 이미
`plan-scan.ts`/`spec-links.ts` 에 정의·export 되어 있던 기존 심볼이라 신규 표면을
만들지 않았다. `spec-impl-evidence.md §4.2` 의 `plan-frontmatter.test.ts` 서술(판정
로직 소재지 = `plan-scan.ts`+`spec-links.ts`, 이 파일은 호출부)은 강화 후에도
정확히 유지된다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개
관점 전부에서 target(`spec/conventions/`)과 다른 spec 영역 사이의 충돌 신호를
찾지 못했다.

## 요약

5차 라운드는 직전 NONE 판정(`02_18_34`) 이후 유일한 변경 — `plan-frontmatter.test.ts`
의 non-vacuity 캐너리 2건을 "파일 수 집계" 에서 "실제 추출 링크 수 집계"(및 이름
정정 "discovery only")로 강화한 `6101a04b2` — 의 파급만 확인했다. 이 커밋은
`spec/**` 을 전혀 건드리지 않고, 참조하는 함수도 모두 기존 export 라 신규
cross-spec 표면이 없다. 이후 유일한 추가 커밋(`c703039ba`)도 `review/` 문서 1줄
확정으로 spec 무관이다. Cross-Spec 일관성 관점에서 새 발견 없이 게이트를 통과할 수
있다.

## 위험도

NONE

STATUS=success
