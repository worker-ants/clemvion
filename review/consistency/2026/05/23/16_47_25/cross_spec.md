# Cross-Spec 일관성 검토 결과

**대상 문서**: `plan/in-progress/multiturn-error-preserve.md`
**검토 일시**: 2026-05-23
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

### [CRITICAL] `_resumeState` strip 정책과의 직접 충돌 — C1 은 *해소 의도* 를 기술했으나 변경 전 현재 spec 과 모순

- **target 위치**: `## 작업 축 C. _resumeState 보존 정책 — OQ1 결정 완료 (R1 확정)` + `## 영향 spec` 표의 `spec/5-system/4-execution-engine.md §1.3` 행 + `spec/conventions/node-output.md Principle 4.2` 행
- **충돌 대상**:
  - `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` §1.3 "재개 상태 직렬화 필드" 비고: *"최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다."*
  - `/Volumes/project/private/clemvion/spec/conventions/node-output.md` Principle 4.2 (§4 Principle 4 본문): `_resumeState` 는 DB 저장 시 strip 됨이 명시.
- **상세**: plan 의 C 축은 "retryable error 종결 시 `_retryState` 를 DB outputData 안에 보존" 을 결정했고, 영향 spec 표가 해당 spec 들을 갱신할 것을 명시하고 있다. 그러나 현재 두 spec 은 갱신되지 않아 "strip 됨" 진술이 그대로 남아 있다. plan 이 "C1 해소" 라고 부르는 것이 구현 PR 이 아닌 spec 변경 PR 이라면, 해당 spec 파일들이 아직 실제로 수정되지 않은 상태에서 plan 이 "해소됨" 으로 표기하는 것은 spec-plan 간 상태 불일치다. 구현 PR 을 기다리는 중이라면 해소가 아니라 "이 PR 에서 해소 예정" 으로 표기해야 한다.
- **제안**: plan 본문에서 OQ1 을 "결정 완료" 로 표기하는 것은 맞으나, 영향 spec 표의 `(C1 해소)` 접두사를 `(본 PR 에서 해소 예정)` 으로 정정해 현재 spec 과 혼동을 방지한다. spec 갱신은 반드시 이 PR 에 포함되어야 한다 — 현행 spec 이 "strip 됨" 을 명시하는 상태로 구현 PR 이 먼저 나가면 spec-코드 역전이 발생한다.

---

### [CRITICAL] `ConversationTurnSource` 신규 값 `system_error` 가 `interaction-type-registry.md` §2 에 누락

- **target 위치**: `## 작업 축 B` 및 `## 영향 spec` 표 `spec/conventions/conversation-thread.md §1.1`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/interaction-type-registry.md` §2 "ConversationTurnSource" — 처리 분기 매트릭스에 현재 5값 (`presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`) 만 열거되어 있고 신규 `system_error` 값에 대한 행이 없음. 동 문서 §2 설명은 `conversation-thread.md §1.1` 을 단일 진실로 가리키지만, 매트릭스 갱신 의무는 동 문서에 있음.
- **상세**: `interaction-type-registry.md` §2.1 처리 분기 매트릭스는 *"신규 enum 값은 본 문서 매트릭스에 반드시 등록한다 — 등록되지 않은 값을 코드에 추가하면 단위 테스트 `interaction-type-exhaustiveness.test.ts` 가 hard fail"* 이라고 명시한다. `system_error` 는 `ConversationTurnSource` enum 확장이므로 본 문서에 행을 추가해야 한다. plan 의 영향 spec 표에는 이 파일이 없다.
- **제안**: 영향 spec 표에 `spec/conventions/interaction-type-registry.md §2.1` 행 추가 — `system_error` 분기 위치 (`threadTurnsToConversationItems` switch, `ConversationTimelineItem` 렌더 분기, §9.1 매핑표) 를 명시. 미등록 시 AST 가드가 빌드를 실패시킨다.

---

### [WARNING] `execution.submit_form` 의 reject 패턴이 현행 WS spec 에 정식 ack 형식으로 정의되어 있지 않음

- **target 위치**: `## 작업 축 C. Retryable error 분기 + 재시도 UX` — "ack payload (실패): ... `execution.submit_form` reject 패턴과 동일 형태"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §4.2 `execution.submit_form` 행 — 현재 "미일치 시 reject" 만 기재되어 있으며, `execution.submit_form.ack` 페이로드 형태나 `error: { code, message }` 구조가 명시적으로 spec 에 정의되어 있지 않음. `execution.click_button.ack` 는 정식 JSON 예시 + 에러 코드 표가 있음.
- **상세**: target plan 은 `execution.retry_last_turn.ack` 실패 페이로드 형태의 근거로 "`execution.submit_form` reject 패턴" 을 인용하지만, 현재 spec 에서 이 패턴의 공식 정의를 찾기 어렵다. `click_button.ack` (정의 존재) 와 `submit_form` reject (정의 미흡) 가 혼재되어 있어, `retry_last_turn.ack` 의 실패 패턴을 어느 것을 기준으로 했는지 모호하다.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.2` 의 `execution.submit_form` 항목에 ack/reject 형식을 명시하거나, `retry_last_turn.ack` 의 실패 페이로드 형태의 독립 정의로 선택하도록 plan 본문을 명확화한다.

---

### [WARNING] `execution.retry_last_turn` 외부 표면 매핑 — REST `interact` 명령 enum 과 정합 필요

- **target 위치**: `## 영향 spec` 표 `spec/5-system/6-websocket-protocol.md §4.6`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §4.6 "Client → Server 명령 매핑" 표 — 현재 `submit_form`, `click_button`, `submit_message`, `end_conversation`, `stop`/`cancel` 5종만 정의됨.
- **상세**: target plan 이 §4.6 에 `execution.retry_last_turn` → `retry_last_turn` REST 명령 매핑을 추가한다고 명시하고 있는데, `spec/5-system/14-external-interaction-api.md` 에도 허용 command 목록이 있을 수 있다. §4.6 은 WS ↔ REST 매핑의 권위적 단일 진실임을 "단일 구현 경로" 정책으로 명시하므로, EIA spec 에 대한 동반 갱신 여부를 plan 이 언급하지 않고 있다.
- **제안**: 영향 spec 표에 `spec/5-system/14-external-interaction-api.md` 허용 command 목록 섹션을 확인하고, 해당 목록에도 `retry_last_turn` 을 추가하거나 이 명령이 외부 표면에서 노출되지 않는 이유를 plan 에 명시한다.

---

### [WARNING] `execution.node.failed` payload 의 `error` 필드 shape 변경이 기존 타임라인 UI 와 충돌 가능

- **target 위치**: `## 영향 spec` 표 `spec/5-system/6-websocket-protocol.md §4.1` — "`execution.node.failed` payload `error` 필드 shape 을 `output.error` 전체 구조 (`{ code, message, details?: { retryable?, retryAfterSec?, ... } }`) 로 명시"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.failed` 행 — 현재 payload 가 `{ executionId, nodeId, nodeExecutionId, nodeName, error }` 로 정의되어 있으며 `error` 의 내부 shape 은 명시되지 않음. 이 이벤트를 소비하는 `use-execution-events.ts` / `result-timeline.tsx` 가 기존에 `error` 를 단순 문자열 또는 `{ code, message }` 로 처리하고 있을 수 있음.
- **상세**: `error.details.retryable` 추가는 additive 변경이지만, `execution.node.failed` 의 `error` 필드가 `output.error` 전체 구조임을 spec 으로 처음 명시하면 기존 소비 코드가 가정하는 shape 과 달라 runtime 오류가 발생할 수 있다. plan 의 영향 codebase 표에 `use-execution-events.ts` 가 있으나 이 shape 변경에 대한 명시가 없다.
- **제안**: plan 의 영향 codebase 표에 `execution.node.failed` 의 `error` shape 변경으로 인한 기존 소비 코드 확인을 명시하고, 새 shape 을 전제한 타입 가드 또는 하위 호환 처리를 TDD 순서에 추가한다.

---

### [WARNING] `_retryState` 와 `_resumeState` 의 중첩 top-level 처리 — `nodeHandlerOutput` 5필드 규약과의 정합

- **target 위치**: `## 작업 축 C` — `_retryState` 보존 및 신규 노드 spawn 로직
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/node-output.md` Principle 0 — `NodeHandlerOutput` 의 5필드는 `{ config, output, meta?, port?, status? }`. 현재 `_resumeState` 는 "5필드 외 top-level 키" 로 예외 처리됨이 AI Agent 의 §7.4 비고에서 명시됨(*"`_resumeState` 는 multi-turn 의 internal 전달 필드로, top-level 에 위치하되 expression resolver 에서는 노출하지 않는다"*). `_retryState` 는 이 예외 처리 패턴을 따른다고 가정하고 있으나, plan 에는 `_retryState` 가 `NodeHandlerOutput` 에서 어떻게 전달되는지 명시가 없다.
- **상세**: `_retryState` 는 `NodeExecution.outputData._retryState` 에 저장된다고 하는데, 이는 `output._retryState` 인지 (top-level 이 아니라 `output` 내부), 아니면 `_resumeState` 처럼 handler return 의 top-level 필드인지가 불분명하다. 특히 error 종결 시 `buildMultiTurnFinalOutput` 이 `{ output: { error: ... }, port: 'error', status: 'ended' }` 를 반환하는 경우, `_retryState` 는 이 구조의 어디에 위치하는가? `output.error` 와 같은 레벨인 `output._retryState` 인지, 아니면 `_resumeState` 처럼 handler return top-level 에 추가되는 `_retryState` 인지에 따라 `stripControlFields()` 의 예외 처리 위치가 달라진다.
- **제안**: plan 에 `_retryState` 의 handler return 위치 (`output` 내부 vs top-level) 를 명시하고, AI Agent §7.9 JSON 예시에 `_retryState` 필드를 추가할 때 `_resumeState` 와의 위치 일관성을 확인한다.

---

### [INFO] `data-hydration-surfaces.md` 참조 부재 — `parseHistoryMessages` 변경의 hydration surface 영향

- **target 위치**: 영향 codebase 표 `parseHistoryMessages` 행 (OQ3 결정)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/data-hydration-surfaces.md` — 이 규약 문서가 존재하며 hydration surface 변경 시 참조해야 할 수 있다.
- **상세**: `parseHistoryMessages` 가 `output.error` 가 set 된 multi-turn 종결 노드에서 `system_error` item 을 합성하는 변경은 "실행 이력 복원 view" (`§9.3 D3`) 의 hydration surface 를 확장하는 것이다. `conversation-thread.md §9.3` 실행 이력 복원 경로가 갱신되는데, `data-hydration-surfaces.md` 의 관련 항목이 plan 의 영향 spec 표에 포함되어 있지 않다.
- **제안**: `spec/conventions/data-hydration-surfaces.md` 를 확인해 `parseHistoryMessages` 또는 실행 이력 NodeExecution 복원 경로가 정의되어 있다면 영향 spec 표에 추가한다.

---

### [INFO] 새 WS 명령 `execution.retry_last_turn` 의 `nodeExecutionId` payload — 기존 명령들의 `nodeId` 패턴과 비일관

- **target 위치**: `## 작업 축 C` — `execution.retry_last_turn` payload `{ executionId, nodeExecutionId }`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §4.2 기존 명령들 — `execution.submit_form`, `execution.click_button`, `execution.submit_message`, `execution.end_conversation` 모두 `{ executionId, nodeId }` 패턴을 사용함. `nodeExecutionId` 를 payload 에 포함하는 Client→Server 명령은 기존에 없음.
- **상세**: 기존 명령들은 `nodeId` 로 현재 waiting 중인 노드를 식별하는데, `retry_last_turn` 은 `nodeExecutionId` 로 식별한다. 이는 의도적 차이이지만 (retry 는 특정 NodeExecution row 를 직접 참조해야 하므로), 클라이언트 코드 패턴과의 비일관성으로 혼동을 일으킬 수 있다. plan 이 `nodeId` 가 아닌 `nodeExecutionId` 를 선택한 이유를 §4.2 비고에 명시하면 좋다.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.2` 의 `execution.retry_last_turn` 행 비고에 "`nodeId` 대신 `nodeExecutionId` 를 사용하는 이유 — 동일 노드의 새 NodeExecution row 를 spawn 하므로 row 단위 식별이 필요함" 을 추가한다.

---

### [INFO] `spec/3-workflow-editor/3-execution.md §10.5` / `§10.6` / `§10.8` 에 대한 참조가 plan 에 있으나 현재 문서에서 해당 섹션 유무 확인 필요

- **target 위치**: `## 영향 spec` 표 `spec/3-workflow-editor/3-execution.md §10.5 / §10.6` 및 `§10.8`
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md` — 해당 섹션 번호들이 실제로 존재하는지 확인이 필요하다 (워크플로 실행 spec 의 section 넘버링은 이미 §10.14 까지 확장됨이 다른 spec 참조에서 확인되므로 존재 가능성은 높음).
- **상세**: plan 이 §10.5 (인스펙터 입력 영역 행), §10.6 (디폴트 탭 우선순위), §10.8 (라이프사이클 표) 의 수정을 명시하고 있는데, 이 섹션들이 현재 spec 에 실제로 존재하며 plan 에 기술된 내용과 정합하는지 확인이 필요하다. 특히 §10.8 라이프사이클 표에서 "conversation snapshot 보존" 을 `실행 실패` 행에 추가하는 것이 현재 해당 행의 내용과 충돌하지 않는지 검토한다.
- **제안**: `spec/3-workflow-editor/3-execution.md` §10.5 / §10.6 / §10.8 의 현재 내용을 확인하고, plan 의 변경 사항이 기존 내용을 누락 없이 포함하는지 검증한다.

---

## 요약

target plan (`multiturn-error-preserve`) 은 `spec/conventions/conversation-thread.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/node-output.md`, `spec/5-system/6-websocket-protocol.md`, `spec/4-nodes/3-ai/1-ai-agent.md` 등 7개 이상 spec 파일에 걸쳐 있는 광범위한 변경 계획이다. 가장 심각한 충돌은 두 가지다: 첫째, `_resumeState` strip 정책에 대한 현재 spec 기술 ("strip 됨") 이 plan 의 R1 결정 ("retryable 종결 시 `_retryState` 보존") 과 직접 모순되어 있어, 구현 PR 이 해당 spec 파일들을 먼저 갱신하지 않으면 spec-코드 역전이 발생한다. 둘째, `ConversationTurnSource` 에 `system_error` 를 추가할 때 `interaction-type-registry.md §2.1` 의 처리 분기 매트릭스 갱신 의무가 plan 의 영향 spec 표에 누락되어 있으며, 이는 AST 가드 빌드 실패로 이어질 수 있다. 나머지 WARNING 급 항목들은 `submit_form` reject 패턴의 정의 모호성, External Interaction API 의 동반 갱신 필요성, `execution.node.failed` payload shape 변경의 소비자 영향, `_retryState` 의 handler return 위치 불명확 등 구현 착수 전에 정의를 명확히 해야 할 사항들이다.

## 위험도

**HIGH**

STATUS: SUCCESS
