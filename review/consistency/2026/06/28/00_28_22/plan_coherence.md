# Plan 정합성 검토 — spec/conventions/error-codes.md

검토 대상: `spec/conventions/error-codes.md`
검토 기준: `plan/in-progress/**` 진행 중 작업·미해결 결정

---

## 발견사항

- **[WARNING]** `error-codes.md §3` 서문에 scope 경계 미명시 — exec-park W3 미이행
  - target 위치: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 서문 (표 앞 한 줄)
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` L221 — "W3(`error-codes.md §3` skipReason scope 경계) = PR-B1 범위 밖, 후속"
  - 상세: 2026-06-05 `exec-park` PR-B1 `--impl-done` 검토(`review/consistency/2026/06/05/15_27_01/SUMMARY.md` W3)가 `error-codes.md §3` 소개 문구에 "본 레지스트리는 `error.code` surface 한정, 운영 진단 enum(`skipReason` 등)은 별도 규약 범위" 한 줄을 추가할 것을 권고했다. exec-park plan 이 "PR-B1 범위 밖, 후속"으로 명시적으로 이월했으나, target 문서에 이 문구가 없다. `skipReason` (`ragDiagnostics`, `mcpDiagnostics.serverSummaries[].skipReason`, cafe24 연동 skip enum) 은 `error.code` 응답 봉투와 완전히 다른 레이어인데, §3 서문에 구분이 없어 혼동 가능성이 남아 있다.
  - 제안: target `spec/conventions/error-codes.md §3` 서문 또는 `## Overview` 적용 범위 단락에 "본 레지스트리는 `error.code` API surface 한정이며, 운영·진단 enum(`skipReason` 등 노드 진단 필드 vocabulary)은 각 해당 spec 이 소유한다" 취지의 한 줄을 추가해 W3 후속을 이행한다. exec-park plan L221 항목에도 완료 체크를 추가한다.

- **[WARNING]** `INTEGRATION_INVALID_SERVICE` 등재 미이행 — refactor plan open 추적 항목
  - target 위치: `spec/conventions/error-codes.md` — `INTEGRATION_INVALID_SERVICE` 없음
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` L440 — "[ ] `INTEGRATION_INVALID_SERVICE (400)` 를 `spec/2-navigation/4-integration.md §9.4` + `spec/conventions/error-codes.md` 에 등재"
  - 상세: refactor m-1 구현 완료 시 발견된 spec drift — `INTEGRATION_INVALID_SERVICE` 가 코드베이스에 발행 중이나 `error-codes.md` 에 미등재. planner 에 별도 트랙으로 이관된 open `[ ]` 항목이 target 에 아직 반영되지 않았다. target 이 현행 파일의 최신 상태라면 이 항목은 여전히 미이행이다.
  - 제안: target `spec/conventions/error-codes.md` 에 `INTEGRATION_INVALID_SERVICE (400)` 를 §3 또는 error-handling.md §1 의 적절한 위치에 등재하고, `spec/2-navigation/4-integration.md §9.4` 에도 동기화한다. refactor/02-architecture.md L440 체크박스를 완료 처리한다.

- **[INFO]** `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의 — exec-intake PR4 미구현이지만 target 선행 문서화
  - target 위치: `spec/conventions/error-codes.md §3` — `WORKER_HEARTBEAT_TIMEOUT` 행: "코드명은 유지·의미 재정의 (§7.1·§1383·§2.13): '30분 절대 stale' → 'stalled 재배달 소진'"
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` L58 — "[ ] PR4 — stalled-job 일원화 + 관측성: `recoverStuckExecutions` 절대 30분 일괄 fail → BullMQ stalled 재배달로 대체. `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의(stalled attempts 소진)"
  - 상세: target §3 는 `WORKER_HEARTBEAT_TIMEOUT` 의 의미 재정의를 이미 문서화하고 있으며, `4-execution-engine.md §7.1` 에서도 동일 방향으로 spec 을 확정했다. PR4 는 이 spec 결정의 구현 트랙으로, target 이 결정을 일방적으로 내린 것이 아니라 spec 에서 이미 합의된 방향을 conventions 문서에 반영한 것이다. 충돌 없음. 단, PR4 가 구현되기 전까지 `recoverStuckExecutions` 의 실제 동작("절대 30분")과 target 의 "의미 재정의" 선언 사이에 일시적 괴리가 존재하며, 구현 완료 전 이 문서를 읽는 독자가 혼동할 수 있다.
  - 제안: 추적 메모 수준. target 의 `WORKER_HEARTBEAT_TIMEOUT` 행에 현재 `4-execution-engine.md §7.1` 처럼 "현 구현 상태: 절대 30분 stale — Planned (PR4)" 주석을 짧게 추가하면 독자 혼동을 줄일 수 있다. 필수 아님.

- **[INFO]** `TOOL_EXECUTION_FAILED` — ai-agent-tool-connection-rewrite plan 진행 전이라 target 미등재 적절
  - target 위치: `spec/conventions/error-codes.md` — `TOOL_EXECUTION_FAILED` 없음
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` L76 — "[ ] `TOOL_EXECUTION_FAILED` 에러 코드 복원 (`spec/4-nodes/3-ai/1-ai-agent.md` §6 에 이미 placeholder)"
  - 상세: ai-agent-tool-connection-rewrite 는 §1 디자인 결정이 TBD 상태(도구 등록 모델 미결)이며 본 코드 복원은 §4 백엔드 구현 단계의 태스크다. 미결 결정 항목과 충돌하는 결정을 target 이 일방적으로 내리고 있지 않다. target 미등재가 올바른 현 상태다.
  - 제안: 추적 메모. ai-agent-tool-connection-rewrite §1 결정 완료 후 코드 복원 시 error-codes.md 에도 등재 여부를 검토한다.

---

## 요약

Plan 정합성 관점에서 두 건의 WARNING 이 식별됐다. 첫째, `exec-park-durable-resume` PR-B1 `--impl-done` W3 가 이월한 "`error-codes.md §3` 서문에 `skipReason` 등 운영 진단 enum 은 범위 밖임을 명기" 후속이 target 에 미이행된 상태다. 둘째, `refactor/02-architecture.md` m-1 완료 시 planner 에 이관된 open `[ ]` 항목(`INTEGRATION_INVALID_SERVICE` 등재)이 target 에 반영되지 않았다. 두 항목 모두 미해결 결정을 우회하는 성격이 아닌 "후속 spec 갱신 미이행" 이므로 CRITICAL 은 아니나, plan 체크박스와 target 간 추적 불일치가 있어 WARNING 으로 분류한다. `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의는 spec 에서 합의된 방향의 문서화이므로 충돌 없음. `TOOL_EXECUTION_FAILED` 미등재는 선행 미결 결정(도구 등록 모델 TBD)을 올바르게 존중하는 상태다.

---

## 위험도

LOW
