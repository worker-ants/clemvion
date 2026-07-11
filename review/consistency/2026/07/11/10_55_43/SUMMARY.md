# Consistency Check SUMMARY — `--spec` (task_6da430a3 won't-do + plan 종결)

- **일시**: 2026-07-11 10:55:43
- **모드**: `--spec` (project-planner spec 쓰기 직전 의무)
- **base**: `origin/main` @ `bfa558f59`
- **checker**: 3종 focused fan-out (rationale-continuity · cross-spec · plan-coherence) — 변경이 단일 Rationale 문단이라 naming/convention 은 near-vacuous 로 제외

## BLOCK: NO

Critical 0건. Warning 2건 — **둘 다 fix**(rationale provenance 정확성).

| checker | Critical | Warning | Info |
| --- | --- | --- | --- |
| rationale-continuity | 0 | 2 | 0 |
| cross-spec | 0 | 0 | 0 |
| plan-coherence | 0 | 1 | 0 |

(rationale W1 = plan-coherence W1 동일 근본 — PR 오귀속)

## 변경 내용

1. `spec/5-system/4-execution-engine.md` §Rationale "resume/retry 턴 usage-log attribution" 에 **won't-do 기록**
   신설 — 재개 식별 필드 hydration 전용 헬퍼(`ResumeIdentificationFields` + `pickResumeIdentificationFields`,
   task_6da430a3)를 채택하지 않는 결정과 근거.
2. `plan/in-progress/resume-llm-usage-attribution.md` → `plan/complete/` 이동 (잔여 3항목이 머지된
   #879/#906/#907 로 전량 소진, plan-coherence W2 반영).

## checker 가 독립 검증한 정합

- **shape 서술 정확**: 3 재개-hydration 사이트(main chat 3필드 `:2618`, provider-tool 배치 5필드+`?? ''`+
  workspaceId `:2709`, IE 조건부 `:891`) 코드 일치 (rationale·cross-spec 양측).
- **심볼 실재**: `resumeStateSchema`/`ResumeState`/`CREDENTIAL_CONTEXT_FIELDS`/`narrowResumeState` 실재,
  won't-do 헬퍼 심볼은 코드에 부재(grep 0) — 순수 결정-기록 (cross-spec).
- **`7-llm-usage.md §1.3` 및 타 spec 과 충돌 없음**·신규 요구사항/엔티티/API 0 (cross-spec).
- **결정 번복/재도입 없음**: 원칙 5·#501 불변식·"적용 범위" 문단과 정합 (rationale).

## Warning 처리 (둘 다 fix)

### W1 (rationale + plan-coherence) — PR 오귀속: B1 은 #907 이 아니라 #900
초안이 소비측 `LlmCallContext` 명시 타입 주석을 "(PR #907 B1)" 로 인용했으나, B1 은 실제로 **PR #900**
(`0c6e53b81`, `ai-usage-attribution-hardening`)이 완료했다. #907 은 B2/B3/B4 만.
→ **fix**: "(PR #900, B1)" 로 정정. `narrowResumeState`=#907(B4)는 정확하므로 유지.
검증: `git show 0c6e53b81` 이 "B1: ai-turn-executor.ts resume llmContext 에 LlmCallContext 명시 타입 주석" 확인.

### W2 (rationale) — "resumeStateSchema/CREDENTIAL_CONTEXT_FIELDS 단일 진실" 은 `ai_agent` 한정
`information_extractor` 는 `resumeStateSchema` 를 참조하지 않고(grep 0) 자체 손수 유지 `MultiTurnState`
interface(#879, `information-extractor.handler.ts:95`)로 재개 state 를 타입 강제한다. `narrowResumeState` 도
ai-turn-executor 전용.
→ **fix**: 두 노드의 타이핑 구조가 **다르다**는 사실을 명문화(ai_agent=`resumeStateSchema`/`narrowResumeState`,
IE=`MultiTurnState`). 이는 오히려 **won't-do 를 강화**한다 — 이질 구조 위에 공용 hydration 헬퍼를 얹으면
표면이 늘 뿐이다. 근거 (2) 로 편입.

## plan-coherence 추가 (W2) — 반영

`plan/in-progress/resume-llm-usage-attribution.md` staleness(잔여 3항목이 #879/#906/#907 로 완료됐는데
in-progress 잔류) → 본 PR 에서 3박스 체크 + `plan/complete/` 이동으로 해소. `spec_impact` YAML 리스트로 선언
(Gate C). task_6da430a3 를 pending 으로 추적하는 plan 은 부재 확인.

## 재검증

frontend Gate C 가드(plan-frontmatter·spec-plan-completion·spec-pending-plan-existence) 3 suites / 732 tests 통과.
old in-progress 경로 dangling 참조 0(grep). 코드 변경 0 (spec/plan 문서만).

## 결론

BLOCK: NO. Warning 2건 fix 완료.
