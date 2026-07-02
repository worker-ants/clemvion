# Rationale 연속성 검토 — spec/4-nodes/3-ai/1-ai-agent.md (M-7 relay 통일 클러스터)

## 발견사항

없음.

target 코드 변경(`ai-turn-executor.ts` — `narrowResumeState` 헬퍼 신설, `buildAiNodeRefFromState`/`threadHolderFromState` 파라미터를 `ResumeState` 로 통일)은 `plan/in-progress/refactor/03-maintainability.md` §M-7 "relay 통일 클러스터" 항목에 사전 기록된 결정을 그대로 구현한 것이며, 다음 두 축 모두에서 기존 Rationale 과 정합한다.

1. **`narrowResumeState` 단일 진입점 신설** — plan 은 이를 "흩어진 `state as ResumeState` 3곳 통합(ai-review INFO)"로 명시. 이전 ai-review 가 반복 지적한 "과도기적 비일관성"(여러 메서드에 흩어진 동일 캐스트)을 해소하는 방향이며, 코드 주석("여러 메서드에 흩어져 있던 `state as ResumeState` 를 대체해 일관화")도 동일 근거를 재진술한다. 새 결정이지만 즉시 plan 문서에 근거가 함께 기록되어 "무근거 번복" 에 해당하지 않는다.
2. **`rawConfig`/`conversationThreadRef` domain 캐스트 유지 (제거하지 않음)** — 이는 과거에 기각된 대안을 재도입한 것이 아니라, 오히려 과거 결정을 그대로 준수한 것이다. 같은 M-7 클러스터의 앞 단계("스키마 enrich 클러스터")에서 이미 "`model`·`rawConfig`·`conversationThreadRef`·`temperature` 등은 진짜 dynamic 이라 unknown 유지(사용자 결정 2026-07-02 '측정 enrich')"로 명시 기각되었고, 이번 diff 의 주석("rawConfig 는 스키마상 unknown(진짜 dynamic node config) — domain 캐스트 유지")은 그 결정을 반복 확인할 뿐 번복하지 않는다. `spec/5-system/4-execution-engine.md §7.4/§1.3`("state.rawConfig 는 한 turn 처리 동안 frozen snapshot", "핵심 필드 누락 시 기본값 보강")·`spec/conventions/node-output.md`("rawConfig 는 진짜 dynamic node config")의 invariant 와도 충돌 없음.
3. **behavior-preserving 원칙 준수** — `narrowResumeState` 는 "state 는 재할당되지 않으므로 컴파일 타임 캐스트만 — 런타임 no-op" 으로 명시되어 있고, plan 도 "behavior-preserving(assertion/no-op 캐스트)" 로 동일하게 기록. `resume-state.schema.ts` 도입 시 확정된 "§7.5 graceful-reset 의 malformed/partial 허용 semantics 를 바꾸지 않도록 런타임 경계에서 parse 하지 않는다"는 핵심 invariant를 이번 변경도 우회하지 않는다 (스키마 사용은 여전히 타입 파생 전용, 런타임 validator 미추가).
4. **RESUME-STATE 3종 구분(ResumeState/ResumeCheckpoint/RetryState)** 원칙도 유지 — `buildAiNodeRefFromState`/`threadHolderFromState` 파라미터 타입만 `Record<string, unknown>` → `ResumeState` 로 좁혔을 뿐, checkpoint/retry state 와의 구분 경계를 침범하지 않는다.

## 요약

이번 diff 는 `plan/in-progress/refactor/03-maintainability.md` §M-7 에 사전 문서화된 "relay 통일 클러스터"(M-7 종료 단계)의 실행 결과이며, 헬퍼 신설(`narrowResumeState`)과 남겨둔 domain 캐스트(`rawConfig`/`conversationThreadRef`) 모두 각각 근거(ai-review INFO 해소 / 이전 클러스터에서 이미 내린 "진짜 dynamic 필드는 unknown 유지" 결정)를 갖고 있어 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다. `spec/5-system/4-execution-engine.md`·`spec/conventions/node-output.md` 의 `rawConfig`/`_resumeState` 관련 invariant 와도 완전히 정합한다.

## 위험도

NONE
