# 신규 식별자 충돌 검토 결과

**검토 대상**: `spec/conventions/chat-channel-adapter.md`
**검토 모드**: `--impl-prep` (구현 착수 전 검토)
**검토 일시**: 2026-05-25

---

## 발견사항

### [WARNING] `execution.node.completed` — 동일 이벤트 이름이 두 표면(WS 프로토콜 vs chat-channel-internal)에서 다른 payload shape으로 정의됨

- **target 신규 식별자**: `ChatChannelInternalEvent.type = "execution.node.completed"` (`spec/conventions/chat-channel-adapter.md §1.3`)
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md §4.1` — WebSocket 프로토콜의 `execution.node.completed` 이벤트 (`{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }`)
- **상세**: 같은 이름 `"execution.node.completed"` 이 두 표면에서 사용되나 payload shape이 다르다.
  - WS 프로토콜: `{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }`
  - ChatChannelInternalEvent: `{ executionId, triggerId, workflowId, node: { id, type, label? }, output, meta?, timestamp, seq }`
  - 차이점: WS는 `nodeId` flat 필드 + `nodeExecutionId` + `nodeName` + `duration`을 사용하고, ChatChannelInternalEvent는 `triggerId` + `workflowId` + `node` 객체 구조를 사용한다. 두 payload는 상호 변환 없이 사용하면 런타임 오류가 발생할 수 있다.
  - spec 자체는 이 분리를 의도적으로 설계하고(`§1.3` 주석: "SoT: WS §4.4 execution.node.completed — same event name, consumed as chat-channel-internal") 코드(`chat-channel.dispatcher.ts`)도 WebSocket fan-out에서 직접 변환하여 ChatChannelInternalEvent를 재구성한다. 따라서 현재 구현에서는 충돌이 없다.
  - 단, 신규 구현자가 두 표면의 payload를 구분 없이 혼용할 가능성이 있다. `execution.node.completed`라는 이름만 보고 WS payload shape을 ChatChannelInternalEvent에 직접 적용하는 실수가 발생할 수 있다.
- **제안**: `spec/conventions/chat-channel-adapter.md §1.3` 의 `ChatChannelInternalEvent` 정의 상단 또는 `spec/5-system/6-websocket-protocol.md §4.1` 의 해당 행에 양방향 주의 문구(payload shape이 의도적으로 다름, dispatcher가 변환 책임)를 추가한다. 또는 codebase의 `types.ts`에서 `EiaNodeCompletedEvent` (현재 코드 명칭) 대신 spec 명칭 `ChatChannelInternalEvent`로 일치시키는 것을 검토한다.

---

### [INFO] `R1` ~ `R4` Rationale ID — 파일 로컬 bare ID가 여러 spec 파일에서 동시 사용됨

- **target 신규 식별자**: `R1`, `R2`, `R3`, `R4` (`spec/conventions/chat-channel-adapter.md Rationale 섹션`)
- **기존 사용처**: 동일 bare ID가 다음 파일들의 Rationale 섹션에서 독립적으로 사용됨:
  - `spec/5-system/14-external-interaction-api.md` — `R1~R4` (다른 의미)
  - `spec/conventions/secret-store.md` — `R1~R4` (다른 의미)
  - `spec/5-system/15-chat-channel.md` — `R1~R9`/`R-K` + `R-CC-N` prefix (다른 의미)
  - `spec/4-nodes/7-trigger/providers/telegram.md` — `R1~R4` (다른 의미)
- **상세**: 각 파일 내에서는 file-local ID이므로 실질적 의미 충돌은 없다. 단, `spec/4-nodes/7-trigger/providers/slack.md`에서 "Convention Rationale R4"라는 문구로 chat-channel-adapter.md의 R4를 cross-reference한다. 파일명을 명시("Convention")했으므로 현재는 의미가 명확하다.
  - `chat-channel-adapter.md` 자체가 2026-05-25 이후 신규 Rationale에 `R-CCA-N` prefix 도입을 선언(`Rationale` 절 도입 주석)하여 기존 `R1~R4`는 hold로 유지한다. 이 조치로 미래 충돌 가능성은 낮아졌다.
- **제안**: 현재 교차 참조는 "Convention Rationale R4"처럼 파일 컨텍스트를 명시하고 있어 혼동 위험이 낮다. 필요 시 "[CCA §R4]" 형태의 명시적 prefix cross-reference 패턴을 적용하면 더욱 명확해진다. 하지만 즉각적 조치는 불필요하다.

---

### [INFO] `EiaNodeCompletedEvent` (코드) vs `ChatChannelInternalEvent` (spec) — 명명 비대칭

- **target 신규 식별자**: `ChatChannelInternalEvent` (`spec/conventions/chat-channel-adapter.md §1.3`)
- **기존 사용처**: `codebase/backend/src/modules/chat-channel/types.ts:269` — `export interface EiaNodeCompletedEvent extends EiaEventBase`; 같은 파일 line 258: `export type ChatChannelInternalEvent = EiaNodeCompletedEvent`
- **상세**: spec은 `ChatChannelInternalEvent`를 union type의 이름으로 정의하고, 코드는 `EiaNodeCompletedEvent`를 구체 인터페이스 이름으로 사용한 뒤 `ChatChannelInternalEvent = EiaNodeCompletedEvent` type alias로 연결한다. 기능 상 등가이나, 코드를 처음 보는 구현자는 `EiaNodeCompletedEvent`가 왜 `Eia` prefix를 갖는지 혼동할 수 있다(이 이벤트는 EIA outbound 5종 화이트리스트 밖의 chat-channel-internal 이벤트이므로 `Eia` prefix는 misleading하다).
- **제안**: `EiaNodeCompletedEvent`를 `ChatChannelNodeCompletedInternalEvent` 또는 `NodeCompletedInternalEvent`로 rename하여 spec 명명과 의도를 일치시킨다. `ChatChannelInternalEvent`는 현재처럼 union type alias로 유지. 그러나 이는 코드 변경 사항으로 spec 자체의 충돌은 아니다.

---

### [INFO] `ChannelMessage`, `ChannelUpdate`, `SetupResult`, `SendResult` — chat-channel 모듈 외부 동명 타입 부재 확인

- **target 신규 식별자**: `ChannelMessage`, `ChannelUpdate`, `SetupResult`, `SendResult`, `ChannelButton`, `KeyboardHint`, `ChatChannelConfig`, `ExecutionFailureClass`, `classifyExecutionFailure`, `ChannelAdapterRegistry`
- **기존 사용처**: 위 타입들은 `codebase/backend/src/modules/chat-channel/types.ts` 및 `channel-adapter.registry.ts`, `shared/execution-failure-classifier.ts` 에서만 정의·사용된다. spec 내 다른 영역(EIA, Webhook, Auth, Workflow 등)에서는 동명 타입이 발견되지 않는다.
- **상세**: 충돌 없음. 모두 chat-channel 모듈 전용 식별자로 scoping이 명확하다.
- **제안**: 해당 없음.

---

## 요약

`spec/conventions/chat-channel-adapter.md`가 도입하는 식별자 중 실질적 CRITICAL 충돌은 발견되지 않았다. 가장 주의할 점은 `execution.node.completed`라는 이벤트 이름이 WebSocket 프로토콜(외부 표면)과 ChatChannelInternalEvent(내부 표면) 양쪽에서 사용되나 payload shape이 다르다는 점이다. 이는 설계 의도이며 dispatcher가 변환 책임을 진다고 spec에 명시되어 있지만, 신규 구현자의 혼동 가능성이 있어 WARNING으로 기록한다. R1~R4 Rationale ID는 file-local ID이므로 cross-file 충돌은 없으며, `R-CCA-N` prefix 도입으로 미래 충돌도 방지되었다. 코드에서 `EiaNodeCompletedEvent` 명칭이 spec의 `ChatChannelInternalEvent`와 비대칭인 점은 명명 개선 권고 수준이다. 전반적으로 식별자 충돌 위험은 낮다.

## 위험도

LOW
