# Plan 정합성 검토 — resume-hydration-wontdo (task_6da430a3)

대상: `spec/5-system/4-execution-engine.md:1386` 신설 문단 ("기각된 대안 — 재개 식별 필드
hydration 전용 헬퍼", 못-do 기록). base `origin/main` = `bfa558f59` (이후 `1682777fe` 까지
fetch 됨, 무관 커밋).

## 발견사항

### [Warning] `PR #907(B4)` 인용은 정확, `PR #907 B1` 인용은 오귀속 — 실제로는 PR #900(B1)

- target 위치: `spec/5-system/4-execution-engine.md:1386`, 문장 "…소비측은 `LlmCallContext`
  명시 타입이 대칭 보강한다(**PR #907 B1**)."
- 관련 plan:
  - `plan/in-progress/resume-llm-usage-attribution.md` (섹션 "최종 /ai-review(02_09_15) INFO")
    — `INFO#1`(`LlmCallContext` 명시 타입 주석)을 "후속 plan `ai-usage-attribution-hardening.md`
    B1 로 처리(**PR-1**)"로 명시.
  - `plan/complete/ai-usage-attribution-hardening.md` — B1 항목이 이 plan 소속이며, 실제
    머지 커밋은 `0c6e53b81`(`fix(ai): … (#879 follow-up B1+C1) (#900)`), 즉 **PR #900**.
  - `plan/complete/llm-usage-resume-followups.md` — B2/B3/**B4**(`narrowResumeState` 타입
    접근 교체)만 다룸. B1 은 이 plan 의 스코프에 없음(머지 커밋 `bfa558f59` = **PR #907**).
- 상세: 신설 문단이 "오탈자-안전 목적은 이미 달성됐다"는 근거로 두 개의 서로 다른 완료 PR
  (B4=PR #907, B1=PR #900)을 인용하는데, 괄호 표기가 `(PR #907 B1)`로 되어 있어 **B1 도
  PR #907 소속인 것처럼 오귀속**한다. 실제로 B1(`LlmCallContext` 명시 타입 주석, 소비측)은
  `ai-usage-attribution-hardening` plan → **PR #900**에서 완료됐고, B4(`narrowResumeState`,
  소스측)만 `llm-usage-resume-followups` plan → PR #907 소속이다.
- 제안: target 문장을 `(PR #900, B1)` 또는 `(PR #900 — ai-usage-attribution-hardening B1)`로
  정정. B4 인용(`PR #907(B4)`)은 그대로 유지 가능(정확함).

### [Warning] `plan/in-progress/resume-llm-usage-attribution.md` 가 stale — 핵심 PR 은 이미 머지(#879)됐고 잔여 INFO 항목(B2/B3)도 별도 plan 으로 완료됐는데 체크박스·plan 위치가 갱신되지 않음

- target 위치: 해당 없음(target 문서는 이 staleness 를 유발하지 않음 — 사전 존재 상태 확인).
- 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md`
  - "워크플로 체크리스트" 섹션 마지막 항목 `- [ ] PR (push + gh pr create)` 미체크. 그러나 본문
    "변경 세트"가 기술하는 core 변경(IE handler/`ai-turn-executor.ts` resume 소비 사이트 교정)은
    커밋 로그상 이미 `79669505c`(`fix(ai): resume 턴 llm_usage_log attribution 소비 사이트 교정
    (IE 오적재 + ai_agent 메인 chat) (#879)`)로 병합 완료.
  - "최종 /ai-review(02_09_15) INFO" 섹션의 두 미체크 항목:
    - `Text Classifier … → PR-3(B2) 예정.` — `plan/complete/llm-usage-resume-followups.md`
      B2 로 완료(PR #907).
    - `IE … collection-retry … (INFO#4) → PR-3(B3) 예정.` — 동일 plan B3 로 완료(PR #907).
- 상세: 병렬 세션이 `llm-usage-resume-followups.md`(B2/B3/B4)를 별도 plan 으로 신설·완료·
  `plan/complete/`로 이동했지만, 그 후속 항목의 근원인 `resume-llm-usage-attribution.md` 자체의
  체크박스는 갱신하지 않고 plan/in-progress/ 에 그대로 남겨뒀다. plan 은 본질적으로 이미 완료된
  작업(PR #879 머지 + 잔여 INFO 전량 후속 plan 으로 해소)인데 in-progress 로 남아 lifecycle 이
  불일치한다.
- 제안: `resume-llm-usage-attribution.md` 의 미체크 3항목(PR 체크박스 1 + INFO 2건)을 체크하고
  각각 완료 PR(#879, #907)을 인라인 각주로 남긴 뒤 `plan/complete/`로 이동. 이는 이번 세션의
  본 못-do 기록과 직접 충돌하지는 않으나(§Rationale 신설은 독립적으로 안전), 병렬 세션이 남긴
  plan lifecycle 잔여 정리 항목으로 별도 커밋(project-planner 또는 developer)에서 처리 필요.

### 위 두 건 외 — task_6da430a3 / 결정 충돌 확인 결과

- `task_6da430a3`(hydration 헬퍼) 또는 `ResumeIdentificationFields`/`pickResumeIdentificationFields`
  를 pending 항목으로 추적하는 `plan/in-progress/**` 파일은 **없음**(전체 grep 0건, 신설 문단
  자체 제외). 따라서 이 못-do 기록이 닫아야 할 plan 체크박스는 존재하지 않는다.
- `plan/in-progress/execution-engine-residual-gaps.md`(G1/G2), `plan/in-progress/eia-context-schema-followups.md`
  등 execution-engine 관련 다른 in-progress plan 을 확인했으나 재개 식별 필드 hydration 방식과
  무관(G1=WS `execution.start` gate 철회, G2=`errorPolicy=continue` defer) — 충돌 없음.
- `resume-llm-usage-attribution.md` 의 유일한 미해결 항목(PR 체크박스)은 이미 실질적으로 완료된
  선행 작업(#879)의 문서 갱신 누락일 뿐, 이번 못-do 문단이 가정하는 사전 조건(#877/#879/#907 이
  이미 attribution 코드를 안정화)과 **모순되지 않는다** — 오히려 그 완료 사실을 재확인해준다.

## 요약

이번 세션이 추가한 단일 Rationale 문단(§1386)은 어떤 in-progress plan 의 미해결 결정도 우회하지
않으며, `task_6da430a3` 를 추적하는 plan 도 존재하지 않아 닫아야 할 체크박스도 없다. 다만 문단 내
PR 인용 하나가 실제 이력과 다르다(B1 은 PR #900 소속인데 PR #907 로 오귀속) — 정정 권장. 별개로,
병렬 세션이 완결한 `resume-llm-usage-attribution.md`(core PR #879 + 후속 B2/B3 via PR #907)의
plan 파일 자체가 체크박스 미갱신·in-progress 잔류 상태로 남아있어 plan lifecycle 정리가 필요하다
— 이는 이번 못-do 기록의 안전성에는 영향을 주지 않는 별도 후속 정리 항목이다.

## 위험도

LOW

STATUS: DONE
