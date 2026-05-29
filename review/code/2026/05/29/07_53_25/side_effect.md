# 부작용(Side Effect) 리뷰 — chat-channel form native modal

검토 대상: 파일 1–29 (chat-channel native modal §4.1 구현)
검토 일시: 2026-05-29

---

## 발견사항

### [INFO] `ChatChannelAdapter` 인터페이스에 필수 속성 `supportsNativeForm` 추가 — 기존 외부 구현체 영향
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `ChatChannelAdapter` 인터페이스
- 상세: `readonly supportsNativeForm: boolean`이 선택 속성이 아닌 **필수 속성**으로 인터페이스에 추가되었다. 내부 3개 어댑터(Slack, Discord, Telegram)와 테스트 `FakeAdapter`는 모두 선언했으나, 프로젝트 외부 혹은 테스트 헬퍼 중 `ChatChannelAdapter`를 직접 구현하는 코드가 있다면 컴파일 오류가 발생한다. TypeScript 컴파일 타임에 강제되므로 런타임 부작용은 없으나, 인터페이스 하위 호환성이 단절된다.
- 제안: 단기적으로는 `supportsNativeForm?: boolean`(선택)으로 선언하고 `?? false`로 읽거나, 기존 방식대로 모든 구현체를 일괄 업데이트한다. 현재 코드베이스 내부 구현체를 모두 업데이트했으므로 내부 영향은 없다. 외부 플러그인이나 e2e mock이 있다면 추가 점검이 필요하다.

---

### [INFO] `ChannelCommand` union에 `open_form_modal`, `form_submission` 추가 — 기존 exhaustive switch 영향
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `ChannelCommand` 타입
- 상세: `ChannelCommand` union에 두 variant가 추가되었다. `update.command.kind`를 exhaustive switch로 처리하는 코드(HooksService 등)가 있다면 TypeScript strict 모드에서 `never` 케이스 오류가 발생할 수 있다. 하지만 HooksService의 처리는 if/else 체인으로 구성되어 있고 신규 variant 분기가 명시적으로 추가되어 있으므로, 이 변경 자체에서 오는 미처리 경로 누락은 없다. 다만 다른 위치에서 `ChannelCommand`를 exhaustive하게 처리하는 코드가 추가로 존재한다면 컴파일 오류가 발생할 수 있다.
- 제안: 코드베이스 전체에서 `ChannelCommand` 또는 `update.command.kind`를 switch로 처리하는 모든 위치를 grep하여 누락 케이스가 없는지 확인한다.

---

### [INFO] `ChannelMessageBody` union에 `form_modal` variant 추가 — Telegram adapter exhaustiveness 가드
- 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts`
- 상세: Telegram adapter의 `sendMessage`는 `form_modal` case에서 `throw new Error(...)` 가드를 두었다. 설계상 `supportsNativeForm=false`인 Telegram renderer는 절대 `form_modal`을 생성하지 않아야 하므로, 이 경로는 런타임에 도달하지 않는다. 그러나 만약 상위 로직이나 테스트에서 Telegram adapter에 `form_modal` 메시지를 직접 주입하면 예외가 발생하고 해당 요청이 실패한다. 이는 의도된 guard이지만, 예외 발생이 caller 에게 부작용을 준다.
- 제안: 현재 구현은 적절하다. `supportsNativeForm=false` 가드가 upstream에서 올바르게 동작하는 한 이 경로는 도달하지 않는다.

---

### [WARNING] `chat-channel.dispatcher.ts` — `renderNode` 호출 위치 이동으로 form 이벤트 외에도 `pendingFormModal` / `formState` 클리어 타이밍 변경
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` 라인 210–262
- 상세: 기존 코드는 `formState` 초기화가 **`renderNode` 호출 이전**에 수행되었다. 변경 후 코드는 `renderNode`를 **먼저 호출**한 뒤 그 결과(`messages`)를 보고 `pendingFormModal` 또는 `formState`를 분기 설정한다. 이 순서 변경으로 인해:
  1. `renderNode`가 예외를 던지면 `markDegraded`를 호출하고 즉시 `return`하므로 conversation state는 **전혀 변경되지 않는다**. 기존에는 `formState`를 먼저 설정 후 `renderNode`가 실패했으므로 state가 오염될 수 있었다. 새 순서가 더 안전하다.
  2. `renderNode`와 conversation state upsert 사이에 race condition 가능성은 기존과 동일하게 존재하며 이 변경으로 악화되지 않는다.
- 제안: 현재 변경 방향(renderNode 결과 기반 분기)이 부작용 관점에서 **개선**이다. 추가 우려 없음.

---

### [WARNING] `hooks.service.ts` — `form_submission` 처리 시 `state` 객체 직접 변이(mutation) 후 upsert
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 라인 326–332
- 상세: `state.pendingFormModal = undefined` 및 `state.lastUpdateAt = ...`으로 lookup으로 받은 `state` 객체를 직접 변이한다. 이 패턴은 `channelConversationService.lookup`이 캐시된 참조를 반환하는 경우 캐시를 오염시킬 수 있다. 만약 lookup이 Redis 등에서 역직렬화한 새 객체를 반환한다면 문제 없다. 코드베이스의 다른 위치(이전 PR에서도 동일 패턴이 사용)를 보면 이미 관용적으로 허용된 패턴으로 판단되나, lookup 구현이 내부 캐시 참조를 반환하도록 변경될 경우 위험하다.
- 제안: lookup이 항상 새 객체를 반환함을 주석 또는 타입으로 명시하거나, `{ ...state, pendingFormModal: undefined, lastUpdateAt: ... }`처럼 스프레드 복사 후 upsert하는 방어적 패턴을 채택한다.

---

### [WARNING] `hooks.service.ts` — `open_form_modal` 처리 시 `pendingFormModal` 없는 경우 silent 무시
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 라인 291–308
- 상세: `state?.pendingFormModal`이 없거나 `adapter.openFormModal`이 없으면 아무런 오류 응답 없이 `{ executionId: 'ignored' }`를 반환한다. Discord 입장에서는 반드시 유효한 HTTP 응답(type 9 또는 4)을 돌려줘야 하므로, 이 경로가 실제로 발생하면 Discord가 "이미 응답됨" 오류를 사용자에게 표시하거나 타임아웃된다. 이는 의도된 방어 코드이지만 사용자 경험 관점에서 부작용이 있다.
- 제안: `pendingFormModal`이 없는 경우에도 Discord용 fallback ack(`{ type: 4 }`)를 반환하도록 처리하거나, `this.logger.warn`으로 추적 가능한 로그를 남긴다.

---

### [INFO] `slack-update.parser.ts` — `view_submission` 처리가 `channelId` 가드 이전에 위치
- 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack-update.parser.ts` 라인 168–190
- 상세: `view_submission` 분기는 `if (typeof triggerId !== 'string' ...) return null` 가드보다 앞에 위치한다. `view_submission`의 `conversationKey`는 `private_metadata`에서 읽으므로 `channel` 객체가 없어도 처리 가능하다. 이 순서가 의도적이고 올바르다. 그러나 `channelUserKey`가 `userId`에서 읽히는데, `userId`가 없으면 `''`(빈 문자열)로 채워진다. 빈 문자열 `channelUserKey`를 가진 `ChannelUpdate`가 downstream으로 전파되면 conversation lookup이 오작동할 수 있다.
- 제안: `userId`가 없는 경우에도 `return null`로 처리하거나, downstream에서 빈 `channelUserKey` 방어 로직이 있는지 확인한다.

---

### [INFO] `discord.adapter.ts` — `openFormModal`에서 `fields.slice(0, 5)` silent truncation
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` 라인 270
- 상세: `decideFormMode`가 `fields.length > 5`이면 `multi_step`을 반환하므로, `form_modal`이 생성되는 경우는 이미 fields ≤ 5가 보장된다. 따라서 `slice(0, 5)`는 방어 코드이지만 실제로는 절대 자르지 않는다. 로직 자체의 부작용은 없으나, 만약 상위 게이팅을 우회해 fields 6개짜리 `pendingFormModal`이 저장된 경우 6번째 필드가 silent drop되어 제출 불완전이 발생할 수 있다.
- 제안: 현재 구조에서는 문제 없다. 방어 코드의 역할은 적절하다.

---

### [INFO] `FORM_OPEN_LABEL_DEFAULTS` — 새 모듈 스코프 상수 도입 (전역 변수 아님)
- 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`
- 상세: `FORM_OPEN_LABEL_DEFAULTS`는 `export const`로 선언된 불변 객체이다. 전역 상태 변경 없음, 부작용 없음.

---

### [INFO] `NATIVE_MODAL_MAX_FIELDS = 5` — 새 모듈 스코프 상수 도입
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`
- 상세: 불변 상수. 전역 상태 변경 없음.

---

### [INFO] `form-mode.ts` — 신규 파일 (`decideFormMode`, `extractFormFields`) — 순수 함수
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`
- 상세: 두 함수 모두 인자만을 읽어 새 값을 반환하는 순수 함수. 전역 상태, 파일시스템, 네트워크 호출 없음.

---

### [INFO] `slack-client.ts` — `viewsOpen` 메서드 추가 — 외부 네트워크 호출 (의도됨)
- 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts`
- 상세: Slack `views.open` API를 호출하는 메서드이다. 외부 네트워크 호출이지만 이것은 기능 목적이고 의도된 것이다. 메서드 자체는 부작용(전역 상태, 파일시스템)이 없다.

---

### [INFO] `ChatChannelUiMappingDto.formMode` enum 확장 — 기존 `'multi_step'` 전용 → `'multi_step' | 'native_modal' | 'auto'`
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- 상세: 기존 DTO validator는 `@IsIn(['multi_step'])`이었다. 이제 `['multi_step', 'native_modal', 'auto']`로 확장되었다. 기존에 `multi_step`으로 저장된 DB 레코드는 그대로 유효하다. 기존에 유효하지 않았던 `native_modal`, `auto` 값을 가진 레코드가 DB에 있다면 이제 유효해지는 **역방향 호환** 변화이다. 부작용 없음.

---

### [INFO] `hooks.controller.ts` — `interactionHttpResponse` 처리 시 `TransformInterceptor` 우회
- 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` 라인 97–106
- 상세: `res.json(interactionHttpResponse)` 직접 호출 후 `return`하여 NestJS 인터셉터 체인을 우회한다. 동일 패턴이 이미 `challenge`, `discordPing` 처리에도 사용 중이므로 일관적이다. `return` 이후 NestJS가 undefined를 반환값으로 처리할 때 인터셉터가 추가 응답을 시도할 여지가 있다. 그러나 `res.json`이 이미 응답을 송신했으므로 HTTP 응답 중복은 발생하지 않는다.
- 제안: 현재 패턴은 기존 challenge/discordPing과 동일하다. 추가 우려 없음.

---

## 요약

이번 변경은 chat-channel form native modal(§4.1) 구현으로, 새로운 타입(`supportsNativeForm`, `form_modal`, `form_submission`, `open_form_modal`, `pendingFormModal` 등)과 처리 분기를 추가한다. 전역 변수 도입이나 환경 변수의 예상치 못한 읽기/쓰기는 없다. 파일시스템 부작용도 없다. 가장 주목할 부분은 두 가지이다: 첫째, `ChatChannelAdapter` 인터페이스에 필수 속성 `supportsNativeForm`이 추가되어 기존 외부 구현체가 있다면 컴파일 오류가 발생할 수 있다(내부 구현체는 모두 업데이트됨). 둘째, `hooks.service.ts`의 `form_submission` 처리에서 lookup 객체를 직접 변이하는 기존 관용 패턴이 계속 사용되는데, lookup이 캐시 참조를 반환하는 구현으로 바뀌면 잠재적 문제가 생긴다. `renderNode` 호출을 form state 초기화 이전으로 이동한 것은 부작용 관점에서 오히려 개선이다(renderNode 실패 시 state 오염 방지). 신규 외부 네트워크 호출(`views.open`)은 의도된 것이며, 나머지 순수 함수들과 상수들은 부작용이 없다.

## 위험도

LOW
