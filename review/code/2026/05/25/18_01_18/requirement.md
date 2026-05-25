# 요구사항(Requirement) 리뷰 — chat-channel-template-render-outbound

**리뷰 일시**: 2026-05-25
**대상 브랜치**: claude/undici-autoselectfamily-b938d3
**리뷰어**: requirement reviewer (sub-agent)

---

## 발견사항

### [CRITICAL] CCH-AD-07 / CCH-MP-06 / R-CCA-7 / §1.3 — spec 본문에 존재하지 않는 요구사항 ID 참조

- **위치**: `chat-channel.dispatcher.ts` (diff lines 189–194, 228–229, 540), `chat-channel.dispatcher.spec.ts` (diff lines 38–44), `telegram-message.renderer.ts` (diff lines 793, 800), `discord-message.renderer.ts` (diff lines 85, 94), `slack-message.renderer.ts` (diff lines 91, 95), `types.ts` (diff lines 913–917, 921)
- **상세**: 코드 및 테스트 전반에 `CCH-AD-07`, `CCH-MP-06`, `R-CCA-7`, `spec/conventions/chat-channel-adapter.md §1.3` 가 SoT 로 인용되어 있다. 그러나 실제 spec 을 확인한 결과:
  - `spec/5-system/15-chat-channel.md §3.1` 에는 `CCH-AD-07` 행이 없다. 마지막 행은 `CCH-AD-06` (InteractionService.interact 인바운드 처리) 이다.
  - `spec/5-system/15-chat-channel.md §3.3` 에는 `CCH-MP-06` 행이 없다. 마지막 행은 `CCH-MP-05` 이다.
  - `spec/conventions/chat-channel-adapter.md` 에는 `§1.3` 절이 없다. `§1.2 EiaEvent 입력` 다음은 `§2. 데이터 타입` 이다.
  - `spec/conventions/chat-channel-adapter.md` 에는 `R-CCA-7` 이 없다. Changelog에도 해당 식별자 없음.
  - `spec/conventions/chat-channel-adapter.md §3` 매핑 표에 `execution.node.completed` 행이 없다.
  - `spec/conventions/chat-channel-adapter.md §1.2` 의 `EiaEvent` union 에 `presentations?: PresentationPayload[]` 필드가 없다.
- **영향**: 코드가 존재하지 않는 spec 요구사항을 SoT 로 참조하고 있어, spec-code fidelity 가 완전히 깨진 상태이다. 구현은 실제로 pending spec 갱신안(`plan/in-progress/spec-draft-...md` → 현재 `plan/complete/spec-draft-chat-channel-template-render-outbound.md` 로 이동) 에 기반하여 작성되었으나, spec 파일(`chat-channel-adapter.md`, `15-chat-channel.md`) 은 아직 갱신되지 않았다.
- **제안**: spec 갱신 없이 코드만 머지되면 SDD 원칙 위반. `spec/conventions/chat-channel-adapter.md` 및 `spec/5-system/15-chat-channel.md` 에 `§1.3 ChatChannelInternalEvent`, `CCH-AD-07`, `CCH-MP-06`, `R-CCA-7` 을 정식으로 추가해야 한다. spec 갱신 후 코드의 SoT 주석이 정합해진다.

---

### [CRITICAL] `renderNode` 인터페이스 시그니처 — spec 본문 (chat-channel-adapter.md §1) 과 불일치

- **위치**: `types.ts` diff lines 958–965 (`ChatChannelAdapter.renderNode` 변경), `spec/conventions/chat-channel-adapter.md` line 41
- **상세**: spec `chat-channel-adapter.md §1` (Interface) 의 `renderNode` 시그니처는 현재 `renderNode(event: EiaEvent, config: ChatChannelConfig): Promise<ChannelMessage[]>` 이다. 코드에서는 `renderNode(event: EiaEvent | ChatChannelInternalEvent, config: ChatChannelConfig): Promise<ChannelMessage[]>` 로 변경되었다. spec 본문이 아직 이 변경을 반영하지 않아 spec 과 구현 간 시그니처 불일치가 발생한다.
- **제안**: spec `chat-channel-adapter.md §1` Interface block 의 `renderNode` 시그니처를 구현과 동일하게 갱신해야 한다. Changelog 도 동반 갱신.

---

### [WARNING] `execution.ai_message` → `presentations[]` 전달 누락 — dispatcher 의 `toEiaEvent` 에서 `presentations` 필드 미포함

- **위치**: `chat-channel.dispatcher.ts` diff lines 466–478 (`execution.ai_message` case)
- **상세**: `types.ts` 의 `EiaAiMessageEvent` 에 `presentations?: PresentationPayload[]` 필드가 추가되었고, `telegram-message.renderer.ts` / `discord-message.renderer.ts` / `slack-message.renderer.ts` 의 `renderAiMessage` 함수가 이 필드를 읽어 sequential 발송한다. 그러나 `chat-channel.dispatcher.ts` 의 `toEiaEvent` 함수에서 `execution.ai_message` case 를 처리할 때 `presentations` 필드를 payload 에서 추출하는 코드가 존재하지 않는다 (diff 의 `execution.ai_message` case 는 `presentations` 없이 5개 필드만 반환). 결과적으로 렌더러가 `presentations` 를 항상 `undefined` 로 받게 되어 CCH-MP-01 보강 기능(AI Agent render_* presentations[] sequential 발송)이 동작하지 않는다.
- **위치(코드)**: `chat-channel.dispatcher.ts` 의 `case 'execution.ai_message'` 반환 객체에 `presentations: (event.payload as { presentations?: unknown[] }).presentations` 누락.
- **제안**: `toEiaEvent` 의 `execution.ai_message` case 에 `presentations` 필드 추출 및 전달 코드를 추가해야 한다.

---

### [WARNING] `renderPresentationByType` — `carousel` / `table` / `chart` 에 `nodeOutput` 직접 전달 시 payload 추출 이중성

- **위치**: `discord-message.renderer.ts` diff line 127–129, `slack-message.renderer.ts` diff line 137, `telegram-message.renderer.ts` diff lines 856–861
- **상세**: `renderPresentationByType` 에서 `carousel` / `table` / `chart` 케이스는 `const payload = nodeOutput.payload ?? (nodeOutput as unknown)` 로 payload 를 추출한 후 `renderVisualFallback(type, payload)` / `renderCarouselFallback(nodeOutput, ...)` 등을 호출한다. Telegram 의 경우 `renderCarouselFallback(nodeOutput, config)` 로 `nodeOutput` 전체를 전달하는 반면, Discord/Slack 은 `renderVisualFallback(type, payload)` 로 payload 추출 후 전달한다. `execution.node.completed` 에서 `output = { payload: { items: [...] } }` 형태가 오면 `nodeOutput.payload` 에서 꺼내지만, `payload = undefined` 인 경우에는 `nodeOutput` 전체가 fallback 으로 전달되어 fallback 함수가 예상치 못한 shape 을 받을 수 있다.
- **제안**: `carousel`/`table`/`chart` 케이스에서 `nodeOutput.payload` 가 없을 때의 동작을 명시적으로 처리하거나, 상위에서 payload wrapping을 보장해야 한다.

---

### [WARNING] spec `chat-channel-adapter.md §3` 매핑 표 — `execution.ai_message` 행이 `presentations[]` 출력을 기술하지 않음

- **위치**: `spec/conventions/chat-channel-adapter.md` line 248
- **상세**: 현재 §3 매핑 표의 `execution.ai_message` 행은 "출력 ChannelMessage 시퀀스 = `text` 1건 (chunked 가능)" 으로만 정의되어 있다. 이번 변경으로 `presentations?[]` 가 있을 때 추가 ChannelMessage 시퀀스가 sequential 발송되는 정책이 구현되었으나, spec 매핑 표에 이 출력 계약이 반영되지 않았다.
- **제안**: spec 매핑 표의 `execution.ai_message` 행 출력 컬럼을 "`text` 1건 (chunked 가능). `presentations?[]` 있으면 4종 presentation payload 를 sequential ChannelMessage 추가 (form 제외)" 수준으로 갱신해야 한다. spec 갱신 전까지는 spec 과 구현 간 괴리가 존재한다.

---

### [WARNING] `telegram-message.renderer.ts` 의 `renderTelegramMessages` switch — exhaustive return 보장 미흡

- **위치**: `telegram-message.renderer.ts` diff lines 759–762
- **상세**: `renderTelegramMessages` 의 switch 문에 `default` 케이스가 없다. TypeScript 타입 상으로는 `EiaEvent | ChatChannelInternalEvent` 의 모든 `type` 을 case 로 덮으면 exhaustive 하지만, 실제 코드 diff 를 보면 `case 'execution.node.completed':` 추가 후 switch 가 명시적 `default: return []` 없이 닫힌다. 기존 코드도 마찬가지이나, union 이 확장된 이 시점에서 누락된 타입이 있을 경우 TypeScript 가 암묵적 `undefined` 를 반환할 수 있다 (함수 반환 타입 `ChannelMessage[]` 위반). Discord/Slack renderer 는 `default: return []` 을 유지하고 있어 비일관적이다.
- **제안**: `renderTelegramMessages` 의 switch 에도 `default: return []` 을 추가해 방어적 exhaustive 처리를 일치시킨다.

---

### [INFO] 테스트 커버리지 — Slack / Discord renderer 의 `execution.ai_message` + `presentations[]` 테스트 없음

- **위치**: 변경된 파일 중 `discord-message.renderer.ts`, `slack-message.renderer.ts` 의 renderer spec 파일이 diff 에 포함되지 않음.
- **상세**: `telegram-message.renderer.spec.ts` 에는 `execution.ai_message + presentations[]` sequential 발송 테스트(CCH-MP-01 보강)가 추가되었다. 그러나 Slack/Discord renderer 에는 동일한 테스트가 없다. Slack/Discord renderer 의 `renderAiMessage` 함수는 Telegram 과 동일한 로직이지만 별도 시각 fallback 함수 (`renderVisualFallback`) 를 쓰므로 실제 동작 검증이 필요하다.
- **제안**: Slack/Discord renderer spec 에도 `execution.ai_message + presentations[]` sequential 발송 테스트를 추가하는 것을 권장한다.

---

### [INFO] `PresentationPayload.payload` 의 `form` type 처리 — `renderPresentationPayload` 의 방어 코드 범위

- **위치**: `discord-message.renderer.ts` diff line 102, `slack-message.renderer.ts` diff line 112, `telegram-message.renderer.ts` diff line 821
- **상세**: `renderPresentationPayload` 에서 `presentation.type === 'form'` 을 early return 으로 skip 하고 있다. 이는 spec 의도와 부합한다. 그러나 `renderPresentationByType` 함수 자체의 타입 시그니처는 `type: 'carousel' | 'table' | 'chart' | 'template'` 으로 `form` 을 배제하고 있어, TypeScript 타입상으로도 `form` 이 이 함수에 도달하지 않는다. 현재 방어 코드가 타입 수준과 런타임 수준 모두에서 올바르게 처리되고 있다.
- **제안**: 조치 불필요.

---

### [INFO] 문서 파일 (MDX) — spec 본문 아닌 사용자 문서 — spec 갱신 없이 선행 반영

- **위치**: `discord.en.mdx`, `discord.mdx`, `slack.en.mdx`, `slack.mdx`, `telegram.en.mdx`, `telegram.mdx` (파일 8–13)
- **상세**: 사용자 facing 문서에 Template/AI Agent render 도구 동작이 기술되었다. 이 내용은 spec 에서 아직 공식화되지 않은 `CCH-MP-06` / `CCH-AD-07` 을 사실상 설명하고 있다. spec 갱신 전 사용자 문서 선행 반영은 product-spec-code 3자 정합 관점에서 비일관적이나, 문서 내용 자체는 구현된 기능을 정확히 설명하고 있다.
- **제안**: spec 갱신 시 사용자 문서 내용과 일치하는지 최종 확인.

---

## 요약

이번 변경은 chat-channel 어댑터에 (1) 비-blocking presentation 노드(`template`/`carousel`/`table`/`chart`)의 `execution.node.completed` 이벤트 처리(CCH-MP-06), (2) AI Multi Turn `ai_message.presentations[]` sequential 발송(CCH-MP-01 보강)을 추가한 것으로, 기능 의도와 구현 방향은 올바르다. 그러나 **CRITICAL 2건**이 있다: 코드가 인용하는 spec 요구사항 ID(`CCH-AD-07`, `CCH-MP-06`, `R-CCA-7`, `§1.3`)가 spec 본문에 존재하지 않으며, `renderNode` 시그니처 변경이 `chat-channel-adapter.md §1` 에 반영되지 않았다. 또한 **WARNING 3건**이 있는데, 특히 `toEiaEvent` 의 `execution.ai_message` case 에서 `presentations` 필드를 추출하지 않아 CCH-MP-01 보강 기능이 실제로 동작하지 않는 구현 결함이 발견되었다. spec 갱신을 포함하는 별도 커밋 또는 PR 이 반드시 동반되어야 한다.

## 위험도

**HIGH**

(spec-code fidelity 2건 CRITICAL + `presentations` 필드 미전달로 인한 CCH-MP-01 보강 기능 미동작 WARNING 이 합산. 기능 자체가 일부 동작하지 않으며 spec 참조가 존재하지 않는 ID 를 가리키고 있어 HIGH 판정.)
