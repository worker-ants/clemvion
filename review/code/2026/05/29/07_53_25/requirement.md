# 요구사항(Requirement) 리뷰 — chat-channel-form-native-modal

리뷰 일시: 2026-05-29  
대상 파일: 28개 (codebase 21개 + plan/review 7개)  
SoT spec: `spec/conventions/chat-channel-adapter.md` (§1.1, §2.1–2.3, §4, §4.1, §4.2, R-CCA-8)

---

## 발견사항

### [CRITICAL] modal open 책임이 spec §1.1 / R-CCA-8 (b) 와 다른 함수에 구현됨

- **위치**: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts` — `openFormModal()` (신규 옵션 메서드); `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` — `openFormModal()` (신규 옵션 메서드); `codebase/backend/src/modules/chat-channel/types.ts` — `ChatChannelAdapter` 인터페이스에 `openFormModal?()` 및 `buildFormSubmissionResponse?()` 추가; `codebase/backend/src/modules/hooks/hooks.service.ts` line 292 — `adapter.openFormModal(...)` 직접 호출
- **상세**: spec `chat-channel-adapter.md` §1.1 `ackInteraction` 행은 명시적으로 "§4.1 native modal 게이팅: `form_modal` 버튼 클릭 interaction 도착 시 modal open … 호출은 본 함수 안에서 수행한다"고 선언한다. R-CCA-8 세부 (b)도 "modal open 은 새 함수가 아니라 `ackInteraction` 내부 분기로 흡수 (§1.1) — R-CCA-5 / R-CCA-7 의 '새 함수 추가 = 인터페이스 drift' 정신 보존"을 명기한다. 그러나 구현은 `openFormModal?` 과 `buildFormSubmissionResponse?` 두 개의 신규 옵션 메서드를 `ChatChannelAdapter` 인터페이스에 추가하고, `HooksService` 가 `open_form_modal` command 수신 시 `ackInteraction` 대신 `adapter.openFormModal(...)` 을 직접 호출한다. `ackInteraction` 은 Slack/Discord 어댑터 모두 noop(`Promise.resolve()`) 으로 유지된다. 이는 spec 의 "6함수 계약 유지" 설계 결정과 정면 충돌한다.
- **제안**: 두 가지 해결 경로. (a) spec 준수: `openFormModal` 로직을 `ackInteraction` 내부로 이동, `ackInteraction` 이 `open_form_modal` command 도착 시 modal open + httpResponse 반환 (Discord). `buildFormSubmissionResponse` 는 별도 유틸 함수로 분리하거나 `sendMessage` 내부에서 처리. 인터페이스의 신규 옵션 메서드 삭제. (b) spec 수정: R-CCA-8 (b)를 번복하고 `openFormModal?` / `buildFormSubmissionResponse?` 신규 옵션 메서드를 공식 인터페이스에 승격 — 단 이 경우 spec 변경은 `project-planner` 위임 필요.

---

### [CRITICAL] dispatcher 의 form_prompt 경로에서 기존 `pendingFormModal` 미클리어

- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` line 248–255 — `else` 분기 (form_prompt 경로)
- **상세**: `form_modal` 메시지가 감지되면 `pendingFormModal` 을 set 하고 `formState` 를 clear 한다. 그러나 이전에 `pendingFormModal` 이 이미 set 된 상태에서 다음 form 이벤트가 도착해 form_prompt 경로(else 분기)로 분기될 때, `state.pendingFormModal` 을 clear 하지 않는다. 이로 인해 상태 불일치가 발생할 수 있다: `formState` 와 `pendingFormModal` 이 동시에 set 된 상태로 persist 될 수 있다. `hooks.service.ts` 의 `form_submission` handler (line 312)는 `state.pendingFormModal?.nodeId` 를 우선 확인하므로, 이후 사용자가 text_message 로 응답해 form_submission 이 아닌 formState 경로를 탔음에도 남아 있는 stale `pendingFormModal` 이 혼선을 야기할 수 있다.
- **제안**: else 분기에 `state.pendingFormModal = undefined;` 추가:
  ```typescript
  } else {
    state.pendingFormModal = undefined; // stale pendingFormModal 클리어
    state.formState = {
      nodeId: channelEvent.node.id,
      currentFieldIdx: 0,
      partialFormData: {},
    };
  }
  ```

---

### [CRITICAL] spec §4.1 step 5 Discord 검증 실패 재표시 미구현 — ephemeral ack 만 반환

- **위치**: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` `buildFormSubmissionResponse` (validationError 분기); `codebase/backend/src/modules/hooks/hooks.service.ts` line 347–356 (catch 블록)
- **상세**: spec §4.1 step 5 는 "Discord: 후속 메시지의 버튼 재노출로 modal 재open 유도 (Interactions 응답 후 동일 modal 재전송 불가)"라고 명시한다. 구현은 검증 실패 시 `buildFormSubmissionResponse({ validationError: { message: '입력값을 다시 확인해주세요.' } })` 를 호출해 `{ type: 4, data: { content: '⚠️ …', flags: 64 } }` ephemeral ack 만 반환한다. 버튼 재노출("양식 작성하기" 버튼 메시지 재발송)은 수행하지 않는다. Slack 은 `response_action: errors` 로 modal 유지이므로 동일 spec 조건이지만 구현 방식이 맞다. Discord 는 spec이 "후속 메시지 버튼 재노출"이라고 명시했으나 구현이 이를 누락하여, 검증 실패 후 사용자가 재시도할 수 없는 UX 결함이 발생한다.
- **제안**: Discord `buildFormSubmissionResponse` validationError 경로에서, 단순 ephemeral ack 외에 "양식 작성하기" 버튼을 재노출하는 후속 메시지 발송 메커니즘이 필요하다. 현재 구조에서는 `buildFormSubmissionResponse` 가 HTTP 응답만 합성하므로 후속 메시지를 직접 발송할 수 없다 — HooksService 의 catch 블록에서 `adapter.sendMessage` 로 버튼 메시지를 추가 발송하거나, 검증 실패 시 별도 form_modal 메시지를 sendMessage 해야 한다. spec §4.1 step 5 discord 경로와 일치시키는 방향으로 수정 필요.

---

### [WARNING] spec §4.1 step 4 클라이언트-side 검증 미구현

- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` `form_submission` 핸들러 (line 311–361)
- **상세**: spec §4.1 step 4 는 "client-side 검증 (전 필드 type/pattern/minLength — provider native 검증 우선 활용 후 어댑터 schema 검증)" 이라고 명시한다. 구현은 `update.command.fields` 를 EIA `submit_form` 에 그대로 전달하며, 어댑터 schema 검증 (pattern/email 등) 을 수행하지 않는다. provider native 검증 (Slack `min_length`/`max_length`, Discord TEXT_INPUT `required`)은 provider 가 처리하지만, 어댑터 schema 검증 계층은 누락되어 있다. 이로 인해 잘못된 형식의 이메일, 형식 미달 값 등이 EIA 까지 도달해 server-side 에서만 거부되며 사용자 경험이 악화된다.
- **제안**: `form_submission` 처리 시 `fields` 를 `pendingFormModal.fields` 의 schema(type, required, pattern 등)와 대조하는 클라이언트-side 검증 단계를 HooksService 또는 어댑터 레벨에 추가. spec 은 필수 단계로 명시했으나 현재 구현에서는 누락됨. 단, form spec §1 의 검증 규칙 정의와 통합 방안을 함께 확인 필요.

---

### [WARNING] `open_form_modal` 처리 시 `ackInteraction` 호출 누락

- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` line 291–308 — `open_form_modal` 분기
- **상세**: 다른 command 종류(cancel, text_message, button_callback 등)는 처리 후 `adapter.ackInteraction(update, config)` 를 호출한다. 그러나 `open_form_modal` 분기는 `adapter.openFormModal(...)` 호출 후 바로 return 하며 `ackInteraction` 을 호출하지 않는다. Discord 의 경우 interaction response 자체가 modal open 이므로 별도 ack 가 불필요하지만, 향후 `ackInteraction` 이 provider 특화 로직을 담을 경우 일관성 문제가 발생할 수 있다. Slack의 경우 `views.open` 호출 후 webhook 응답은 빈 200이 기대되어 있어 현재는 문제 없으나, 명시적 ack 호출 부재가 인터페이스 계약과의 불일치를 남긴다.
- **제안**: `open_form_modal` 처리 후에도 `ackInteraction` 호출을 추가하거나, 코드 주석에 "Discord 는 modal 응답이 ack 대체, Slack 은 views.open API 호출이 ack 대체 — 별도 ackInteraction 불필요" 사유를 명시한다.

---

### [WARNING] `ChannelUpdate.command.button_callback` 타입이 spec §2.1 과 불일치 (기존 drift)

- **위치**: `codebase/backend/src/modules/chat-channel/types.ts` line 122
- **상세**: spec `chat-channel-adapter.md §2.1` 은 `button_callback` 을 `{ kind: "button_callback"; callbackData: string }` 으로 선언한다. `types.ts` 는 `{ kind: 'button_callback'; callbackData: string; callbackQueryId: string }` 에 `callbackQueryId` 필드를 추가로 보유한다. 이 diff 에서 신규 도입된 내용은 아니지만, spec 이 이 필드를 공식 계약에 포함하지 않는 상태에서 구현에만 존재한다. spec 누락 또는 drift 상태.
- **제안**: spec §2.1 `button_callback` variant 에 `callbackQueryId?: string` (또는 필수 필드로) 추가를 `project-planner` 에 위임하거나, types.ts 의 추가 필드를 내부 전용으로 문서화.

---

### [WARNING] `dispatcher` 에서 renderNode 를 먼저 호출한 후 form 상태 분기 — `messages` 를 sendMessage 에도 사용

- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` line 211–260
- **상세**: 리팩터된 코드는 `renderNode` → `messages` 를 먼저 호출한 뒤, messages 내의 `form_modal` 존재 여부로 `pendingFormModal` vs `formState` 를 결정한다. 이 접근 자체는 의도 설명에 맞지만 (`renderNode` 결과를 보고 mode 결정), 상태 persist (conversationService.upsert) 실패 시 `messages` 는 이미 sendMessage 로 발송될 상태이다 (upsert 실패해도 메시지는 나간다). state persist 실패 + messages 발송 성공 시 `pendingFormModal` 이 없어 사용자가 버튼을 눌러도 state 복원 불가. 이 에러 시나리오에 대한 처리가 없다.
- **제안**: `conversationService.upsert` 실패 시 sendMessage 를 skip 하거나 에러를 상위로 전파하는 방어 코드를 추가. 혹은 spec 에 "state persist 실패는 best-effort" 정책을 명시.

---

### [INFO] `form_submission` 의 `fields` 에서 빈 값 omit 정책이 테스트에서 미검증

- **위치**: `codebase/backend/src/modules/chat-channel/providers/discord/discord-update.parser.ts` line 558 — `tc.value.length > 0` 조건; `codebase/backend/src/modules/chat-channel/providers/slack/slack-update.parser.ts` `extractElementValue` — empty string 시 `undefined` 반환
- **상세**: spec §2.1 은 "optional 필드가 빈 입력이면 해당 key 를 생략" 이라고 명시하며 구현도 이 정책을 따른다. 그러나 추가된 테스트 (`discord-update.parser.spec.ts`, `slack-update.parser.spec.ts`) 에서 optional 필드 빈 입력 시 key 생략 케이스를 직접 검증하는 테스트가 없다.
- **제안**: 빈 optional 필드 omit 케이스를 unit 테스트로 추가 ("빈 textarea → fields 에 해당 key 미포함").

---

### [INFO] `openFormModal` 에서 `pendingFormModal` 가 없을 때의 silent skip

- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` line 292 — `if (state?.pendingFormModal && adapter.openFormModal)`
- **상세**: `open_form_modal` 명령이 도착했으나 `state.pendingFormModal` 이 없는 경우 (예: 상태 만료, 재클릭 등), `adapter.openFormModal` 을 호출하지 않고 `{ executionId: 'ignored' }` 로 반환한다. 에러 로그나 사용자 안내 없이 silent return 한다. 사용자 입장에서는 버튼을 눌렀는데 아무 반응이 없는 UX.
- **제안**: `state?.pendingFormModal` 이 없을 때 경고 로그를 남기거나 에러 안내 메시지를 adapter.sendMessage 로 발송하는 방어 로직 추가.

---

### [INFO] `extractFormFields` 에서 `nodeOutput wrapping` 과 `formConfig 직접` 두 shape 를 모두 수용하나 테스트 커버리지는 형식적

- **위치**: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` `extractFormFields`; `form-mode.spec.ts`
- **상세**: `extractFormFields` 는 `{ fields: [...] }` 와 `{ config: { fields: [...] } }` 두 shape 를 수용한다. spec §2.2 `formConfig`는 `unknown` 타입이며, 실제로는 EIA context.formConfig 가 `{ fields: [...] }` shape 이다. 그러나 dispatcher 에서 `extractFormFields((modalMsg.body as { formConfig: unknown }).formConfig)` 호출 시 `formConfig` 가 `{ config: { fields: [...] } }` shape 인 경우는 실제로 발생하지 않는다 (renderer 가 EIA context.formConfig 원본을 그대로 전달). 이 second shape 지원이 dead code 일 수 있으며, 테스트에서 검증은 되어 있으나 production에서 실제 도달 여부가 불분명하다.
- **제안**: `{ config: { fields } }` shape 이 실제 production 경로에서 도달하는 경우를 주석으로 명시하거나, 불필요하면 제거.

---

## 요약

이번 변경은 Slack/Discord native form modal 게이팅 — `form_modal` 버튼 게이팅, `open_form_modal` command 처리, `form_submission` 일괄 제출, Telegram `supportsNativeForm=false` 고정 — 전반적인 흐름을 구현하고 있으며 formMode enum 확장, types, renderer, parser, dispatcher 등의 범위가 논리적으로 일관되다. 단, spec과의 가장 심각한 괴리는 **modal open 책임의 소재** 문제이다: spec §1.1 표와 R-CCA-8 (b) 는 "6함수 계약 유지, modal open 은 `ackInteraction` 내부 분기"를 명시하지만 구현은 `openFormModal?` / `buildFormSubmissionResponse?` 두 신규 옵션 메서드를 ChatChannelAdapter 인터페이스에 추가하고 HooksService 가 이를 직접 호출한다. 이 구조 자체는 기술적으로 합리적이나 spec 계약을 이탈한 구현이다. 추가로 Discord 검증 실패 재표시 (spec §4.1 step 5: "버튼 재노출")가 ephemeral ack 로 대체되어 있고, form_prompt 경로 전환 시 `pendingFormModal` 미클리어로 인한 state 불일치 위험이 존재한다. 클라이언트-side 검증(step 4)은 구현에서 누락되었다.

## 위험도

**HIGH**

> CRITICAL 3건 중 (1) `openFormModal` 신규 메서드는 spec §1.1 / R-CCA-8 (b) 와 직접 충돌하는 인터페이스 drift이며, (2) `pendingFormModal` 미클리어는 상태 불일치 버그, (3) Discord 검증 실패 재표시 누락은 §4.1 step 5 기능 미완성이다. (2)는 즉각 수정 가능하나 (1)은 spec 또는 구현 중 하나를 합의해 수정해야 한다.

---

STATUS: SUCCESS
