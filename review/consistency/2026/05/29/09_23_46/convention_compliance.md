---
checker: convention-compliance
target_changeset: workflow-resumable-phase3-a4ea4a vs origin/main
reviewed_at: 2026-05-29
---

# 정식 규약 준수 검토 (Convention Compliance)

## 변경 파일 목록

- `spec/5-system/4-execution-engine.md` — §7.5.1 구현 상태 note 갱신 + §9.3 DLQ 모니터링 신규
- `plan/in-progress/workflow-resumable-execution.md` — Phase 3 / 변경 2.3 체크리스트 완료
- `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` — 변경 2.3 완료 표기
- `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — 신규
- `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` — `@OnWorkerEvent('failed')` 추가
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `InvalidExecutionStateError` 신규 + `resolveWaitingNodeExecutionId` throw 전환
- `codebase/backend/src/modules/executions/executions.controller.ts` — 422 `INVALID_STATE` surface
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` — 409 `STATE_MISMATCH` surface
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — ack `errorCode` 필드 신설
- 각 `.spec.ts` 파일

---

## 발견사항

### 1

- **[WARNING]** WS ack 페이로드에 신설된 `errorCode` 필드가 `spec/5-system/6-websocket-protocol.md` ack 스키마에 미등재
  - target 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `execution.form_submitted.ack` / `execution.click_button.ack` / `execution.submit_message.ack` / `execution.end_conversation.ack` 반환 타입 및 반환 객체에 `errorCode?: string` 필드 추가
  - 위반 규약: `spec/5-system/6-websocket-protocol.md` §4.2 — "공통 ack success payload shape" 표 및 에러 ack 형식. 표에는 `error?: string` 만 존재하고 `errorCode` 필드가 정의되지 않음. `spec/conventions/node-output.md` Principle 3.2 에서 에러 코드 전달 형식은 `error.code` 구조를 사용하도록 규정함.
  - 상세: spec §4.2 의 에러 ack 테이블은 `error` (string) 필드를 정의하고, `INVALID_EXECUTION_STATE` 등 에러 코드는 별도 "에러 코드" 표에서 의미만 서술한다. 구현은 `errorCode?: string` 을 별도 최상위 필드로 추가해 에러 코드를 분리 전달한다. `retry_last_turn` ack 에러 shape 예시(`{ "error": { "code": "...", "message": "..." } }`) 와도 구조가 불일치한다 — retry_last_turn 은 nested object, 4개 명령 ack 는 flat `errorCode` string 으로 계층이 다르다.
  - 제안: `spec/5-system/6-websocket-protocol.md` §4.2 의 공통 ack 에러 payload 표에 `errorCode?: string` 필드를 추가하고, 이것이 `error` (string) 와 함께 쓰이는 경우의 의미를 명시한다. 또는 `retry_last_turn` 의 nested `error.code` 패턴으로 4개 명령 ack 도 통일하는 쪽으로 구현을 조정하는 방안도 있다 — 어느 방향이든 spec 과 구현이 일치해야 함.

### 2

- **[WARNING]** `spec/5-system/4-execution-engine.md` frontmatter `status: spec-only` 가 실구현 완료 후에도 미갱신
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter 첫 5줄
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 — "spec-only → partial: 최초 코드 머지 시점에 승격", "partial → implemented: 마지막 pending_plans 가 complete/ 로 이동한 commit 안에서 승격"
  - 상세: `4-execution-engine.md` 는 `status: spec-only`, `code: []` 상태로 유지되고 있다. 본 changeset 이 실행 엔진 핵심 기능(DLQ 모니터, InvalidExecutionStateError, resolveWaitingNodeExecutionId 전환)을 구현 완료한다. spec-impl-evidence 규약의 전이 규칙에 따르면 실구현 코드가 머지되는 PR 에서 `status` 를 `partial` 또는 `implemented` 로 승격하고 `code:` 에 구현 경로를 등재해야 한다. `code: []` + `status: spec-only` 로 남으면 `spec-code-paths.test.ts` 가드는 통과하지만 "spec 약속 vs 구현 부재 갭" 감지의 단일 진실이 stale 하게 된다.
  - 제안: `spec/5-system/4-execution-engine.md` frontmatter 를 아래 방향으로 갱신한다.
    ```yaml
    status: partial
    code:
      - codebase/backend/src/modules/execution-engine/**
    pending_plans:
      - plan/in-progress/workflow-resumable-execution.md
    ```
    모든 spec 약속이 이번 PR 로 완전히 충족됐다면 `status: implemented` + `pending_plans` 제거, plan 을 `plan/complete/` 로 `git mv` 이동까지 함께 처리한다. (단, `workflow-resumable-execution.md` 에 아직 미완 항목이 있으면 `partial` + `pending_plans` 유지.)

### 3

- **[INFO]** plan frontmatter `worktree` 필드가 현재 active worktree 를 반영하지 않음
  - target 위치: `plan/in-progress/workflow-resumable-execution.md` frontmatter — `worktree: workflow-resumable-execution-phase2-cont-64f537`
  - 위반 규약: `.claude/docs/plan-lifecycle.md` §4 frontmatter 스키마 — `worktree: <task_name>-<slug>` 는 "이 plan 이 살아있는 worktree 디렉토리 이름"
  - 상세: 본문에 "Phase 3 + 변경 2.3 = `workflow-resumable-phase3-a4ea4a` (현재 active, 2026-05-29)" 라고 명시돼 있으나 frontmatter `worktree` 값은 이전 phase 의 worktree(`workflow-resumable-execution-phase2-cont-64f537`) 로 유지된다. 본문 설명과 frontmatter 가 일치하지 않는다. `spec-update-workflow-resumable-execution-phase2-followup.md` 도 동일하게 frontmatter `worktree` 가 이전 worktree 로 남아 있다.
  - 제안: `plan/in-progress/workflow-resumable-execution.md` 와 `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 의 frontmatter `worktree` 를 `workflow-resumable-phase3-a4ea4a` 로 갱신한다.

### 4

- **[INFO]** `spec/5-system/4-execution-engine.md` §9.3 DLQ 모니터 섹션이 본문에 추가됐으나 Rationale 기록 없음
  - target 위치: `spec/5-system/4-execution-engine.md` — `#### Dead-letter 모니터링 (Phase 3.1)` 신규 섹션
  - 위반 규약: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
  - 상세: `ContinuationDlqMonitorService` 도입·별도 메트릭 SDK 미사용·OTel traces-only 구성 유지라는 설계 결정이 본문에 인라인으로만 서술되고 `## Rationale` 섹션에 별도 기록이 없다. 기존 Rationale 에는 "Durable Continuation (2026-05-24)" 등 결정이 기록되어 있으므로 패턴 일관성 차원에서 추가가 권장된다.
  - 제안: `spec/5-system/4-execution-engine.md` 의 `## Rationale` 에 "DLQ 모니터링 (Phase 3.1, 2026-05-29)" 항목을 추가하고 "별도 메트릭 SDK 대신 로그 기반 알람을 선택한 근거 (OTel traces-only 현 구성)" 를 간략히 기술한다.

---

## 요약

본 changeset 은 spec 에서 이미 정의된 `INVALID_EXECUTION_STATE` 코드 및 DLQ 모니터링 기능을 구현한 PR 로, 정식 규약의 치명적 위반은 없다. 다만 두 가지 WARNING 이 존재한다. 첫째, WS gateway 에 신설된 `errorCode?: string` 필드가 `spec/5-system/6-websocket-protocol.md` §4.2 ack 스키마에 등재되지 않아 spec-to-impl 정합이 불완전하다 — 특히 `retry_last_turn` ack 의 nested `error.code` 패턴과 구조가 다르다. 둘째, 실구현이 완료됐음에도 `spec/5-system/4-execution-engine.md` frontmatter 가 `status: spec-only`, `code: []` 로 유지되어 `spec/conventions/spec-impl-evidence.md` 의 status 전이 규칙을 따르지 않는다. 두 INFO 는 plan frontmatter worktree 필드 동기화 누락과 Rationale 섹션 미기록이다.

---

## 위험도

**MEDIUM** — `errorCode` 필드 미등재가 클라이언트 계약 갱신 누락이며, `spec-impl-evidence` 전이 규칙 위반이 spec 약속 추적 보증을 약화시킨다.

---

STATUS: SUCCESS
