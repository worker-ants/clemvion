# Architecture Review — chat-channel-template-render-outbound

**검토 일시**: 2026-05-25  
**검토 대상**: chat-channel dispatcher + 3개 provider renderer (telegram/slack/discord) + types.ts

---

## 발견사항

### [WARNING] `renderPresentationByType` — 3개 provider 에 동일 함수 복제 (DRY 위반 / 결합도)

- **위치**: `discord-message.renderer.ts:110-132`, `slack-message.renderer.ts:120-140`, `telegram-message.renderer.ts:141-168` — 세 파일 모두 동일한 `renderPresentationByType` 및 `renderPresentationPayload` 함수를 각자 보유
- **상세**: `template` 타입의 이중 경로 추출 로직(`nodeOutput.rendered` → fallback `nodeOutput.payload.rendered`)이 세 renderer 에 동일하게 복제되어 있다. 이 로직이 spec 변경(예: template output shape 변경)을 맞이하면 세 곳을 동시에 수정해야 한다. `renderPresentationPayload`의 form-skip 로직도 마찬가지다. 현재 세 구현이 정확히 일치하지만, Discord/Slack은 `_config`(미사용 파라미터)로 선언한 반면 Telegram은 `config`를 실제 사용(carousel/table/chart fallback에 전달)하는 미묘한 차이가 있어 향후 divergence 가능성이 있다.
- **제안**: `chat-channel/shared/` 하위에 `presentation-renderer.ts`를 추출하여 `renderPresentationPayload`, `renderPresentationByType` 의 공통 추출 로직을 단일 진실로 관리한다. provider별 차이(escape 방식, chunk limit)가 있는 최종 텍스트 변환만 각 renderer에 남긴다.

---

### [WARNING] `toEiaEvent` 함수 반환 타입 확장 — 단일 책임 및 추상화 경계 모호화

- **위치**: `chat-channel.dispatcher.ts:216-218` — `toEiaEvent` 반환 타입이 `EiaEvent | ChatChannelInternalEvent | null`로 변경됨
- **상세**: 함수명 `toEiaEvent`는 "EIA 이벤트로 변환"을 의미하지만, 실제 반환 타입이 `ChatChannelInternalEvent`(EIA 외부 이벤트)를 포함하게 되었다. 이 함수는 현재 EIA 5종과 internal 이벤트 1종을 모두 처리하는 복합 변환기가 됐다. 함수의 의미적 경계가 흐려졌으며, 향후 `ChatChannelInternalEvent`의 variant가 추가될수록 이 함수가 두 도메인을 동시에 담당하는 위반이 심화된다. JSDoc도 반환 union의 후자가 "EIA 화이트리스트 외"임을 인정하면서도 같은 함수에 묶어놨다.
- **제안**: `toInternalEvent(event): ChatChannelInternalEvent | null` 또는 `toNodeCompletedEvent` 처럼 분리하거나, 함수명을 `toChatChannelEvent`로 변경해 의도를 명확히 한다. 현재 규모에서는 단일 함수로 유지하더라도 함수명 변경만으로 혼란을 크게 줄일 수 있다.

---

### [WARNING] `ChatChannelInternalEvent` — `EiaEventBase` 상속으로 인한 불필요한 필드 오염

- **위치**: `types.ts:269` — `EiaNodeCompletedEvent extends EiaEventBase`
- **상세**: `EiaEventBase`는 EIA outbound 이벤트를 위한 베이스 타입(triggerId, workflowId, timestamp, executionId 등)이다. `ChatChannelInternalEvent`가 이를 extends하면 EIA 도메인의 베이스 계약을 internal 이벤트가 상속하는 구조가 된다. 현재 dispatcher의 `toEiaEvent`에서 `base` 객체를 동일하게 채우기 때문에 실용적으로는 동작하지만, 개념적으로 internal 이벤트가 EIA 계약에 결합된다. 특히 `triggerId`/`workflowId`가 `EiaEventBase`를 통해 강제되는데, internal 이벤트는 엄밀히 말해 EIA 스펙의 산물이 아니다.
- **제안**: `ChatChannelInternalEvent`용 별도 베이스 인터페이스(`ChatChannelEventBase`)를 정의하거나, 또는 현재처럼 `EiaEventBase`를 공유하되 주석으로 "routing context fields 공유 목적" 임을 명시해 의도적 결정임을 문서화한다. 후자는 이미 JSDoc에 부분적으로 설명되어 있으나 extends 관계 자체에 대한 근거가 빠져 있다.

---

### [INFO] `PRESENTATION_NODE_TYPES` Set — dispatcher와 renderer 양쪽에 분산

- **위치**: `chat-channel.dispatcher.ts:38-43` (Set 정의), 각 renderer의 `renderPresentationByType` 함수 시그니처 타입 `'carousel' | 'table' | 'chart' | 'template'`
- **상세**: 허용 presentation 노드 타입 목록이 dispatcher의 `PRESENTATION_NODE_TYPES` Set과 renderer 함수들의 union literal 타입으로 이중 관리된다. 타입 시스템 레벨에서는 `EiaNodeCompletedEvent.node.type`의 union이 단일 진실 역할을 하지만, 런타임 필터인 Set과 타입 정의가 별개로 유지된다. 새 presentation 타입이 추가되면 Set과 타입 union 두 곳을 모두 수정해야 한다.
- **제안**: `PRESENTATION_NODE_TYPES`를 `as const`로 선언하고 이로부터 타입을 derive하는 방식(`type PresentationNodeType = typeof PRESENTATION_NODE_TYPES extends Set<infer T> ? T : never`)을 고려한다. 단, 규모가 작아 현재 수준에서는 INFO로 분류.

---

### [INFO] provider renderer 함수들의 `_config` 미사용 파라미터 — Discord/Slack `renderPresentationByType`

- **위치**: `discord-message.renderer.ts:113`, `slack-message.renderer.ts:123` — `_config: ChatChannelConfig` (underscore prefix로 미사용 표시)
- **상세**: Discord/Slack의 `renderPresentationByType`은 `_config`를 받지만 사용하지 않는다. Telegram은 carousel/table/chart fallback에 `config`를 실제 전달한다. 이는 현재 v1 fallback 정책에서는 무해하지만, API 인터페이스 불일치가 발생하고 있다. 공통 추출 시 signature 통일이 필요하다.
- **제안**: 공통 헬퍼로 추출할 때 config 파라미터 필요 여부를 정리하거나, 당장은 `_config`를 제거하고 필요 시 추가하는 방향을 검토한다.

---

### [INFO] `execution.node.completed` sub-filter 로직 — dispatcher와 `toEiaEvent` 양쪽에 존재

- **위치**: `chat-channel.dispatcher.ts:98` (`SUBSCRIBED_EVENTS` 사전 체크) 및 `toEiaEvent` case 내부 (`PRESENTATION_NODE_TYPES.has(nodeType)` + blocking 체크)
- **상세**: 필터링이 두 단계로 분산되어 있다. 첫 번째 단계(`SUBSCRIBED_EVENTS`)는 이벤트 타입 수준, 두 번째(`toEiaEvent` 내부)는 payload 내 nodeType + output.status 수준이다. 이 두 단계 필터링은 의도적이며 문서화도 잘 되어 있다. 다만 `toEiaEvent`가 null을 반환하면 dispatcher에서 "결정적 진단" warn 로그를 찍도록 되어 있는데(`toEiaEvent null` 경고), `execution.node.completed`의 sub-filter에 의한 정상적인 null 반환(비-presentation 노드, blocking 케이스)도 동일 warn 경로를 타게 된다.
- **제안**: sub-filter null과 에러성 null을 구분하는 방법을 고려한다. 예: sub-filter null의 경우 dispatcher에서 debug 레벨로 로깅하거나, `toEiaEvent`가 `{event: ..., filtered: boolean}` shape를 반환하도록 변경한다. 현재는 정상적인 sub-filter null도 경고 로그에 payload keys를 dump하는 과잉 로깅이 발생할 수 있다.

---

## 요약

이번 변경은 chat-channel outbound 파이프라인에 presentation 노드 렌더링 경로를 추가한 것으로, 아키텍처 방향성은 올바르다. EIA 이벤트 타입 확장 대신 `ChatChannelInternalEvent`를 별도 타입으로 신설하고, discriminated union을 통해 renderer switch-case에 통합한 설계는 개방-폐쇄 원칙을 비교적 잘 따른다. 가장 큰 아키텍처 부채는 동일한 `renderPresentationByType` / `renderPresentationPayload` 로직이 세 provider renderer에 복제된 점으로, 이는 단일 책임 원칙보다 결합도/DRY 관점의 경고다. `toEiaEvent` 함수명이 반환 타입과 의미적으로 어긋나는 점도 추상화 레이어 경계를 흐리는 요인이다. 전반적으로 기능 동작의 정확성과 테스트 커버리지는 양호하며, 아키텍처 리스크는 중간 수준이다.

## 위험도

MEDIUM

(공통 로직 복제로 인한 향후 divergence 위험이 실질적이며, `toEiaEvent` 함수 계약 모호화가 internal 이벤트 variant 증가 시 확대될 수 있음. 즉각적인 런타임 오류 위험은 낮음.)
