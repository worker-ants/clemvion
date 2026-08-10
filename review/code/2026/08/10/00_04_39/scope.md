# 변경 범위(Scope) 리뷰

## 리뷰 방법 메모

프롬프트에는 diff 블록 없이 "전체 파일 컨텍스트"만 제공되어, 실제 변경분을 판별하기 위해
`git diff origin/main...HEAD -- codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts
codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 를 직접 확인했다. 두 파일 모두
**순수 추가(insertion-only)** 이며 기존 라인의 삭제·재배치는 없다
(`plan-frontmatter.test.ts` +108/-0, `spec-links.ts` +41/-0).

## 발견사항

- **[INFO]** `collectTopLevelPlans`(plan-frontmatter.test.ts) 와 `collectLivePlanMarkdown`(spec-links.ts) 가 거의 동일한 `plan/in-progress/*.md` 스캔 로직을 각각 보유
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:45-59` (`collectTopLevelPlans`) / `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:267-282` (`collectLivePlanMarkdown`)
  - 상세: 두 함수 모두 `plan/in-progress` 를 1-depth 로 읽어 `.md` 를 모은다. 차이는 `collectTopLevelPlans` 가 `0-`/`_` 프리픽스(인덱스 파일)를 제외한다는 점뿐이다. 이번 변경(2개의 신규 게이트 추가)의 목적에는 부합하지만, 동일 디렉터리를 훑는 헬퍼가 파일 하나씩 따로 존재하게 됐다.
  - 제안: 스코프 위반은 아니므로 이번 라운드에서 조치할 필요는 없다. 다만 향후 `plan/in-progress` 스캔 로직이 한 곳 더 늘어나면 공유 헬퍼로 합치는 걸 고려할 만하다 (maintainability 관점 — 이 리뷰의 범위 판단에는 영향 없음).

## 요약

두 파일 모두 커밋 메시지(`feat(harness): plan 이동이 남기던 두 갭에 게이트`)가 명시한 목적 — (a) `complete/` 인데 `status: in-progress` 로 남은 모순 검출, (b) 살아있는 plan 의 깨진 상대링크 검출 — 에 정확히 대응하는 코드만 추가됐다. `plan-frontmatter.test.ts` 는 `collectCompletedPlans` + `TERMINAL_STATUSES` + 2개 신규 `it` 블록을, `spec-links.ts` 는 `collectLivePlanMarkdown` + `findBrokenPlanLinks` 를 추가했을 뿐 기존 함수(`collectTopLevelPlans`, `findBrokenLinksInFiles`, `WORKTREE_PLACEHOLDER` 등)는 손대지 않았다. 새 import(`collectLivePlanMarkdown`, `findBrokenPlanLinks`)는 실제로 사용되며 미사용 임포트나 정리성 변경은 없다. 이전 라운드에서 WARNING 으로 지적됐던 "링크 스캐너를 코드펜스 무시 없이 손으로 새로 짠 정규식"(리뷰 히스토리 `review/code/2026/08/09/23_43_28`) 은 이미 공유 구현(`findBrokenLinksInFiles`) 호출로 대체되어 이번 스냅샷에는 재발하지 않았다. 포맷팅·주석·설정 변경은 모두 신규 기능과 직접 결합된 서술형 rationale 주석(이 저장소의 기존 관례와 일치)이며 무관한 정리는 없다. 참고로 이 브랜치 전체에는 `plan/**` 문서 20여 건의 `status:` 필드 정정과 `.claude/docs/plan-lifecycle.md` 갱신 등도 포함되어 있으나, 이번 리뷰 대상 파일 목록에는 포함되지 않아 범위 밖으로 판단해 다루지 않았다.

## 위험도

NONE
