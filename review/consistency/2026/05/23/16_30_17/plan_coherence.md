# Plan 정합성 검토 결과

**검토 대상**: `plan/in-progress/multiturn-error-preserve.md`
**검토 모드**: spec draft 검토 (`--spec`)
**검토 시각**: 2026-05-23

---

## 발견사항

### 1. [WARNING] `_resumeState` 스키마 변경 영역이 `ai-presentation-tools` plan 과 중복

- **target 위치**: `plan/in-progress/multiturn-error-preserve.md` §C "영향 spec" 표 — `spec/4-nodes/3-ai/1-ai-agent.md §7.9`, `spec/conventions/conversation-thread.md §9.7`, `spec/5-system/6-websocket-protocol.md §4.2`
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` §4.1 작업 목록 — `spec/4-nodes/3-ai/1-ai-agent.md §7.4 _resumeState schema` (결정 #13 `pendingFormToolCall` 추가) + `spec/conventions/conversation-thread.md §1.2` + `spec/5-system/6-websocket-protocol.md §4.4` + `spec/conventions/node-output.md §4.5`
- **상세**: `multiturn-error-preserve` plan 의 §C.R1 은 retryable error 종결 시 `_resumeState` snapshot 을 `_retryState` 라는 새 top-level 필드로 `NodeExecution.outputData` 에 보관하도록 정의하며, `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 의 `_resumeState` schema 를 갱신해야 한다. `ai-presentation-tools` plan 도 동일 §7.4 에 `pendingFormToolCall` 필드를 추가하는 작업(`[ ]` 체크박스 미완료 상태)을 보유하고 있다. 현재 확인 결과 `ai-presentation-tools` 의 §7.4 `pendingFormToolCall` 변경은 이미 main 브랜치에 머지되어 있으나 (`plan/in-progress/ai-presentation-tools.md` 의 해당 항목이 `[x]` 처리), `multiturn-error-preserve` 가 §7.4 에 `_retryState` 관련 보존 정책을 추가할 때 `pendingFormToolCall` 기존 정의와의 정합성 검토가 필요하다. `ai-presentation-tools` plan 의 `[ ]` 미완료 spec 항목 4건 (`conversation-thread.md §1.2`, `websocket-protocol.md §4.4`, `14-external-interaction-api.md §6.5`, `node-output.md §4.5`) 은 실제로 이미 main 에 반영되어 있지만 plan 체크박스가 갱신되지 않은 상태다. 따라서 실질적 worktree 경합은 없다.
- **제안**: `multiturn-error-preserve` spec 작성 시 `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 의 `_retryState` 필드 추가가 기존 `pendingFormToolCall` 정의와 충돌하지 않음을 확인 후 진행. `ai-presentation-tools.md` 의 미완료 체크박스를 `[x]` 로 갱신하여 상태 혼동을 해소할 것을 권고.

---

### 2. [WARNING] `spec/5-system/6-websocket-protocol.md §4.1/§4.2` 변경 영역이 `spec-drift-ws-button-config` plan 과 중복

- **target 위치**: `plan/in-progress/multiturn-error-preserve.md` §C "영향 spec" 표 — `spec/5-system/6-websocket-protocol.md §4.2` (실행 제어 명령 표에 `execution.retry_last_turn` 추가), `§4.1` (`execution.node.failed` payload 갱신)
- **관련 plan**: `plan/in-progress/spec-drift-ws-button-config.md` — `spec/5-system/6-websocket-protocol.md §4.4` 의 `buttonConfig.timeout/timeoutAction` 예시 제거 (C2) 와 `nodeOutput.type` 판별자 제거 (C3) 작업. worktree: `pending-assignment`.
- **상세**: 두 plan 이 모두 `spec/5-system/6-websocket-protocol.md` 를 수정 대상으로 한다. 하지만 `multiturn-error-preserve` 는 §4.1·§4.2 (실행 제어 명령/노드 failed 페이로드), `spec-drift-ws-button-config` 는 §4.4 (buttonConfig 예시 정정)로 수정 섹션이 다르다. `spec-drift-ws-button-config` 의 worktree 가 `pending-assignment` 이므로 아직 작업이 시작되지 않았다. 병렬 진행 시 동일 파일 병합 충돌이 발생할 수 있다.
- **제안**: 두 plan 중 어느 쪽이 먼저 진행되더라도 `6-websocket-protocol.md` merge 시 서로의 변경 섹션을 검토할 것을 명시적으로 기록. `spec-drift-ws-button-config` 착수 전 `multiturn-error-preserve` 의 §4.1/§4.2 변경 머지 여부를 확인하거나, 착수 시 섹션 격리를 확인.

---

### 3. [WARNING] `OQ1 (_resumeState 보존 방식 R1 vs R2)` 미해결 결정이 spec 에 R1 채택으로 일방 기재되어 있음

- **target 위치**: `plan/in-progress/multiturn-error-preserve.md` §C 본문 — "R1 채택" 으로 명시하면서 §Open Questions OQ1 에 "consistency-check 결과 R2 가 더 정합적이면 사용자 결정 요청" 이라고 조건부 재검토를 열어두고 있음. `## Rationale` 절에는 R1 채택 사유가 이미 확정 근거 형식으로 기술되어 있음.
- **관련 plan**: `plan/in-progress/multiturn-error-preserve.md` 자체의 `## Open Questions OQ1`
- **상세**: OQ1 은 plan 내에서 "사용자 결정 필요" 로 남아있으면서 동시에 R1 이 Rationale 에 채택 확정 형식으로 기재되어 있다. 이 plan 이 spec 초안 작성의 근거가 될 때, consistency-checker 나 후속 작업자가 "R1 이 최종 결정인가, 조건부 결정인가" 를 파악하기 어렵다. spec 작성 phase 에서 R1 기반으로 초안을 작성하되 OQ1 을 OQ 로 유지할 것인지, 아니면 사용자 합의를 통해 OQ1 을 먼저 종결할 것인지 명확화가 필요하다.
- **제안**: OQ1 의 조건 ("consistency-check 결과 R2 가 더 정합적이면 사용자 결정 요청") 의 트리거가 본 consistency-check 자체임을 감안할 때, 아래 INFO #4 에서 별도로 R1/R2 정합성 의견을 제시한다. plan 의 OQ1 항목을 "본 consistency-check 후 R1 확정 또는 재검토 요청" 으로 처리하고 Rationale 절을 "사용자 결정 대기" 상태로 표기하거나, 반대로 사용자가 R1 을 명시적으로 최종 확정한 뒤 OQ1 을 닫을 것을 권고.

---

### 4. [INFO] `_retryState` 보존 정책 (R1) 은 기존 `_resumeState` strip 정책 (`Principle 4.2`) 과 정합

- **target 위치**: `plan/in-progress/multiturn-error-preserve.md` §C.R1 — "`engine 의 stripControlFields()` 도 `_retryState` 는 보존하도록 분기"
- **관련 plan**: 없음 (현행 spec `spec/conventions/node-output.md Principle 4.2` 및 `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 해설)
- **상세**: `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 비고는 "`_resumeState` 는 top-level internal 필드로 expression resolver 비노출, DB 저장 시 strip" 을 명시한다. R1 은 `stripControlFields()` 가 `_retryState` 를 보존하도록 분기를 추가한다. 이는 기존 정책에 명시적 예외를 신설하는 것으로, `Principle 4.2` 본문에 예외 조건을 함께 기술해야 drift 를 막을 수 있다. R2 (`status: 'waiting_for_retry'` 신설) 은 spec 면적이 크다는 plan 의 평가는 타당하다 — `spec/5-system/4-execution-engine.md §1.3` 블로킹/재개 컨트랙트와 Principle 5 port 활성화 모델 양쪽 갱신이 필요하고, R1 은 그 면적을 회피한다. OQ1 에 대한 본 검토의 의견은 **R1 을 채택하되 `Principle 4.2` 의 예외 조건을 명시적으로 기술하는 것이 정합** 하다.
- **제안**: `spec/conventions/node-output.md Principle 4.2` 에 "`_retryState` 는 `stripControlFields()` 의 strip 대상에서 제외 — retryable error 종결 시 NodeExecution.outputData 에 보존되어 `execution.retry_last_turn` 명령의 재개 토큰으로 사용된다" 한 줄 추가. target plan 의 "영향 spec" 표에 `spec/conventions/node-output.md Principle 4.2` 행이 누락되어 있으므로 추가할 것.

---

### 5. [INFO] `replay-rerun` plan 의 Multi-turn 노드 처리 정책 (RR-PL-04) 과 `execution.retry_last_turn` 의 관계 명시 권고

- **target 위치**: `plan/in-progress/multiturn-error-preserve.md` §C — `execution.retry_last_turn` WS 명령 신설
- **관련 plan**: `plan/in-progress/replay-rerun.md` 결정 표 D 항목 — `D1: Multi-turn 노드 처리 = 사용자 새로 입력 (RR-PL-04)`. Re-run 은 multi-turn 노드를 새 세션으로 처리한다.
- **상세**: `multiturn-error-preserve` 의 `execution.retry_last_turn` 은 워크플로 전체 Re-run 이 아닌 개별 AI Agent 노드 단위의 LLM 재호출이다. `replay-rerun` 의 RR-PL-04 ("Re-run 시 multi-turn 노드는 사용자가 새로 입력") 와 의미가 다르다 — 충돌은 없으나, 사용자나 구현자가 "Re-run 을 쓰면 되는 거 아닌가?" 혼동이 생길 수 있다. `spec/5-system/6-websocket-protocol.md §4.2` 또는 `spec/5-system/13-replay-rerun.md` 에 두 경로의 차이 (`retry_last_turn` = 동일 Execution 안에서 노드 단위 재시도 vs `POST .../re-run` = 새 Execution 생성) 를 cross-ref 로 명시하면 혼동을 방지할 수 있다.
- **제안**: `multiturn-error-preserve` plan 의 "영향 spec" 표에 `spec/5-system/13-replay-rerun.md` 에 cross-ref 메모 행 추가 (변경이 아닌 cross-ref). `spec/5-system/6-websocket-protocol.md §4.2` 에 `execution.retry_last_turn` 을 추가할 때 "워크플로 Re-run ([Spec Re-run §RR-PL-04](../5-system/13-replay-rerun.md#rr-pl-04--multi-turn-노드-ux-d1)) 과 다름 — 이 명령은 동일 Execution 안 노드 단위 재시도" 주석 한 줄 추가.

---

### 6. [INFO] `ai-agent-tool-connection-rewrite` plan 의 미결정 항목이 `_resumeState` 복잡도에 잠재 영향

- **target 위치**: `plan/in-progress/multiturn-error-preserve.md` §비범위 — "Background 본문 노드의 retry 는 격리" + `_retryState` 설계
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §의존성·리스크 — "multi-turn 도중 도구 호출 → blocking 노드(form/buttons) 진입 시 AI Agent 의 `_resumeState` 관리 복잡도 증가"
- **상세**: `ai-agent-tool-connection-rewrite` 는 `_resumeState` 복잡도 리스크를 의존성으로 인식하고 있다. `multiturn-error-preserve` 가 `_retryState` 를 `_resumeState` snapshot 기반으로 설계하면, 일반 도구 연결 재설계 완료 후 `_resumeState` 가 변경될 때 `_retryState` 형식도 함께 갱신해야 할 수 있다. 두 plan 의 착수 순서가 엇갈리면 `_resumeState` schema 가 두 번 변경되는 상황이 발생한다.
- **제안**: `multiturn-error-preserve` plan 의 §비범위 또는 §의존성·리스크 항목에 "일반 도구 연결 재설계 (`ai-agent-tool-connection-rewrite`) 완료 후 `_resumeState` schema 변경 시 `_retryState` 형식 검토 필요" 추적 메모 추가.

---

## 요약

`multiturn-error-preserve` plan 은 전반적으로 기존 plan 과 심각한 결정 우회나 동시 worktree 경합 위험이 없다. 주요 spec 파일(`conversation-thread.md`, `websocket-protocol.md`, `node-output.md`, `1-ai-agent.md`) 은 `ai-presentation-tools` plan 의 변경이 이미 main 에 반영되어 있어 실질적 충돌 가능성이 낮다. 단, `spec-drift-ws-button-config` plan 과 `6-websocket-protocol.md` 를 동시에 손댈 경우 merge 충돌이 예상되므로 직렬화 또는 섹션 격리 확인이 필요하다. 더 중요한 주의 사항은 plan 내의 OQ1 (`_resumeState` 보존 방식 R1 vs R2) 이 "사용자 결정 필요" 와 "Rationale 에 R1 확정" 이라는 이중 상태로 남아 있다는 점이다 — 이 plan 을 기반으로 spec 초안 작성 전에 OQ1 의 상태를 명확히 할 것을 권고한다. `spec/conventions/node-output.md Principle 4.2` 에 `_retryState` 예외 조건 명시가 누락된 점도 spec 완결을 위해 보완이 필요하다.

## 위험도

LOW

---

STATUS: SUCCESS
