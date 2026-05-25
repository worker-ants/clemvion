# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/5-system/15-chat-channel.md`
**검토 모드**: `--impl-prep` (구현 착수 전)
**검토 일시**: 2026-05-25

---

## 발견사항

### [INFO] `ChatChannelInternalEvent.execution.node.completed` 페이로드에 `triggerId` 포함 — WS 원본 payload 와 필드 집합 불일치

- **target 위치**: `spec/conventions/chat-channel-adapter.md §1.3`의 `ChatChannelInternalEvent` type 정의
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4 execution.node.completed` 이벤트 payload 정의 (`{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }`)
- **상세**: `ChatChannelInternalEvent`는 `execution.node.completed` 이벤트를 in-process fan-out 에서 소비하면서 `{ executionId, triggerId, workflowId, node, output, meta, timestamp, seq }` 형식을 정의한다. 그런데 WS spec 의 원본 이벤트 payload 는 `{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }` 이다. `triggerId`와 `workflowId`는 원본 WS payload 에 없다. Convention spec 의 `ChatChannelInternalEvent`가 이 필드들을 어떻게 획득하는지 (fan-out 소스가 enrichment 하는지, `ChatChannelDispatcher`가 DB 조회로 보충하는지) 명시되어 있지 않다. 또한 `nodeId`/`nodeExecutionId`/`nodeName`/`duration` vs. `node: { id, type, label? }` 간 shape 차이도 있다. 이 차이가 intentional envelope 변환인지, fan-out 시 context 주입인지 구현 착수 전 명시가 필요하다.
- **제안**: `conventions/chat-channel-adapter.md §1.3` 또는 Chat Channel spec §3.1 CCH-AD-07 안에 `ChatChannelInternalEvent`의 `triggerId`/`workflowId` 획득 방법 (예: `ChatChannelDispatcher`가 `execution.node.completed` raw payload + `ChannelListenerRegistry`의 `triggerId` context로 조립)을 한 줄 명시 권장.

---

### [INFO] CCH-AD-07 / CCH-MP-06의 "blocking 케이스 사전 제외" 필터 조건 — WS payload와 필드명 차이

- **target 위치**: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-07`, `spec/conventions/chat-channel-adapter.md §1.3`
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.4` (`execution.node.completed` payload의 `output` 필드 구조)
- **상세**: CCH-AD-07 본문과 Convention §1.3에서 어댑터 sub-filter가 "blocking 진입한 케이스(`nodeExec.outputData.status === 'waiting_for_input'`)"를 사전 제외한다고 명시한다. 그러나 `execution.node.completed` WS payload의 `output` 필드 키는 `NodeHandlerOutput.output`으로 `outputData`가 아니다. 실제 filter 표현식은 `event.output.status === 'waiting_for_input'`이 될 것이다. 변수명 불일치가 구현 시 오해를 유발할 수 있다.
- **제안**: CCH-AD-07의 필터 조건 표현식을 `event.output?.status === 'waiting_for_input'`으로 정정하거나, ChatChannelInternalEvent type 정의에 `output` shape 주석을 추가. 현재 수준은 모호성이지 모순은 아니므로 INFO 등급.

---

### [INFO] `spec/1-data-model.md §2.8` Trigger 의 `config` JSONB 설명 — `hasBotToken` cross-link 동기화 확인

- **target 위치**: `spec/5-system/15-chat-channel.md §5.4.2` ("spec/1-data-model.md §2.8 Trigger의 config JSONB 설명 하단에 동일 cross-link 한 줄 추가")
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger.config` 필드 설명
- **상세**: `spec/1-data-model.md §2.8`를 확인한 결과, `config` JSONB 설명란에 이미 `hasBotToken: boolean` derived 필드의 SoT cross-link가 반영되어 있다 ("응답 DTO 전용 derived 필드 `hasBotToken: boolean` (`botTokenRef IS NOT NULL → true`) — DB 컬럼 아님, SoT [Spec Chat Channel §5.4.2]"). 동기화는 완료 상태. 다만 target spec §5.4.2 본문에 "동일 cross-link 한 줄 추가"라고 기술되어 있어 이미 반영 완료인지, 구현 PR에서 추가해야 할 TODO인지 독자 입장에서 불명확하다.
- **제안**: §5.4.2의 해당 문장을 "(`spec/1-data-model.md §2.8` 에 반영 완료)"로 상태 표기 정리.

---

### [INFO] `SecretStore §2.21.1` 용도 목록 — `bot-token.v2` ref 형식 교차 확인

- **target 위치**: `spec/5-system/15-chat-channel.md §4.2` (chat_channel_token_v2 컬럼 주석, `secret://triggers/{id}/bot-token.v2`)
- **충돌 대상**: `spec/1-data-model.md §2.21.1 SecretStore` 용도 목록
- **상세**: 데이터 모델 §2.21.1은 `secret://triggers/{id}/bot-token.v2` ref를 SecretStore 용도 목록에 이미 명시하고 있다. target spec의 §4.2가 동일 ref를 독립적으로 기술하고 있어 두 문서 모두에 정의된 상태로 이중 기술이지만 내용은 일치한다. 모순 없음.
- **제안**: 현 상태 유지 (이중 명시는 허용 수준). 필요 시 §4.2에 "SoT: `spec/1-data-model.md §2.21.1`" cross-link 추가.

---

### [INFO] EIA `§R10` — chat-channel-internal 추가 listener 허용 범위 명시 완료 확인

- **target 위치**: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-07`, `Rationale §R-CC-16`
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §R10` (단일 sink 정책)
- **상세**: `14-external-interaction-api.md §R10` 하단에 "chat-channel-internal 추가 listener의 R10 허용 범위 (2026-05-25)" 주석이 이미 추가되어 있다. `execution.node.completed` fan-out 이벤트를 in-process sub-filter로 attach하는 것이 단일 sink 정책을 위반하지 않음이 EIA spec 안에 명시 완료. 모순 없음.

---

### [INFO] WS protocol spec의 `execution.node.completed` payload에 `presentations` 필드 부재 (EIA `execution.ai_message`와 대비)

- **target 위치**: `spec/conventions/chat-channel-adapter.md §1.3 ChatChannelInternalEvent`의 `output: Record<string, unknown>`
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4` `execution.node.completed` payload 정의
- **상세**: `execution.ai_message` WS payload에는 `presentations?: PresentationPayload[]` 필드가 명시되어 있고 EIA §6.5에도 cross-link가 있다. 반면 `execution.node.completed` WS payload에는 presentation 관련 별도 필드가 없고 `output: Record<string, unknown>` 안에 암묵적으로 포함된다. `ChatChannelInternalEvent`의 `output: Record<string, unknown>`은 충분한 표현이지만, WS spec 쪽에서도 `execution.node.completed.output`의 presentation 노드별 shape (`output.rendered` for template, `output.items` for carousel 등)가 명시되면 어댑터 구현자가 동일 source를 확인할 수 있다. 현재 spec gap이지만 구현에 직접 영향을 주는 모순은 아님.
- **제안**: `spec/5-system/6-websocket-protocol.md §4` `execution.node.completed` 행에 "presentation 노드의 경우 `output` 내 shape은 각 presentation 노드 spec SoT" 주석 추가 권장 (별도 task).

---

## 요약

`spec/5-system/15-chat-channel.md`의 신규 요구사항 (`CCH-AD-07`, `CCH-MP-06`, `CCH-MP-01` 보강)과 이에 연동된 `spec/conventions/chat-channel-adapter.md`의 `ChatChannelInternalEvent` 신설·`renderNode` 시그니처 union 확장은 `spec/1-data-model.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/interaction-type-registry.md` 등 기존 spec과 실질적 모순 없이 일관된다. 데이터 모델의 `Trigger` 컬럼·`SecretStore` 용도 목록·`hasBotToken` derived 필드는 이미 동기화 완료 상태이며, EIA §R10의 단일 sink 정책도 chat-channel-internal 추가 listener를 명시적으로 허용하도록 갱신되어 있다. 발견된 항목은 모두 INFO 등급으로, `ChatChannelInternalEvent` 페이로드에서 `triggerId`/`workflowId`를 어떻게 조립하는지, blocking 케이스 필터 표현식의 필드명 불일치 등 구현 착수 시 혼동을 줄이기 위한 명시 보완 권장 사항이다. CRITICAL·WARNING 등급 충돌은 발견되지 않았다.

---

## 위험도

LOW

---

STATUS: SUCCESS
