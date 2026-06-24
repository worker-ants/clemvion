# Plan 정합성 검토 결과

## 검토 대상

- **Target**: C-2 후속 W7 SPEC-DRIFT 해소 — `recordMultiTurnNonProviderToolResults` condition `toolCallCount++` 제거
- **변경 파일**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`, `ai-turn-executor.spec.ts`
- **관련 plan**: `plan/in-progress/refactor/03-maintainability.md` § C-2 W7 항목

---

## 발견사항

발견된 CRITICAL/WARNING/INFO 항목 없음.

### 검토 결과 상세

**1. 미해결 결정과의 충돌 (점검 관점 1)**

이전 PR #700 의 `recordMultiTurnNonProviderToolResults` JSDoc 에는 다음과 같은 INVARIANT 가 있었다:

> "single-turn 은 미합산(§3.f-g), multi-turn 은 합산. 동기화 금지."

그리고 plan `03-maintainability.md` C-2 ai-review W7 주석 반영 후에도 `[SPEC-DRIFT]` 주석과 함께 "합산/spec 정정 결정은 planner 위임 (백로그)"으로 남겨두었다.

본 target 변경은 그 위임 백로그를 해소하며 `toolCallCount++`를 제거했다. 이는 미해결 결정을 일방적으로 우회하는 것처럼 보일 수 있으나, plan 문서 C-2 W7 항목(라인 52)에 다음이 명시되어 있다:

> "2026-06-25 사용자가 직접 승인(AskUserQuestion: 'spec 따라 버그픽스')해 백로그 위임 상태를 해소함. 사용자 결정이 위임 메모보다 우선."

사용자가 AskUserQuestion 으로 "spec 따라 버그픽스"를 직접 승인한 것이 plan 에 provenance 로 명시되어 있으므로, "planner 위임 백로그" 상태는 상위 결정권자(사용자)에 의해 해소된 것으로 간주한다. CRITICAL 에 해당하지 않는다.

**2. spec 본문 정합성 확인**

`spec/4-nodes/3-ai/1-ai-agent.md` 라인 524:

> `meta.toolCalls` | number | handler accumulator | KB·MCP·일반 도구 호출 횟수 합산 **(조건 도구 제외)**

spec §7.1 이 이미 조건 도구 제외를 명시하고 있어, 본 변경은 spec 본문을 변경하지 않고 코드를 spec 에 맞추는 버그픽스 성격이다. spec 변경 없이 코드를 spec 에 정렬하는 것은 developer 권한 범위 내다.

**3. 선행 plan 미해소 (점검 관점 2)**

본 변경이 가정하는 사전 조건:
- spec §7.1 `meta.toolCalls` 의 "조건 도구 제외" 정의 — spec 라인 524 에서 확인, 이미 반영됨.
- single-turn (`recordSingleTurnNonProviderToolResults`) 이 조건 도구 미합산을 이미 구현 — C-2 1차 PR (#697) 에서 `[SPEC-DRIFT]` 주석 없이 완료됨.

선행 조건 미해소 없음.

**4. 후속 항목 누락 (점검 관점 3)**

본 변경으로 single-turn 과 multi-turn 이 condition 도구 `toolCallCount` 처리를 통일했다. 검토한 in-progress plan 목록에서 이 통일로 무효화되거나 새로 생성해야 할 후속 항목은 없다:

- `ai-agent-tool-connection-rewrite.md` — 일반 도구(`tool_*`) 재설계로 조건 도구 카운트 정책과 직교.
- `ai-context-memory-followup-v2.md` — 메모리 surface; 본 변경과 무관.
- `auth-config-webhook-followups.md` — 인증 감사 로그; 무관.
- `background-context-key-followups.md` — 컨텍스트 키 race; 무관.
- `cafe24-backlog-residual.md` — Cafe24 API 클라이언트; 무관.

C-2 W7 해소로 `03-maintainability.md` 의 `[SPEC-DRIFT]` 주석과 `planner 위임 (백로그)` 메모가 완전히 정리되어야 하는데, plan 라인 52~54 에서 이미 완료로 반영되어 있다. 추가 plan 갱신 필요 없음.

---

## 요약

본 변경(`recordMultiTurnNonProviderToolResults` condition `toolCallCount++` 제거)은 `plan/in-progress/refactor/03-maintainability.md` C-2 W7 항목과 완전히 정합한다. 이전에 "planner 위임 백로그"로 남겨졌던 결정은 2026-06-25 사용자가 AskUserQuestion 을 통해 직접 "spec 따라 버그픽스"를 승인함으로써 해소되었으며, 해당 provenance 가 plan 에 명시적으로 기록되어 있다. spec §7.1 `meta.toolCalls` 는 이미 "조건 도구 제외"를 규정하고 있으므로 spec 본문 변경 없이 코드를 spec 에 정렬하는 developer 권한 범위의 버그픽스로 적정하다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 어느 항목도 해당하지 않는다.

## 위험도

NONE
