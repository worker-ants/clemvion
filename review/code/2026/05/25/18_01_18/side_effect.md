# 부작용(Side Effect) 리뷰

**리뷰 대상**: chat-channel template/render outbound 변경 (CCH-AD-07 / CCH-MP-06)
**리뷰 일시**: 2026-05-25

---

## 발견사항

### [WARNING] `ChatChannelAdapter.renderNode` 인터페이스 시그니처 변경 — 기존 구현체 3종이 아직 `EiaEvent` 단일 타입 유지
- **위치**: `types.ts` +962 라인 (`renderNode(event: EiaEvent | ChatChannelInternalEvent, ...)`) 및 각 adapter
- **상세**: `ChatChannelAdapter` 인터페이스의 `renderNode` 파라미터가 `EiaEvent` → `EiaEvent | ChatChannelInternalEvent` union 으로 확장되었다. 그러나 세 구현체(`telegram.adapter.ts` line 123, `discord.adapter.ts` line 150, `slack.adapter.ts` line 117) 의 실제 메서드 시그니처는 여전히 `event: EiaEvent` 단일 타입으로 남아 있다. TypeScript 는 구현체 파라미터가 인터페이스보다 좁은 타입이어도 구조적 서브타이핑 상 허용하지만, `execution.node.completed` 이벤트를 `adapter.renderNode(eiaEvent, ...)` 로 디스패처가 호출할 때 런타임 동작은 각 renderer 함수(`renderTelegramMessages`, `renderDiscordEvent`, `renderSlackEvent`)에 의존한다. Renderer 함수들은 이미 확장 시그니처로 변경되었으므로 실질적 런타임 경로는 정상이나, 구현체 메서드 시그니처와 인터페이스 시그니처의 불일치가 코드베이스 일관성 문제를 낳는다. 향후 `FakeAdapter` (`channel-adapter.registry.spec.ts` line 27) 도 `EiaEvent` 단일 타입으로 남아 있어 테스트 더블이 변경된 인터페이스 계약을 검증하지 못한다.
- **제안**: `telegram.adapter.ts`, `discord.adapter.ts`, `slack.adapter.ts` 세 파일의 `renderNode` 시그니처를 `event: EiaEvent | ChatChannelInternalEvent` 로 갱신한다. `channel-adapter.registry.spec.ts` 의 `FakeAdapter.renderNode` 도 동일하게 수정한다.

---

### [WARNING] `toEiaEvent` 반환 타입 확장이 dispatcher 호출 지점에서 타입 안전하게 처리되는지 불분명
- **위치**: `chat-channel.dispatcher.ts` line 189 (`const eiaEvent = toEiaEvent(event)`) 및 line 232 (`adapter.renderNode(eiaEvent, chatChannelCfg)`)
- **상세**: `toEiaEvent` 의 반환 타입이 `EiaEvent | ChatChannelInternalEvent | null` 로 확장되었다. 디스패처 line 232 에서 `adapter.renderNode(eiaEvent, chatChannelCfg)` 로 호출하는데, 이 시점 `eiaEvent` 의 타입이 `EiaEvent | ChatChannelInternalEvent` 이지만 어댑터 구현체들의 `renderNode` 파라미터는 여전히 `EiaEvent` 단일 타입이다. TypeScript 컴파일러가 어댑터 인터페이스 파라미터(`EiaEvent | ChatChannelInternalEvent`) 기준으로 타입 체크를 통과하더라도, 구현체 파라미터가 좁은 타입(`EiaEvent`)으로 선언된 상태라면 컴파일 오류 없이 런타임에서 `execution.node.completed` 이벤트 객체가 구현체 내부에서 잘못 해석될 수 있다. 실제로는 renderer 함수가 union 타입을 받으므로 동작 자체는 맞으나, 타입 시스템의 보호망이 완성되지 않은 상태다.
- **제안**: 어댑터 구현체 3종의 `renderNode` 시그니처 수정(위 WARNING 제안과 동일)으로 해소된다. 컴파일 타임에 불일치가 노출되도록 하는 것이 부작용 예방의 핵심이다.

---

### [WARNING] `SUBSCRIBED_EVENTS` Set 에 `execution.node.completed` 추가 — 기존 이벤트 필터 로직에 대한 영향 범위 점검 필요
- **위치**: `chat-channel.dispatcher.ts` +192 라인 (`'execution.node.completed'` 추가)
- **상세**: `SUBSCRIBED_EVENTS` 는 모듈 레벨 `const` 이므로 전역 변수는 아니다. 그러나 이 Set 을 참조하는 두 지점 (line 86 — 로그 출력, line 98 — 이벤트 dispatch gate) 모두 런타임에 영향을 받는다. 기존에는 이 Set 에 없던 `execution.node.completed` 이벤트가 이제 dispatcher 에 도달하며, `toEiaEvent` 의 sub-filter(`PRESENTATION_NODE_TYPES` 체크 + `waiting_for_input` 체크)가 null 반환으로 대부분을 걸러내지만, 워크플로가 복잡한 경우 presentation 이 아닌 노드 완료 이벤트도 dispatcher 의 line 98 game 을 통과해 `toEiaEvent` 까지 진입하게 된다. 이는 의도된 설계이지만, 이벤트 볼륨이 많은 실행에서 불필요한 log 노출(line 99 이하 diagnostic log) 이 증가하는 부작용이 있다.
- **제안**: 설계 자체는 올바르다. 다만 dispatcher line 99 이하의 진단 로그가 `execution.node.completed` non-presentation 노드에도 찍히는지 확인하고, 필요하다면 `toEiaEvent` 가 null 반환하는 케이스에 대해 로그 레벨을 `debug` 로 제한한다.

---

### [INFO] `EiaAiMessageEvent` 에 `presentations?: PresentationPayload[]` 필드 추가 — 기존 코드의 `event.presentations` 접근은 문제없음
- **위치**: `types.ts` +901 라인
- **상세**: `EiaAiMessageEvent` 인터페이스에 선택 필드(`?`)로 추가되었으므로 기존 `execution.ai_message` 이벤트 처리 코드는 모두 이전과 동일하게 동작한다. `undefined`로 평가되어 기존 로직에 영향을 주지 않는다. 각 renderer의 `renderAiMessage` 함수도 `Array.isArray(presentations) && presentations.length > 0` 조건으로 방어하고 있다.
- **제안**: 조치 불필요.

---

### [INFO] `execution.ai_message` 처리 경로 변경 — `chunkText(event.message)` 직접 반환에서 `renderAiMessage(event, config)` 위임으로
- **위치**: `telegram-message.renderer.ts` +750, `discord-message.renderer.ts` +303, `slack-message.renderer.ts` +427
- **상세**: 세 renderer 모두 `execution.ai_message` case 에서 직접 `chunkText` / `renderText` 를 호출하던 것을 `renderAiMessage` 위임으로 변경했다. `renderAiMessage` 내부에서는 기존 동작(`chunkText`/`renderText`)을 먼저 수행한 뒤 `presentations`가 존재할 때만 추가 메시지를 붙인다. 기존 `presentations` 가 없는 이벤트에서는 동일한 결과를 반환하므로 회귀 부작용은 없다. 단, 세 renderer 의 `renderAiMessage` 가 동일 로직을 각각 복제하고 있어 향후 수정 시 한 곳만 고치는 실수 가능성이 있다 (DRY 위반이지만 부작용 관점 이슈는 아님).
- **제안**: 조치 불필요 (부작용 없음). DRY 개선은 별도 리팩터 작업으로 추적 가능.

---

### [INFO] 문서 파일(MDX) 변경은 순수 콘텐츠 추가이며 부작용 없음
- **위치**: `discord.en.mdx`, `discord.mdx`, `slack.en.mdx`, `slack.mdx`, `telegram.en.mdx`, `telegram.mdx`
- **상세**: 모두 기존 섹션에 설명 단락/표 행을 추가하는 순수 문서 변경이다. 기존 내용 수정 없음.
- **제안**: 조치 불필요.

---

### [INFO] `review/consistency` 및 `plan/complete` 산출물 파일 — 메타데이터 파일이므로 런타임 부작용 없음
- **위치**: `review/consistency/2026/05/25/16_53_45/`, `plan/complete/spec-draft-chat-channel-template-render-outbound.md`
- **상세**: 모두 리뷰/플랜 추적용 artifact 이며 런타임에 로드되지 않는다.
- **제안**: 조치 불필요.

---

## 요약

이번 변경의 핵심 부작용 위험은 **`ChatChannelAdapter` 인터페이스 시그니처와 세 구현체(`TelegramAdapter`, `DiscordAdapter`, `SlackAdapter`) 의 `renderNode` 파라미터 타입 불일치** 에 있다. 인터페이스는 `EiaEvent | ChatChannelInternalEvent` 로 확장되었으나 구현체들은 여전히 `EiaEvent` 단일 타입으로 남아 있어 TypeScript 타입 보호망이 완성되지 않은 상태다. 실제 런타임 경로는 renderer 함수가 이미 union 타입을 받으므로 동작 오류는 발생하지 않으나, `FakeAdapter` 를 포함한 테스트 더블이 변경된 계약을 검증하지 못하는 점이 향후 회귀 위험으로 남는다. 나머지 변경(신규 `PRESENTATION_NODE_TYPES` Set, `presentations?` 옵셔널 필드, renderer 내 `renderAiMessage` 위임) 은 기존 코드 경로를 방어적으로 래핑하거나 선택 필드로 추가하여 의도하지 않은 상태 변경이나 외부 호출 부작용을 일으키지 않는다.

## 위험도

**LOW**

(런타임 동작 오류 없음. 인터페이스-구현체 시그니처 불일치는 타입 안전성 미완성으로 향후 확장 시 부작용 유발 가능성이 있어 LOW 유지.)
