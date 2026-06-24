# Rationale 연속성 검토 결과

검토 모드: --impl-done  
범위: 03-maintainability C-2 W7 SPEC-DRIFT 해소 (`recordMultiTurnNonProviderToolResults` condition `toolCallCount++` 제거)  
diff-base: origin/main

---

## 발견사항

### 발견사항 없음 (NONE)

이번 변경에서 Rationale 연속성 관점의 문제는 발견되지 않았다.

분석 근거:

**1. 기각된 대안의 재도입 — 해당 없음**

`spec/4-nodes/3-ai/1-ai-agent.md §7.1` 의 `meta.toolCalls` 정의는 "KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)" 를 이미 확정 명세로 규정하고 있다. 과거 Rationale 어느 항목에도 "multi-turn 에서 condition 도구를 toolCallCount 에 합산한다" 는 결정이 정식 채택으로 기록된 바 없다 — 이전 코드는 `[SPEC-DRIFT]` 주석으로 명시적으로 spec 불일치 임시 보존임을 표시한 상태였다.

**2. 합의된 원칙 위반 — 위반 없음**

본 변경은 spec §7.1 에 이미 문서화된 "조건 도구 제외" 원칙을 코드에 반영하는 버그픽스다. spec 본문은 변경되지 않았으며, 기존 spec 이 정한 원칙을 코드가 따르도록 수정한 방향이다.

**3. 결정의 무근거 번복 — 해당 없음**

제거된 `INVARIANT (03 C-2 review W6/INFO-5)` 주석("single-turn 과 의도적으로 다름 — 동기화 금지")은 Rationale 로 정식 기록된 결정이 아니라, 이전 behavior-preserving 분해 단계에서 spec 불일치 동작을 잠정 보존하면서 달아놓은 내부 방어 주석이었다. 이를 제거하면서 spec §7.1 / §6.1.f-g 를 새 정책 SoT 로 명시했으므로, 결정 번복이 아니라 spec 기반의 정정이다.

**4. 암묵적 가정 충돌 — 해당 없음**

`maxToolCalls` budget 는 spec §6.1.f-g 상 "KB·MCP·일반 도구" 합산 대상이다. condition tool 을 이 budget 에서 제외함으로써 single-turn / multi-turn 간 budget 소비 시맨틱이 통일되고, spec 이 기록한 "조건 도구 제외" invariant 와 정합한다. 시스템 invariant 우회 요소 없음.

---

## 요약

이번 변경(W7 SPEC-DRIFT 해소)은 `recordMultiTurnNonProviderToolResults` 내 condition deferral 경로에서 `toolCallCount++` 를 제거해, spec §7.1 `meta.toolCalls` 의 "조건 도구 제외" 명세와 코드를 일치시킨 것이다. 관련 Rationale 섹션(spec/4-nodes/3-ai/1-ai-agent.md §12)에는 이 변경을 상충시키는 과거 결정이 존재하지 않으며, 제거된 INVARIANT 주석은 정식 Rationale 결정이 아니라 임시 spec 불일치 보존 주석이었다. 사용자가 2026-06-25 직접 "spec 따라 버그픽스" 를 승인해 planner 위임 백로그 상태가 해소됐으며, plan 파일(03-maintainability.md W7 항목)에 provenance 가 명시됐다. Rationale 연속성 관점에서 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 어느 것도 해당하지 않는다.

---

## 위험도

NONE
