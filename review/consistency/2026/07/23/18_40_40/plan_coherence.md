### 발견사항

- **[INFO]** target 은 실제로 spec/4-nodes/6-presentation 을 변경하지 않음 — "target 문서"가 diff 아님
  - target 위치: `spec/4-nodes/6-presentation/{0-common,1-carousel,2-table}.md` 전문
  - 관련 plan: (해당 없음 — 실제 diff 확인 결과)
  - 상세: `git diff origin/main HEAD -- spec/4-nodes/6-presentation` 는 **0줄**이다. 이번 작업의 실제 diff 는 `codebase/frontend/src/components/editor/run-results/output-shape.ts`(JSDoc 한국어화, non-comment diff 0줄) + 테스트 fixture 추가뿐이며, `plan/complete/output-shape-comment-followups.md`(frontmatter `spec_impact: none`, 체크리스트 전항 `[x]`, 3회 리뷰 Critical 0/Warning 0 수렴, TEST WORKFLOW 4단계 PASS)로 이미 완료·`plan/complete/`로 이관돼 있다. `output-shape.ts` 가 `0-common.md` frontmatter `code: codebase/frontend/src/components/editor/run-results/**` 글롭에 걸려 orchestrator 가 presentation spec 영역 전문을 target 으로 삼았을 뿐, 실제로는 이 영역에 어떤 결정도 새로 내려진 바 없다. 따라서 "미해결 결정과의 충돌 / 선행 plan 미해소 / 후속 항목 누락" 세 관점 모두 적용할 실질 diff 가 없다.
  - 제안: 없음 (정보 제공). orchestrator 의 `--impl-done` scope 산정이 spec-linked glob 매치만으로 영역 전체를 target 으로 넣는 경향이 있다는 점은 기록해 둘 가치가 있다 — 실제 코드 diff 가 그 영역의 어떤 결정도 건드리지 않았다면 plan_coherence 관점에서는 조기 종결 대상이다.

- **[INFO]** 동일 target 영역의 선행 drift-fix plan 은 이미 해소·merge 됐으나 `plan/in-progress/`에 잔존
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` §4.2 `previousOutput` 단락(및 `3-chart.md`/`4-form.md`)
  - 관련 plan: `plan/in-progress/presentation-previousoutput-spec-drift.md` (전 checklist `[x]`)
  - 상세: 이 plan 은 오늘(2026-07-23) 이전 `/consistency-check --impl-done spec/4-nodes/6-presentation` 실행(15:33)에서 나온 CRITICAL(선재 drift — diff 무관)을 project-planner 가 처분한 결과물이다. 수정 내용은 PR #997(commit `3d0bcd69b`, "docs(spec): presentation previousOutput 폐기 서술 정정")로 이미 origin/main 에 merge 됐고, 현재 target 문서에 그대로 반영돼 있다(실측: `0-common.md` §4.2 "폐기 예정이지만 아직 제거되지 않았다" 단락이 이 plan 의 "제안 문구"와 일치, Form 제외 각주 포함). 즉 **충돌 없음** — 다만 plan 파일 자체가 `plan/complete/` 로 이관되지 않은 채 남아 있다. 같은 세션의 자매 plan(`output-shape-comment-followups.md`)은 정상적으로 `plan/complete/` 로 이관된 것과 대비된다. 체크리스트 마지막 항목의 "2차 게이트 리뷰 예정" 문구가 이관을 보류시킨 원인일 수 있으나, 코드는 이미 origin/main 에 merge 완료된 상태다.
  - 제안: `plan/in-progress/presentation-previousoutput-spec-drift.md` 를 `plan/complete/` 로 이관(라이프사이클 정리). 정합성 자체는 문제 없음.

- **[INFO]** `output-shape.ts` 리팩터 보류(NO-GO) 결정이 in-progress plan 과 충돌하지 않음을 교차 확인
  - target 위치: `output-shape.ts` `isConversationOutput` JSDoc — "OR-체인 → discriminated union 재설계는 진행하지 않는다"
  - 관련 plan: `plan/complete/output-shape-comment-followups.md` §1 (NO-GO 판정 근거)
  - 상세: `plan/in-progress/**` 전체(29개 파일 + `node-output-redesign/` 서브폴더 27개)를 `isConversationOutput`/`discriminated union`/`OR-체인` 키워드로 grep 한 결과 0건 — 이 리팩터를 요구하거나 전제하는 진행 중 plan 이 없음을 확인했다. developer 의 NO-GO 판정(§근거: frontend `lib/api/` 에 런타임 검증 0건, `interactionType` 이 이미 unsound 판별자로 확정된 상태 — swagger.md §1-4/PR #904)과 충돌하는 미해결 결정은 없다.
  - 제안: 없음 (검증 완료).

### 요약

이번 target(spec/4-nodes/6-presentation 전문)은 orchestrator 가 spec-linked 코드 glob(`0-common.md` frontmatter 의 `codebase/frontend/src/components/editor/run-results/**`) 매치로 영역 전체를 끌어온 것일 뿐, `git diff origin/main HEAD`로 실측한 결과 이번 작업은 spec 파일을 전혀 건드리지 않았다. 실제 변경은 `output-shape.ts`의 JSDoc 한국어화 + 테스트 fixture 추가(non-comment diff 0줄, `spec_impact: none`)뿐이며 이미 3라운드 리뷰로 수렴해 `plan/complete/`로 이관됐다. `plan/in-progress/**`(주어진 5개 번들 외 24개 파일 + `node-output-redesign/` 27개를 포함해 전수 확인)에서 이 diff 와 충돌하는 미해결 결정, 이 diff 가 전제하는 미해소 선행 plan, 이 diff 로 무효화되는 다른 plan 의 후속 항목은 발견되지 않았다. 유일한 지적은 정합성이 아니라 라이프사이클 위생(hygiene) — 이미 merge 된 `presentation-previousoutput-spec-drift.md` plan 이 `plan/complete/`로 이관되지 않은 채 남아 있다는 점.

### 위험도
NONE
