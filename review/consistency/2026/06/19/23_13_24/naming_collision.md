# 신규 식별자 충돌 검토 — spec/4-nodes/2-flow/ (--impl-done, diff-base=origin/main)

## 발견사항

### [INFO] `TurnRagDelta` 신규 명 — 기존 `RawTurnDebugEntry` (llm-call-trace.ts) 와 명명 근접
- **target 신규 식별자**: `TurnRagDelta` (`output-shape.ts` 에서 `TurnDebugEntry` → `TurnRagDelta` rename)
- **기존 사용처**: `codebase/frontend/src/components/editor/run-results/llm-call-trace.ts:24` — file-private `interface RawTurnDebugEntry` (turnIndex/llmCalls per-call — LLM 호출 trace flatten 용 raw payload 파서)
- **상세**: `TurnRagDelta` (ragSources/ragDiagnostics — RAG KB delta) 와 `RawTurnDebugEntry` (llmCalls/requestPayload — LLM trace raw) 는 의미가 전혀 다르며, 두 이름은 실제로 충돌하지 않는다. `RawTurnDebugEntry` 는 `Raw` prefix 로 구분되어 있고 file-private 이라 export 충돌 위험도 없다.
- **제안**: 현 `TurnRagDelta` 명은 충분히 명확하다. 조치 불필요.

### [INFO] backend `TurnDebugEntry` (llm-call-record.ts) vs frontend `conversation-utils.ts` `TurnDebugEntry` — 이종 언어 동명 잔존
- **target 신규 식별자**: backend `TurnDebugEntry` (`codebase/backend/src/shared/llm-tracing/llm-call-record.ts:33` — PR #632에서 도입, 이번 diff 범위 외)
- **기존 사용처**: `codebase/frontend/src/lib/conversation/conversation-utils.ts:360` — file-private `interface TurnDebugEntry` (turnIndex/llmCalls/toolCalls/totalDurationMs/requestPayload 등 superset)
- **상세**: 두 `TurnDebugEntry` 는 TypeScript 네임스페이스가 완전히 분리된다(backend TS vs frontend TS — cross-language). 런타임 충돌 없음. frontend 의 것은 file-private 이라 외부 import 없음. 이번 diff 의 `output-shape.ts` rename(1b-3) 이 frontend 내 export 충돌을 해소했고, backend-frontend 이종 언어 동명은 구조적으로 허용 가능하다.
- **제안**: 조치 불필요. 장기적으로 spec/5-system/6-websocket-protocol.md §4.4 문서화 시 혼동 방지 주석 추가 검토 가능.

### [INFO] `WORKFLOW_FORBIDDEN_WORKSPACE` — spec/4-nodes/2-flow/1-workflow.md 기 등재, conventions/error-codes.md 미등재
- **target 신규 식별자**: `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` (`codebase/backend/src/nodes/core/error-codes.ts:66`)
- **기존 사용처**: `spec/4-nodes/2-flow/1-workflow.md:75` 에서 이미 string literal `WORKFLOW_FORBIDDEN_WORKSPACE` 로 언급됨 (W-6 격리 가드). 이번 diff 가 그것을 enum 으로 정식 등재한다. `spec/conventions/error-codes.md` 에는 아직 미등재.
- **상세**: 기능적 충돌 없음. 기존 generic `FORBIDDEN` (HTTP 403, `spec/5-system/2-api-convention.md:160`) 및 초대 API `forbidden` (lowercase historical-artifact) 와 의미 및 네임스페이스가 분리된다. spec/5-system/3-error-handling.md §1.4 에는 HEAD 기준 정상 반영됨.
- **제안**: `spec/conventions/error-codes.md` 에 `WORKFLOW_FORBIDDEN_WORKSPACE` 등재를 project-planner 가 후속 보완하면 식별자 등록부를 완전하게 유지할 수 있다. 현 diff 범위 차단 사유 아님.

## 충돌 없음 확인 (양성 확인)

| 신규 식별자 | 유형 | 충돌 여부 | 근거 |
|---|---|---|---|
| `WorkflowForbiddenWorkspaceError` (class) | 엔티티/타입명 | 없음 | 코드베이스 전체에 동명 없음. `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 와 일관된 패턴 |
| `WORKFLOW_FORBIDDEN_WORKSPACE` (ErrorCode) | 에러 코드 | 없음 | 기존 generic `FORBIDDEN` (HTTP 403) 및 초대 API `forbidden` (lowercase) 와 의미·네임스페이스 분리 |
| `TurnRagDelta` (interface) | 엔티티/타입명 | 없음 | 동명 없음. 이전 `TurnDebugEntry` (output-shape.ts 로컬) 를 대체하여 충돌 해소 |
| `LlmCallRecord` (interface 사용 확장) | 엔티티/타입명 | 없음 | PR #632 에서 이미 도입된 shared type; 이번 diff 는 사용 확장만 |

## 요약

이번 diff(`spec/4-nodes/2-flow/` --impl-done, diff-base=origin/main)가 도입하는 신규 식별자 4종(`WorkflowForbiddenWorkspaceError`, `WORKFLOW_FORBIDDEN_WORKSPACE`, `TurnRagDelta`, `LlmCallRecord` 사용 확장)은 기존 코드베이스 및 spec 어느 곳에서도 다른 의미로 사용 중인 동명 식별자와 충돌하지 않는다. 1b-3 의 `TurnDebugEntry → TurnRagDelta` rename 은 `conversation-utils.ts` 의 file-private canonical `TurnDebugEntry` 와의 frontend export 충돌을 적절히 해소했다. INFO 수준 관찰 3건은 이종-언어 구조 또는 spec 보완 기회이며, 현 변경을 차단할 이유가 없다.

## 위험도

NONE
