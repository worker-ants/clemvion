# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/2-flow/, diff-base=origin/main)
Target: `spec/4-nodes/2-flow/` + 연관 구현 diff

---

## 발견사항

### 1. [INFO] `WorkflowForbiddenWorkspaceError` typed error 도입 — Rationale 보완 권장

- **target 위치**: `spec/4-nodes/2-flow/1-workflow.md §2` (W-6 note) 및 `§6` 에러 코드 표 `WORKFLOW_FORBIDDEN_WORKSPACE` 행
- **과거 결정 출처**: `spec/4-nodes/2-flow/1-workflow.md §2 W-6` 는 기존에 `assertSameWorkspace` 가 `plain Error` 를 throw(`WORKFLOW_FORBIDDEN_WORKSPACE:` prefix)하고 핸들러가 메시지 토큰으로 분류한다는 사실을 암묵적으로 전제했다. PR #637(fail-closed 전환) Rationale 이 `execution-engine.md §Rationale "C-1"` 인근에 기술돼 있으며, "3 호출처 전수 trace 로 workspace 컨텍스트 상시 공급을 입증해 blanket fail-closed 안전을 확정"이 근거로 남아 있다.
- **상세**: diff 는 `assertSameWorkspace` 가 던지는 에러를 `plain Error` → `WorkflowForbiddenWorkspaceError` typed class 로 교체했다. 이는 fail-closed 결정 자체를 번복하는 것이 아니라, 기존 plain Error 메시지 매칭(`WORKFLOW_FORBIDDEN_WORKSPACE:` prefix) 방식 위에 `instanceof` guard 를 추가한 강화(defense-in-depth) 다. 기각된 대안은 없으며, Rationale 충돌도 없다. 다만 `spec/4-nodes/2-flow/1-workflow.md §2` 의 W-6 설명이 "plain Error 메시지 prefix" 기반 분류를 암묵적으로 전제한 상태이고, typed class 도입 후에도 설명이 갱신되지 않았다. 내부 구현 세부이지만, 향후 다른 개발자가 "왜 typed class 인가 / message-prefix 방식은 왜 남아있는가"를 파악하려면 근거가 필요하다.
- **제안**: `spec/4-nodes/2-flow/1-workflow.md §6` 에러 코드 표의 `WORKFLOW_FORBIDDEN_WORKSPACE` 행 비고란, 또는 `§2 W-6` note 에 "typed `WorkflowForbiddenWorkspaceError` 를 primary 경로로, plain Error prefix(`WORKFLOW_FORBIDDEN_WORKSPACE:`) 를 defensive backstop 으로 유지" 구현 사실을 1줄 추가한다. Rationale 섹션 갱신은 선택 — 이미 `1-workflow.md §6 > WORKFLOW_FORBIDDEN_WORKSPACE` 행에 "(§2 W-6)" 참조가 있으므로 그 맥락에서 typed class 전환 이유를 한 줄로 충분히 표현할 수 있다.

---

### 2. [INFO] `TurnRagDelta` rename (`TurnDebugEntry` 제거) — spec 에 Rationale 미기재

- **target 위치**: diff `codebase/frontend/src/components/editor/run-results/output-shape.ts` — `TurnDebugEntry` → `TurnRagDelta` rename, JSDoc 에 `formerly TurnDebugEntry` 표시
- **과거 결정 출처**: 관련 spec 문서(`spec/5-system/` 또는 `spec/4-nodes/`) 에 `TurnDebugEntry` 를 명시적으로 정의하거나 기각 이력을 남긴 항목이 확인되지 않는다. `spec/2-navigation/14-execution-history.md §Rationale R-3` 은 LLM 탭 구조 결정만 담고 type 이름은 명시하지 않는다.
- **상세**: rename 의 근거는 코드 주석(`conversation-utils.ts` 의 canonical-shaped `TurnDebugEntry`(llmCalls/toolCalls/totalDurationMs) 와의 동명 충돌 해소)이 명확하다. Rationale 기록된 결정과 충돌하거나 기각된 대안을 재도입하는 것이 아니므로 CRITICAL/WARNING 이 아니다. 다만 type 이름이 spec 약속의 일부였다면 Rationale 이 없는 이름 변경이 stale 참조를 낳을 수 있으나 현재 spec 에 해당 이름이 없으므로 영향 없다.
- **제안**: spec 어딘가에 `TurnDebugEntry` 가 공개 타입으로 명시돼 있지 않으므로 Rationale 갱신 의무는 없다. 코드 JSDoc 의 설명이 이미 충분한 in-code 근거다.

---

### 3. [INFO] `LlmCallRecord` 공유 타입 도입 — spec 언급 없음

- **target 위치**: diff `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — 인라인 익명 Array 타입 → `LlmCallRecord[]` 공유 타입 교체
- **과거 결정 출처**: 관련 spec 이 `llmCalls` 의 내부 타입 구조를 정의한 Rationale 항목은 발견되지 않는다.
- **상세**: `LlmCallRecord` 는 in-process 타입 정리(C-1 후속 ③)이며, spec 의 출력 구조(5필드 invariant, `meta.llmCalls` 형상)와 충돌하지 않는다. 기각된 대안의 재도입이 아니다.
- **제안**: spec 이 내부 TS 타입 이름을 강제하지 않으므로 추가 조치 불필요.

---

## 요약

이번 diff 는 (1) `assertSameWorkspace` 의 plain Error → typed `WorkflowForbiddenWorkspaceError` 전환, (2) `TurnRagDelta` rename, (3) `LlmCallRecord` 공유 타입 정리 세 가지 구현 강화를 포함한다. 어느 변경도 `spec/4-nodes/2-flow/` 또는 연관 spec 의 `## Rationale` 에서 명시적으로 기각·폐기된 대안을 재도입하거나 합의된 설계 원칙(5필드 invariant, fail-closed 정책, config↔output 직교성, Durable Continuation 등)을 우회하지 않는다. 유일한 보완 사항은 `WorkflowForbiddenWorkspaceError` typed class 가 primary, plain Error prefix 가 backstop 이라는 계층 구조가 spec 본문에 아직 명시되지 않은 점이다. 이는 INFO 수준 보완 제안이며 차단 요인이 아니다.

---

## 위험도

NONE
