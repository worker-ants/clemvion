# Cross-Spec 일관성 검토 결과

- 검토 모드: 구현 착수 전 검토 (--impl-prep)
- Target 범위: `spec/4-nodes/`
- 검토 일시: 2026-05-23

---

## 발견사항

### [INFO] `execution.submit_form` WS 명령의 `toolCallId` 필드 — 3-execution.md 미반영
- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §4 실행 로직 step 4 / `spec/4-nodes/6-presentation/0-common.md` §10.6
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md` §10 Run Results Drawer 표 (Form 제출 행), `spec/5-system/6-websocket-protocol.md` §4.4
- **상세**: `spec/5-system/6-websocket-protocol.md` §4.4 는 `execution.submit_form` 명령의 body 를 `{ executionId, nodeId, formData, toolCallId? }` 로 정의하며, `toolCallId` 는 AI Agent 의 `render_form` 도구 응답 시에만 동봉되고 미일치 시 서버가 reject 한다고 명시한다. 반면 `spec/3-workflow-editor/3-execution.md` §10 및 §5.1 의 `execution.submit_form` 참조 행은 body 를 `{ executionId, nodeId, formData }` 로만 표기하여 `toolCallId?` 필드가 누락된 상태다. 두 문서가 동일 명령의 payload 를 다르게 기술하고 있어 frontend 개발자가 3-execution.md 를 1차 참조할 경우 `render_form` 분기의 `toolCallId` 매칭 로직을 누락할 수 있다.
- **제안**: `spec/3-workflow-editor/3-execution.md` 의 `execution.submit_form` 참조 행에 `toolCallId?` 필드와 AI Agent `render_form` 응답 시 사용되는 조건을 WS 프로토콜 spec 으로 cross-ref 추가. (비-구현-차단 INFO — 단일 진실은 WS spec 이 이미 보유)

---

### [INFO] `interactionType: 'ai_form_render'` 값 — 3-execution.md execution.waiting_for_input 표 누락
- **target 위치**: `spec/4-nodes/6-presentation/0-common.md` §10.6
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md` §10.1 WS 이벤트 표
- **상세**: `spec/5-system/6-websocket-protocol.md` §4.4 는 `interactionType` 가능 값으로 `form` / `buttons` / `ai_conversation` / `ai_form_render` 4가지를 명시한다. `spec/3-workflow-editor/3-execution.md` §10 의 `execution.waiting_for_input` 설명은 `form` / `buttons` / `ai_conversation` 3가지만 열거하고 `ai_form_render` 를 언급하지 않는다. 클라이언트 개발자가 3-execution.md 기반으로 `interactionType` 분기를 구현할 때 `ai_form_render` 케이스가 누락될 위험이 있다. 직접적 구현 차단 수준은 아니나 UI 분기 문서화 일관성 문제다.
- **제안**: `spec/3-workflow-editor/3-execution.md` 의 `interactionType` 설명란에 `ai_form_render` 를 추가하고 WS 프로토콜 spec §4.4 cross-ref 보강.

---

### [INFO] Form 노드 `output: {}` 표기 — `spec/4-nodes/6-presentation/0-common.md` §4.1 vs `spec/4-nodes/6-presentation/4-form.md` §5.4 표현 경미한 불일치
- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §5.4 Waiting 케이스
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md` §4.1
- **상세**: `0-common.md §4.1` 은 "Form 노드는 `output: {}` (빈 객체)" 라 명시하고, `4-form.md §5.4` JSON 예시도 `"output": {}` 를 사용한다. 두 문서 사이에 모순은 없다. 다만 `0-common.md §8 색인` 표의 form 행은 "static `output: {}` / dynamic `output: { items }`" 라는 표현을 쓰는데, "dynamic `output: { items }`" 는 Carousel 컬럼 설명에서 오인용된 표현으로 보인다. Form 은 `output: { interaction }` (resumed 후) 이 맞으므로 §8 색인의 Form 행 비고가 오해를 유발할 수 있다.
- **제안**: `spec/4-nodes/6-presentation/0-common.md` §8 색인 Form 행의 비고를 "static `output: {}` (waiting) / `output: { interaction }` (resumed)" 로 정정.

---

### [INFO] `spec/4-nodes/6-presentation/4-form.md` §6.2 Form 입력 검증 실패 — `toolCallId` 불일치 케이스 미기술
- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §6.2
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.4 (`execution.submit_form` reject 조건)
- **상세**: `spec/5-system/6-websocket-protocol.md` 는 `execution.submit_form` 에 `toolCallId` 가 동봉됐으나 `_resumeState.pendingFormToolCall.toolCallId` 와 미일치 시 reject 한다고 규정한다. `spec/4-nodes/6-presentation/4-form.md` §6.2 Form 입력 검증 실패 표는 필수 필드 미입력, type 형식 불일치, validation 위반, file MIME/크기/개수만 열거하며 `toolCallId` 불일치 reject 케이스를 다루지 않는다. 이 reject 는 form 노드 자체의 검증이 아니라 WS 레이어의 검증이므로 form.md 가 이를 다루지 않는 것은 계층 책임 분리상 맞을 수 있으나, 문서 소비자 관점에서 "form 제출이 실패하는 모든 경우" 를 찾을 때 WS spec 과 form spec 을 모두 봐야 한다는 안내가 누락되어 있다.
- **제안**: `spec/4-nodes/6-presentation/4-form.md` §6.2 아래에 WS 레이어 거절 케이스에 대한 cross-ref 각주 추가 (`spec/5-system/6-websocket-protocol.md §4.4` 의 `toolCallId` 미일치 reject 안내).

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md` §10.5 step 번호 재채번 후 AI Agent spec 의 cross-ref 일치 여부
- **target 위치**: `spec/4-nodes/6-presentation/0-common.md` §10.5 (step 4 신설로 기존 4·5 → 5·6 재번호)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §4.1, §10 내 cross-ref
- **상세**: `0-common.md` CHANGELOG (2026-05-23) 는 기존 step 4·5 가 step 5·6 으로 재번호되었다고 명시한다. `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 및 §10 에서 `§10.5` 를 인용할 때 step 번호까지 명시하는 구절이 존재할 경우 구 번호를 가리킬 수 있다. 직접 확인한 AI Agent spec 의 cross-ref 는 `§10.5` 섹션 단위 참조이며 step 번호까지 명시한 부분은 발견되지 않았으나, 향후 편집 시 혼란을 예방하기 위해 AI Agent spec 의 `§10.5` cross-ref 표현이 step 번호에 묶이지 않도록 검토 권장.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` 에서 `§10.5` 참조 문구가 특정 step 번호를 고정하는지 점검하고, 고정한 경우 갱신.

---

### [WARNING] `spec/4-nodes/6-presentation/0-common.md` §10.5 step 순서 정의 vs AI Agent §4.1 의 "schema 위반 처리" 흐름 기술 이중성
- **target 위치**: `spec/4-nodes/6-presentation/0-common.md` §10.5 (전체 6 step 흐름)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 ("Schema 위반 처리" / "재시도 1회 후 silent drop")
- **상세**: `0-common.md §10.5` 는 schema 위반 시 tool_result 에 `{error: 'INVALID_PAYLOAD', issues: [...]}` 를 회신하고, LLM 이 같은 turn 안에서 재시도 가능하며 1회 후 실패하면 `meta.presentationSchemaViolations[]` 에 누적한다고 규정한다 (step 5). AI Agent spec §4.1 은 "schema 위반 retry 1회 게이트" 를 언급하고 "재시도 1회 후에도 실패하면 silent drop" 이라고 기술한다. 두 spec 이 동일 흐름을 서로 다른 SoT 로 기술하고 있어, 어느 쪽이 upstream 인지 명확하지 않다. `0-common.md §10.1` 은 "AI Agent 의 dispatcher / 종료 시멘틱 / blocking 흐름은 AI Agent §4.1·§6.1.d·§7.10 단일 진실" 이라고 명시하지만, schema 위반 처리 흐름 자체는 `0-common.md §10.5` 가 6 step 상세 규약을 정의하고 있다. 두 문서가 동일 흐름을 서로를 참조하지 않고 독립 기술하는 형태여서 향후 둘 중 하나가 변경될 때 drift 가 발생할 위험이 있다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 의 schema 위반 처리 설명에 `0-common.md §10.5` 를 명시적 SoT 로 cross-ref 추가하거나, 반대 방향으로 `0-common.md §10.5` 가 AI Agent spec 을 SoT 로 명시하는 방향 중 하나로 책임을 단일화.

---

### [INFO] `spec/4-nodes/6-presentation/4-form.md` §1.5 file 타입 제출 payload — `node-output.md §4.5` 의 `form_submitted` data shape 기술 범위 미포함
- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §1.5 "제출 payload (metadata-only)"
- **충돌 대상**: `spec/conventions/node-output.md` §4.5 `form_submitted` payload 표
- **상세**: `node-output.md §4.5` 는 `form_submitted` 의 `data` 를 `{ [fieldName]: value, via?: 'ai_render' }` 로 정의하며, `value` 는 free-form 이라고 명시한다. `4-form.md §1.5` 는 file 필드의 `value` 가 metadata 객체 배열(`{name, size, type, lastModified}[]`) 임을 정의한다. 두 spec 이 모순되지는 않으나, `node-output.md §4.5` 의 `form_submitted` 항 비고가 `4-form.md §1.5` 로의 cross-ref 를 포함하지 않아 `value` 가 단순 primitive 가 아닌 복합 구조가 될 수 있음을 외부 독자가 `node-output.md` 만으로는 파악하기 어렵다.
- **제안**: `spec/conventions/node-output.md §4.5` `form_submitted` 항에 "file 타입 필드의 value 는 metadata 객체 배열 — `spec/4-nodes/6-presentation/4-form.md §1.5` 참조" 비고 추가.

---

### [INFO] `spec/4-nodes/6-presentation/4-form.md` §4 실행 로직 — `interactionType: 'ai_form_render'` 구분 미기술
- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` §4 실행 로직 step 2 (WS 이벤트 발행)
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md` §10.6, `spec/5-system/6-websocket-protocol.md` §4.4
- **상세**: `4-form.md §4` step 2 는 "WebSocket 이벤트 `execution.waiting_for_input` 발행 (`interactionType: 'form'`)" 이라고 명시한다. 그러나 Form 노드가 AI Agent 의 `render_form` 도구를 통해 활성화된 경우에는 `interactionType: 'ai_form_render'` 가 발행된다 (`0-common.md §10.6` / WS spec §4.4). `4-form.md §4` 는 그래프 Form 노드 직접 실행 기준으로만 기술하고 있어 두 경로를 문서 소비자가 혼동하지 않도록 주석 또는 참조가 필요하다.
- **제안**: `4-form.md §4` step 2 에 "AI Agent `render_form` 도구 호출로 활성화된 경우에는 `interactionType: 'ai_form_render'` — 상세: [공통 §10.6](./0-common.md#106-blocking-vs-display-only)" 등의 분기 언급 추가.

---

## 요약

`spec/4-nodes/` 영역은 전체적으로 높은 일관성을 유지하고 있다. 주요 충돌로 분류될 만한 CRITICAL / 심각한 WARNING 수준의 모순은 발견되지 않았다. 발견된 항목 대부분은 INFO 등급의 cross-ref 누락 또는 동일 흐름의 이중 기술이다. 가장 주목할 항목은 `execution.submit_form` WS 명령의 `toolCallId?` 필드가 `spec/3-workflow-editor/3-execution.md` 에 누락된 점과, `spec/4-nodes/6-presentation/0-common.md §10.5` 의 schema 위반 처리 흐름이 AI Agent spec §4.1 과 각자 독립 기술되어 향후 drift 위험을 내포하는 WARNING 한 건이다. Form 노드의 `option.value` backfill 규칙(`opt-{fieldIdx}-{optIdx}`)은 `0-common.md`, `4-form.md`, `node-output.md` 간에 정합하게 기술되어 있으며, File 타입 metadata-only 결정도 `4-form.md §1.5` 와 `0-common.md Rationale` 이 일치한다. 구현 착수를 차단할 CRITICAL 충돌은 없다.

---

## 위험도

LOW
