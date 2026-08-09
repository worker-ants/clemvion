# Plan 정합성 검토 — 4차 라운드(종결 확인)

## 검토 범위

- target: `spec/conventions/` (diff-base `origin/main`, impl-done)
- 워크트리: `/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates` (working
  tree clean, 전부 커밋됨 — `git status` 확인)
- 직전 라운드(`01_53_28`)는 NONE 이었다. 그 뒤 실제로 반영된 것은 커밋 2건뿐:
  - `f5f454844` (`fix(harness): 헤더 주석의 정본을 plan-scan.ts 로 정정 (ai-review W1)`) —
    `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 의 헤더 주석 1건만 변경
  - `3b037bc26` (`docs(review): 02_06_01 RESOLUTION e2e 줄 확정`) — `review/**` 산출물만
    (`review/code/2026/08/10/02_06_01/RESOLUTION.md` 1줄), plan/spec/codebase 무관
- `git log --since="2026-08-10 01:53:00" -- .` 로 두 커밋 외 추가 커밋이 없음을 실측 확인.
  사용자 서술("정본 주석 1건만 반영, plan 문서는 건드리지 않았다")과 정합.

## 주석 정정 내용 검증

`plan-frontmatter.test.ts` 헤더 주석이 이제 다음을 명시한다:

> `collectLivePlanMarkdown` 의 단일 구현은 `plan-scan.ts` 다. `spec-links.ts` 도 같은 이름을
> export 하지만 그건 **하위호환 re-export** 다.

코드로 직접 확인(절대경로):

- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:83` — `collectLivePlanMarkdown` 실제
  정의.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:17,304` — `plan-scan.ts` 에서 import
  후 `export { collectLivePlanMarkdown }` 로 재수출(re-export)만 함.

주석 서술이 실제 코드 구조와 정확히 일치한다. 그리고 이 주석은 `spec/conventions/spec-impl-evidence.md
§4.2` 의 `plan-frontmatter.test.ts` 행 각주("판정 로직은 `plan-scan.ts`(수집·status)와
`spec-links.ts`(링크) 소관이고 이 파일은 호출부")와도 어긋나지 않는다 — 오히려 그 각주가
이미 반영하고 있던 사실을 코드 주석 쪽에서 뒤늦게 맞춘 것이다(커밋 메시지 자체가 "같은 PR
이 spec-impl-evidence §4.2 를 갱신했는데 주석이 안 맞았다"고 밝힘).

## 관련 plan 과의 교차 확인

- `plan/in-progress/docs-guard-walker-dedup.md` — walker 3벌(`walkPlanMarkdown`/
  `collectSpecMarkdown`/`collectCodebaseSources`) 통합 판정을 다루는 plan. `spec-links.ts`/
  `plan-scan.ts` 파일명을 명시적으로 언급하지만, 대상은 `collectSpecMarkdown`/
  `collectCodebaseSources`(둘 다 `spec-links.ts` 고유 구현)이지 이번에 주석만 바뀐
  `collectLivePlanMarkdown` 재수출 관계가 아니다. 이번 주석 정정으로 이 plan 의 서술이
  무효화되거나 새 후속 항목이 생기지 않는다.
- `plan/in-progress/harness-env-value-subpattern-dedup.md` — `spec-links.ts`/`plan-scan.ts`
  를 이름으로 언급하지 않음(grep 0건). 충돌 없음.
- `plan/in-progress/harness-review-gate-followups.md` — `--impl-done` 세션 준비 시점과
  spec-linked 편집 시점의 순서 함정을 기록한 후속 절이 있으나(2026-08-10 실측), 이번
  세션(`02_18_34`)은 그 함정이 지적한 순서(세션 준비 → 이후 spec-linked 편집)에 해당하지
  않는다 — 이번 두 커밋 중 `spec/conventions/**` 변경은 전혀 없다. target 과 무관.
- `.claude/docs/plan-lifecycle.md` — `spec-links.ts`/`plan-scan.ts`/
  `collectLivePlanMarkdown`/재수출 관계를 언급하지 않음(grep 0건). 이번 주석 정정이 갱신을
  요구할 서술이 없다.
- `plan/in-progress/**` 전체에서 이번 두 커밋과 충돌할 만한 "결정 필요" 미해결 항목을 재탐색
  (`spec-links.ts`/`plan-scan.ts`/`collectLivePlanMarkdown`/`정본` 키워드) — 위 두 plan
  외 매칭되는 파일들(`webchat-usewidget-extraction.md`,
  `spec-data-flow-structural-followups.md`, `auth-guard-reflection-hardening.md`,
  `eia-context-schema-followups.md`, `spec-update-webchat-evidence-pointers.md`,
  `deps-guard-hardening.md`, `spec-fix-swagger-forbidden-response.md`,
  `retry-turn-terminal-guard.md`)는 전부 `정본`(SoT) 이라는 일반 어휘만 매칭되고 이번 변경
  도메인(문서 가드 walker)과 무관함을 확인.

## 이전 라운드 INFO 재확인 (사용자 요청)

3차(`01_53_28`)가 남긴 INFO — `.claude/tests/test_review_changeset_warning.py:10` 가
`plan/in-progress/harness-review-gate-ci-backstop.md` 를 가리키나 실제로는
`plan/complete/harness-review-gate-ci-backstop.md` 로 이동했다는 지적 — 은 이번 라운드에서
**사용자가 직접 재실측**했고, 다음을 확인했다고 보고했다:

- 3차 라운드의 스캔 범위가 `codebase/**/*.ts` 로 좁게 잡혔던 것(그래서 "코드 주석이 부르는
  plan 12종 중 stale 1건뿐"이라 서술)과 달리, `.claude/tests/test_review_changeset_warning.py`
  (`.py`, harness 도메인)까지 넓히면 stale 참조가 실제로 존재한다.
- 이 stale 참조 자체는 **이번 PR(`plan-lifecycle-gates`) 이전부터** 있던 것이며, 이번 PR
  의 diff 에 포함되지 않는다 — `git log` 상으로도 `test_review_changeset_warning.py` 는
  이번 브랜치의 두 최신 커밋(그리고 직전 라운드까지의 diff)에 등장하지 않는다.
- 사용자는 이번 PR 에서 고치지 않고 SUMMARY 에 정정 사실과 함께 기록하기로 했다고 밝혔다.

3차 라운드가 이미 이 항목을 "plan-coherence-checker 소관 밖(§4.2 각주 — 마크다운 링크가
아닌 평문 코드 경로 언급은 `spec-link-integrity.test.ts` 검증 대상도 아니고 본 checker 의
문서화된 스코프도 아님) + 게이트를 막을 사유 아님" 으로 INFO 처리했고, 이번 라운드에서
그 판정을 바꿀 새 근거는 없다(범위 재확인 결과가 3차의 분석과 정확히 일치 — "범위를 넓히면
발견되지만 PR 무관·checker 소관 밖"). 재조정할 것 없음.

## 새 발견 없음

이번 라운드에서 반영된 변경(주석 1건 + 무관한 RESOLUTION 1줄)을 대상으로 위 세 관점
(미해결 결정과의 충돌 / 선행 plan 미해소 / 후속 항목 누락)을 전부 재확인했으나, 새로운
CRITICAL/WARNING/INFO 는 없다.

## 발견사항

없음.

## 요약

직전 라운드(`01_53_28`) 이후 실제로 반영된 것은 `plan-frontmatter.test.ts` 헤더 주석 1건
(`collectLivePlanMarkdown` 의 정본이 `plan-scan.ts` 이고 `spec-links.ts` 는 하위호환
re-export 라는 정정)과 무관한 리뷰 산출물 1줄뿐이며, plan 문서는 이번 라운드에서 전혀
수정되지 않았다. 주석 정정 내용을 코드(`plan-scan.ts:83`, `spec-links.ts:17,304`)로
직접 대조한 결과 서술이 정확하고, `spec-impl-evidence.md §4.2` 의 기존 각주와도 일치한다.
`docs-guard-walker-dedup.md`·`harness-env-value-subpattern-dedup.md`·
`harness-review-gate-followups.md`·`plan-lifecycle.md` 를 포함해 이 도메인과 겹치는
plan/문서를 교차 확인했으나 이번 변경으로 무효화되거나 새로 필요해진 후속 항목은 없다.
사용자가 재확인을 요청한 이전 라운드 INFO(`test_review_changeset_warning.py:10` 의 stale
plan 포인터)는 사용자의 실측이 3차 라운드의 분석("범위를 넓히면 발견되나 이번 PR 무관·
checker 소관 밖")과 정확히 일치함을 재확인했을 뿐이라 판정을 바꿀 근거가 없다. 이번
라운드는 종결 라운드로 판정할 수 있다.

## 위험도

NONE

STATUS=success
