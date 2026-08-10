# Plan 정합성 검토 — 5차 라운드(종결 확인)

## 검토 범위

- target: `spec/conventions/` (diff-base `origin/main`, impl-done)
- 워크트리: `/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`
  (`git status` — untracked 는 이번 라운드 자신의 `review/code/2026/08/10/02_33_44/`,
  `review/consistency/2026/08/10/02_33_44/` 뿐, 그 외 clean)
- 직전 라운드(`02_18_34`)는 **NONE(종결 라운드)** 이었다.

## 직전 라운드 이후 실제 반영분 실측

`git log --since="2026-08-10 02:18:34" --format="%h %ad %s" --date=format:"%H:%M:%S"` 로 확인한
커밋 3건:

| 커밋 | 시각 | 내용 |
|---|---|---|
| `3b037bc26` | 02:18:34 | `docs(review): 02_06_01 RESOLUTION e2e 줄 확정` — 직전 라운드의 경계 커밋(4차 시작 시점), `review/code/2026/08/10/02_06_01/RESOLUTION.md` 1줄만. plan/spec/codebase 무관 |
| `6101a04b2` | 02:28:51 | `fix(harness): non-vacuity 캐너리가 discovery 만 증명하던 것을 추출 단계로 강화 (ai-review W1)` |
| `c703039ba` | 02:33:43 | `docs(review): 02_18_34 RESOLUTION e2e 줄 확정` — `review/code/2026/08/10/02_18_34/RESOLUTION.md` 2줄만 |

`6101a04b2` 의 `--stat` 을 확인하면 코드 변경은
`codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 1개 파일뿐이고, 나머지는
`review/code/2026/08/10/02_18_34/**` · `review/consistency/2026/08/10/02_18_34/**` (4차 라운드
자신의 리뷰 산출물 커밋 — 코드 아님).

**plan/spec 무변경 실측**: `git diff 3b037bc26..HEAD -- 'plan/**' 'spec/**'` 결과가 **빈 diff**
다(파일 0개). 즉 4차 라운드 이후 `plan/**`·`spec/**` 아래 문서는 단 한 줄도 바뀌지 않았다 —
사용자 서술("반영한 것은 테스트 캐너리 강화 1건뿐이고 plan 문서는 무변경") 과 정확히 일치.

## `6101a04b2` 변경 내용 검증 (plan 도메인 영향 여부)

`git show 6101a04b2 -- codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 로
diff 를 직접 확인:

- 두 테스트를 손봤다 — (1) "the plan link scanner actually sees links (non-vacuity)": 종전엔
  `collectLivePlanMarkdown(root).length` (파일 수, discovery) 만 세어 `extractLinks` 가 항상
  `[]` 를 반환해도 통과하는 vacuous 캐너리였다. 이제 `extractLinks(f.absPath)` 로 실제 추출된
  링크 수를 합산해 세는 것으로 바뀌었다. (2) "finds completed plans to validate" → 이름에
  `(discovery only)` 를 명시하고, 실제 위반 탐지 증명은 `plan-scan.test.ts` 의 합성 fixture
  (위반 3건 심어 정확히 그 3건만 잡히는지)로 옮겼다는 주석을 추가.
- 순수 **테스트 파일 내부의 단언 강화**이며, 가드가 검증하는 **정책(스키마·라이프사이클·경로
  판정 규칙)** 자체는 전혀 바뀌지 않았다. `spec/conventions/spec-impl-evidence.md` §4.2 의
  `plan-frontmatter.test.ts` 행 서술("셋을 본다 — (1)…(2)…(3)…")과 대조해도 이 캐너리 강화는
  그 표가 서술하는 검증 대상·판정 로직 소재(§4.2 각주 — "판정 로직은 `plan-scan.ts`/
  `spec-links.ts` 소관, 이 파일은 호출부")를 바꾸지 않는다 — 여전히 `plan-frontmatter.test.ts`
  는 호출부이고, `extractLinks`/`collectLivePlanMarkdown` 은 각각 `spec-links.ts`/
  `plan-scan.ts` 원래 구현을 그대로 가져다 쓸 뿐이다.
- `plan/in-progress/**` 전체와 `spec/conventions/spec-impl-evidence.md`,
  `.claude/docs/plan-lifecycle.md` 에서 이 커밋이 건드린 세부 문구("non-vacuity",
  "actually sees links", `collectLivePlanMarkdown(root).length`, `extractLinks`)를 재검색했으나
  일치 0건 — 어떤 plan/spec 문서도 이 캐너리의 내부 단언 방식을 서술하고 있지 않으므로, 이번
  변경으로 stale 해지는 plan 서술이 없다.

## 관련 plan 재확인 (4차 라운드 대상 그대로 유지)

`plan/**` 가 4차 라운드 이후 바이트 단위로 무변경임을 위에서 실측했으므로, 4차 라운드가 이미
교차 확인한 세 문서(`docs-guard-walker-dedup.md` / `harness-env-value-subpattern-dedup.md` /
`harness-review-gate-followups.md`)의 분석 결과도 그대로 유효하다:

- `plan/in-progress/docs-guard-walker-dedup.md` — walker 3벌 통합 판정 plan. 대상은
  `collectSpecMarkdown`/`collectCodebaseSources`(`spec-links.ts` 고유 구현)이지, 이번
  라운드에서 강화된 `collectLivePlanMarkdown`/`extractLinks` 캐너리 단언과는 다른 축이다.
  이 plan 이 무효화되거나 새 후속 항목이 필요해지지 않는다.
- `plan/in-progress/harness-env-value-subpattern-dedup.md` — grep 0건, 무관.
- `plan/in-progress/harness-review-gate-followups.md` — `--impl-done` 세션 준비 시점과
  spec-linked 편집 시점의 순서 함정을 기록한 절이 있으나, 이번 라운드에서 `spec/conventions/**`
  변경 자체가 0건이므로(위 diff 확인) 그 함정이 지적하는 순서에 해당하지 않는다.

## 이전 라운드 INFO (참고, 재조정 대상 아님)

3차(`01_53_28`)가 남기고 4차가 재확인한 `test_review_changeset_warning.py:10` 의 stale plan
포인터(`harness-review-gate-ci-backstop.md` in-progress→complete 이동 미반영)는 이번 PR 의 diff
에 없는 pre-existing 항목이라는 판정이 유지된다 — 이번 라운드에 새로 반영된 변경(`plan-frontmatter.test.ts`
캐너리 강화)도 이 파일을 건드리지 않았다(diff 대상 파일에 `test_review_changeset_warning.py` 없음).
재조정할 근거 없음.

## 새 발견 없음

이번 라운드에서 실제로 반영된 유일한 변경(`plan-frontmatter.test.ts` 캐너리 강화, plan/spec
문서 무변경)을 대상으로 세 관점(미해결 결정과의 충돌 / 선행 plan 미해소 / 후속 항목 누락)을
전부 재확인했으나 새로운 CRITICAL/WARNING/INFO 는 없다.

## 발견사항

없음.

## 요약

직전 라운드(`02_18_34`, NONE) 이후 `git diff 3b037bc26..HEAD -- 'plan/**' 'spec/**'` 가 빈
diff 임을 실측해 plan/spec 문서 무변경을 확인했다. 실제로 반영된 코드 변경은 `6101a04b2`
(`plan-frontmatter.test.ts` 의 non-vacuity 캐너리 강화) 1건뿐이며, 검증 대상 정책이나 판정
로직 소재는 바뀌지 않고 테스트 내부 단언 방식만 discovery-count 에서 extraction-count 로
올라갔다. 이 변경 문구를 `plan/in-progress/**`·`spec/conventions/spec-impl-evidence.md`·
`.claude/docs/plan-lifecycle.md` 전체에서 재검색했으나 일치하는 서술이 없어 stale 해지는
plan 문서가 없고, 4차 라운드가 교차 확인한 관련 plan 3건(`docs-guard-walker-dedup.md`,
`harness-env-value-subpattern-dedup.md`, `harness-review-gate-followups.md`)의 결론도 plan
무변경 실측으로 그대로 유효하다. 새 CRITICAL/WARNING/INFO 없음 — 이번 라운드도 종결 라운드로
판정한다.

## 위험도

NONE

STATUS=success
