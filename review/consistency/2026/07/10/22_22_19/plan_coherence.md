# Plan 정합성 검토 — `spec/data-flow/7-llm-usage.md` (--impl-done)

## 조사 메모

`git diff origin/main...HEAD --stat` 로 diff 범위를 재확인: backend 4파일(`ai-agent.memory.spec.ts` /
`ai-memory-manager.{ts,spec.ts}` / `ai-turn-executor.ts` / `agent-memory-injection.{ts,spec.ts}`) +
`CHANGELOG.md` + `plan/in-progress/ai-usage-attribution-hardening.md`(신규) +
`plan/in-progress/resume-llm-usage-attribution.md`(수정). `spec/data-flow/7-llm-usage.md` 자체는
이번 diff 에 없음 — payload 의 "구현 대상 spec 영역: (없음)" 과 일치.

target 관련 plan 은 `plan/in-progress/ai-usage-attribution-hardening.md`(본 브랜치 작업 plan) 과
그 선행 plan `plan/in-progress/resume-llm-usage-attribution.md`(PR #879, `spec: spec/data-flow/7-llm-usage.md §1.3`)
두 건. 두 문서 모두 절대경로로 직접 Read 해 대조했다.

## 이전 회차 발견사항 재검증 (09:02·09:21 plan_coherence 대비)

같은 target 에 대한 직전 두 회차(`review/consistency/2026/07/10/09_02_47/plan_coherence.md`,
`review/consistency/2026/07/10/09_21_27/plan_coherence.md`)가 낸 WARNING 이 이번 diff 에서
실제로 해소됐는지 코드/문서 대조로 확인했다.

1. **(09_02_47 WARNING #1) INFO#1 완료 상태가 `resume-llm-usage-attribution.md` 에 미반영** —
   해소 확인. `git diff origin/main...HEAD -- plan/in-progress/resume-llm-usage-attribution.md` 에서
   `- [ ] ai-turn-executor.ts:2599 ...` 가 `- [x] ... → 후속 plan ai-usage-attribution-hardening.md B1 로 처리(PR-1)` 로 갱신됨.
2. **(09_21_27 WARNING) SPEC-DRIFT 이관 대상("A1~A4")이 실제 목적지 plan 체크리스트에 5번째
   항목으로 없음** — 해소 확인. 같은 diff 에서 `resume-llm-usage-attribution.md` §"잔여 follow-up"
   에 신규 불릿이 추가됨: `- [ ] (PR ai-usage-attribution-hardening = B1+C1 배선 후 필수) spec/data-flow/7-llm-usage.md §1.3 표 L107 · 요약문 L113 · §4 Agent Memory 행 L162 · Rationale L189~206 ...` — 정확히 이 회차가 제안한 A5 항목이 명시 라인번호와 함께 들어갔다. `spec/data-flow/7-llm-usage.md` 를 절대경로로 Read 해 L107/L113/L162/L204-208 이 실제로 이 서술("전부 NULL / 미배선")을 담고 있음을 재확인 — 라인 참조가 정확하다.
3. **(09_02_47 INFO) C1 이 당시 resume 턴 한정 배선이라 "완전 해소"로 오기술될 위험** —
   해소 확인. 이번 diff 는 `ai-turn-executor.ts` 의 **single-turn**(`executeSingleTurn`, `context.*`)
   과 **multi-turn resume**(`processMultiTurnMessage`, `state.*`) 양쪽 모두에 `llmContext` 를 새로
   추가했다(당시엔 resume 만 있었음). `ai-usage-attribution-hardening.md` 의 SPEC-DRIFT 절도
   "첫 턴/resume 모두 `context.*`/`state.*` 채움"으로 정확히 서술 — 이제 다른 AI 노드 caller 행
   (L105/106)과 동일한 패턴이라는 주장이 코드로 뒷받침된다.

세 건 모두 이번 diff 로 실질 해소됐다. 남은 CRITICAL/WARNING 급 발견은 없다.

## 발견사항

- **[INFO] SPEC-DRIFT 절의 "A1~A4"/"61~70행" 라벨이 새로 추가된 5번째 항목을 반영하지 않음**
  - target 위치: (간접) `plan/in-progress/ai-usage-attribution-hardening.md` §"SPEC-DRIFT (PR-2 로 이관 — cross-ref)"
  - 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md` §"잔여 follow-up" — 이번 diff 로 61~70행 뒤에 신규 5번째 불릿이 추가됐다(위 재검증 #2)
  - 상세: `ai-usage-attribution-hardening.md` 의 SPEC-DRIFT 절 본문은 여전히 "PR-2 에서 A1~A4(… §"잔여 follow-up" **61~70행**)와 함께 반영"이라고만 적혀 있어, 실제로는 목적지 문서에 이미 존재하는 5번째 항목(§1.3 row 자체 정정)을 가리키지 않는 것처럼 읽힌다. 기능적으로는 목적지 plan 에 항목이 이미 명시돼 있어 추적 유실 위험은 낮지만(핵심 WARNING 은 이미 해소), `ai-usage-attribution-hardening.md` 만 먼저 읽는 향후 PR-2 담당자는 "A1~A4" 라는 옛 라벨 때문에 5번째 항목의 존재를 한 박자 늦게 알아챌 수 있다.
  - 제안: `ai-usage-attribution-hardening.md` SPEC-DRIFT 절의 "A1~A4(… 61~70행)" 를 "A1~A5(… 61~76행, A5=본 §1.3 row 정정 자체)" 로 갱신하거나, 최소한 "해당 목적지 plan 에 이미 A5 항목으로 추가됨"이라는 한 문장을 덧붙인다. 저비용 polish — 차단 사유 아님.

## 요약

이번 diff(B1 타입 주석 + C1 메모리 압축 attribution 배선)는 target `spec/data-flow/7-llm-usage.md` 를
건드리지 않지만, C1 이 실제로 §1.3 L107/L113/§4 L162/Rationale L204-208 이 "미배선"이라 서술하는
지점을 코드로 배선해 target 을 stale 하게 만든다. 이 spec-drift 는 developer 의 role 제약(`spec/`
read-only)상 project-planner PR(PR-2)로 이관하는 것이 정당한 처리이며, 직전 두 회차(09:02·09:21)가
지적한 "이관 대상이 목적지 plan 체크리스트에 실제로 연결돼 있지 않다"는 WARNING 두 건 모두 이번
diff 에서 `resume-llm-usage-attribution.md` §"잔여 follow-up" 에 정확한 라인번호(L107/L113/L162/L189~206)를
포함한 명시적 항목으로 추가되어 해소됐다. 아울러 C1 자체도 이전엔 resume 턴에만 배선돼 있던 것을
single-turn 까지 확장해, "완전 해소"라는 문구가 실제 코드와 부합하게 됐다. 미해결 사용자 결정을
우회하거나 선행 plan 을 무시하는 CRITICAL/WARNING 급 문제는 발견되지 않았다. 남은 것은 SPEC-DRIFT
절 자체의 라벨("A1~A4")이 새 5번째 항목을 아직 반영하지 않은 저비용 polish 뿐이다.

## 위험도

LOW
