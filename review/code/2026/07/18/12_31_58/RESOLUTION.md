# RESOLUTION — interaction-type-guard 후속 ②③ (review/code/2026/07/18/12_31_58)

/ ai-review: RISK LOW, Critical 0, Warning 1. impl-done(`review/consistency/2026/07/18/12_34_30`): BLOCK: NO.

## 조치 항목

| 출처 # | 카테고리 | 조치 | 비고 |
|---|---|---|---|
| ai-review WARNING #1 = impl-done WARNING #3 | 문서화 | plan bookkeeping 정확화 — ④ harness 항목을 실제 분기처 [`harness-guard-followups.md`](../../../../plan/in-progress/harness-guard-followups.md) **§H** 로 구체화(경로 링크) + "충족한다" 서술을 "§H 로 분기 완료 → 종결 조건 충족"으로 정확화. §H 신설(consistency-bundler target 100% 치환 결함 + reverse-diff diff-base 부수). | **코드 무변경 — plan/ 문서만.** 두 게이트가 공통 지적한 동일 사안을 동시 해소. 본 리뷰 반영 커밋에 포함 |
| ai-review INFO #1 | 테스트 | 보류(비차단) — `.tsx`/`ScriptKind` 동일수집 결론이 plan 프로브 근거뿐. 근거는 plan ③ 노트에 committed. 향후 실제 `.tsx` 등록 사이트 발생 시 정식 회귀 테스트로 승격. | 코드 재순환(전 사이트 `.ts`, 즉각 리스크 0) 대비 실익 낮아 defer |
| ai-review INFO #2 | 테스트 | 보류(비차단) — 보간 템플릿 리터럴(`${…}`) 미탐지. 현행 등록 사이트 미사용이라 즉각 리스크 없음. | 동적 표현이라 애초 수집 대상 아님(정상). 필요 시 docstring 한 줄로 명시 가능 |
| ai-review INFO #3~7 | 다양 | 조치 불요 — pre-existing(`readRepoFile` 상대경로·중복 describe·frontmatter `code:` 미등재) / 정상 산출물(review 파일 커밋) / 이미 §H 로 추적(번들러 결함). | |
| impl-done WARNING #2 | (harness) | 보류 — `origin/main`(#978, `d25f552b2`)이 fork-point(`22cc48ef3`) 이후 전진해 reverse-diff 오염. 이 브랜치는 #978 파일 무접촉이라 텍스트 충돌 없음. PR 병합이 흡수. diff-base 기본값 개선은 §H 부수 항목. | 비차단 |
| impl-done WARNING #1 | (harness) | 조치 불요(신규) — 번들러 target 치환, §H 로 분기 완료. | |

## TEST 결과

리뷰 반영은 **plan/ 문서 편집만(코드 무변경)** 이므로, 마지막 코드 커밋 `465abf334` 의 TEST WORKFLOW 결과가 그대로 유효(그 이후 `codebase/` 변경 0):

- lint: 통과 (67s)
- unit: 통과 (124s, 14 파일)
- build: 통과 (116s)
- e2e: 통과 (270s, 256 tests) — `*.test.ts` 변경이 e2e 면제 화이트리스트 밖(회색지대)이라 수행

## 보류·후속 항목

- **ai-review INFO #1·#2** (self-test `.tsx`/템플릿 한계 명시): 비차단. 향후 `.tsx` 등록 사이트 추가 PR 에서 정식 회귀 테스트 승격 권장. 결정 근거는 plan `interaction-type-guard-comment-false-negative.md` ③ 노트에 committed.
- **④ harness 번들러 결함**: [`harness-guard-followups.md`](../../../../plan/in-progress/harness-guard-followups.md) **§H** 로 durable 분기(consistency_orchestrator.py 예산 로직 + reverse-diff diff-base).
