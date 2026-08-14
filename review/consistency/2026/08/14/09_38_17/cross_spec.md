# Cross-Spec 일관성 검토 — spec-draft-eia-62-waiting-payload.md

## 발견사항

### [WARNING] `spec/conventions/chat-channel-adapter.md` 가 target 이 "실측으로 폐기"하는 바로 그 shape 을 SoT 로 재사용 중 — spec_impact 누락

- **target 위치**: 변경 제안 (1) `§6.2 예시를 실측 shape 으로 재작성` + (4) `error.code 를 옵셔널로`. `spec_impact` 는 `14-external-interaction-api.md` · `1-data-model.md` 두 개뿐.
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` union.
  ```ts
  | { type: "execution.waiting_for_input"; /* EIA §6.2 */ …
      node: { id: string; type: string; interactionType: "form"|"buttons"|"ai_conversation"|"ai_form_render" };
      interaction: { /* ... */ };
      context: { formConfig?: unknown; buttonConfig?: unknown; conversationConfig?: unknown; conversationThread?: unknown };
      … }
  | { type: "execution.failed"; … error: { code: string; message: string; nodeId: string | null; details?: unknown } | string; … }
  ```
  같은 shape 이 실제 backend 코드에도 존재한다 — `codebase/backend/src/modules/chat-channel/types.ts:345-364` (`EiaWaitingForInputEvent` — `node`/`interaction`/`context` 그대로), `types.ts:392-401` (`EiaFailedEvent.error.code: string`, 옵셔널 아님). `chat-channel.dispatcher.ts:422-429` 의 주석은 이 선택의 근거를 명시적으로 **"EIA spec (§6.2) … expect the nested `{ node, interaction, context }` shape"** 라고 적고 있다.
- **상세**: `chat-channel-adapter.md` §1.2 는 스스로 "**EIA spec 의 payload shape 을 재사용 (drift 회피)**" 라고 선언하고 "**내부 필드의 SoT는 EIA §6 … 어긋나면 EIA 쪽이 참이다**" 라고 명시한다. target 의 (1)이 EIA §6.2 의 정식 예시를 `node/interaction/context` 중첩에서 flat(`waitingNodeId`/`buttonConfig`/`nodeOutput` …)으로 바꾸고, (4)가 `execution.failed` 의 `error.code` 를 옵셔널로 바꾸면, `chat-channel-adapter.md` 의 이 두 union variant 는 **더 이상 "EIA §6 재사용" 이 아니라 EIA 와 정면으로 어긋나는 서술**이 된다. `interaction-type-registry.md` · `7-channel-web-chat/0-architecture.md` · `5-system/4-execution-engine.md` §7.5.1 인용부는 이미 실측 flat shape(`waitingNodeId` 등)로 정리돼 있는 것과 대조적으로, 이 한 파일만 뒤에 남는다.

  이 정확히 같은 패턴이 **이미 한 번 이 저장소에서 벌어졌다.** 자매 plan `plan/in-progress/spec-draft-eia-notification-payload-contract.md` (종결 이벤트 payload 정리)는 `--spec` 검토에서 **3회 연속 `BLOCK: YES`** 를 받았는데, 반려 사유가 매번 "같은 규칙을 일부 절에만 적용" — 그중 1라운드가 정확히 "`chat-channel-adapter.md` 누락" 이었다(plan 본문 L30). 그 plan 은 결국 4·5·6·7종 이벤트(`completed`/`failed`/`cancelled` 등, target 이 다루는 `waiting_for_input` 은 **명시적으로 범위 밖**)에 대해 `chat-channel-adapter.md` 를 함께 고쳐 통과했다(체크리스트 L237: "`chat-channel-adapter.md` §1.2 3 variant 축약"). 즉 이 파일이 spec_impact 에서 빠지면 반려된다는 것이 이미 이 저장소의 실측 이력이다 — `waiting_for_input` variant 만 그 정리에서 빠진 채 남아 있었고, target 도 같은 자리를 또 빠뜨렸다.
- **제안**: `spec_impact` 에 `spec/conventions/chat-channel-adapter.md` 추가. §1.2 의 `execution.waiting_for_input` variant 를 EIA §6.2 재작성 shape 에 맞춰 flat 으로 정정(또는 이미 확립된 "SoT 포인터 + 미소개 union" 패턴을 그대로 적용), `execution.failed` variant 의 `error.code` 를 `code?: string` 로 동기화. (백엔드 타입 `types.ts`/`chat-channel.dispatcher.ts` 자체는 flat→nested 내부 변환을 이미 정상 수행 중이라 **런타임 동작은 깨지지 않는다** — 이 항목은 문서 SoT 주장("재사용, drift 회피")이 스스로 거짓이 되는 것을 막기 위한 동기화다.)

### [INFO] 필드 소유권 분리(WS §4.4 vs EIA §6.2) 재확인 — 실행 시 유지 필요

- **target 위치**: 변경 제안 (1), (3).
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.4 caveat blockquote (L394): "WS 내부 부가 식별자(`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt`)는 본 §4.4 가 소유한다."
- **상세**: 충돌은 아님 — 오히려 기존 오너십 분리 원칙(PR #945)과 정합적이다: WS 가 필드 *의미*의 SoT, EIA §6.2 가 외부 client 가 보는 *wire 형태*의 SoT. target 의 (1)이 이 필드들을 §6.2 본문 예시로 승격시키는 것 자체는 이 원칙과 어긋나지 않지만, 실행 시 필드 *의미*까지 EIA 문서에 재정의하면 새 이중 SoT 가 생긴다.
- **제안**: §6.2 재작성 시 `waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt` 의 의미 설명은 WS §4.4 로 포인터만 걸고 재정의하지 않을 것 (target 의 (3)이 이미 이 방향으로 서술하고 있어 실행 지침 확인 차원).

### [INFO] L472·L673 인용 오귀속 — target 진단 정확함, 이미 §5.3 이 같은 실측 shape 을 보유

- **target 위치**: 변경 제안 (6).
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` L472(§5.3 단발 상태 조회) · L673(§6.2). 둘 다 `[Conversation Thread §4.4.6 / §5.1](../conventions/conversation-thread.md)` 로 링크.
- **상세**: 실측 확인 — `spec/conventions/conversation-thread.md` 에는 `§5.1`(L272, "messages 모드 매핑")은 존재하지만 `§4.4.6` 앵커는 없다. `§4.4.6`(`messages[].source` 마커)은 실제로 `spec/5-system/6-websocket-protocol.md` L700 소속 헤딩이다. target 의 진단·제안 그대로 정확함 — 새 충돌 아님, 기존 오귀속의 정확한 재확인.
- **제안**: 없음 (target 안대로 진행).

## 요약

target 의 6개 변경 제안 중 (2)(3)(5)(6)은 실측·기존 spec 문서(WS §4.4 caveat, §5.3 REST 응답, data-model §2.14, conversation-thread.md 앵커 부재)와 모두 정합했고 새로운 충돌을 만들지 않는다. 유일한 실질적 gap 은 (1)`§6.2 shape 재작성`과 (4)`error.code 옵셔널화`가 `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` union(및 그 백엔드 대응 타입)의 `execution.waiting_for_input`/`execution.failed` variant 를 함께 갱신하지 않고 넘어간다는 점이다 — 이 파일은 스스로 "EIA §6 shape 재사용, drift 회피" 를 SoT 근거로 내세우고 있어 target 이후 그 주장이 거짓이 된다. 같은 파일·같은 실패 유형(부분 절 적용)이 자매 plan 에서 이미 3회 `BLOCK: YES` 를 유발한 이력이 있어, spec_impact 확장 없이는 동일 반려가 재발할 가능성이 높다.

## 위험도

MEDIUM
