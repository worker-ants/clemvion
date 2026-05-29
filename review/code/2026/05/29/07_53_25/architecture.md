# Architecture Review — chat-channel form native modal

리뷰 대상: 28개 파일 (types.ts / form-mode.ts / dispatcher / slack·discord adapter·parser / hooks.service·controller)

---

## 발견사항

### [WARNING] ChatChannelAdapter 인터페이스: 옵션 메서드와 boolean flag 의 결합 비대칭

- 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `ChatChannelAdapter` 인터페이스
- 상세: `supportsNativeForm: boolean` 은 필수 필드로 선언하면서 `openFormModal?` / `buildFormSubmissionResponse?` 는 옵션 메서드로 선언한다. 계약 관계가 이분화되어 있어 `supportsNativeForm = true` 인 어댑터가 `openFormModal` 을 구현하지 않아도 컴파일 오류가 발생하지 않는다. 소비 측(`hooks.service.ts`)은 `adapter.openFormModal` 존재 여부를 매번 guard 해야 하고, `supportsNativeForm` 이 true 임에도 메서드가 없는 경우 silent skip 으로 끝난다.
- 제안: Discriminated union 또는 서브인터페이스 분리를 권장한다. `NativeFormAdapter extends ChatChannelAdapter { supportsNativeForm: true; openFormModal: ...; buildFormSubmissionResponse: ...; }` 형태로 정의하면 구현 일관성을 타입 시스템이 보장한다. 대안으로 `supportsNativeForm` 을 제거하고 `typeof adapter.openFormModal === 'function'` type-guard 하나로 통일해도 동등한 안전성을 확보할 수 있다.

---

### [WARNING] HooksService: 비즈니스 레이어가 프레젠테이션 레이어 관심사(HTTP 응답 body)를 직접 소유

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `handleWebhook` 반환 타입의 `interactionHttpResponse?: unknown` 필드
- 상세: `HooksService` 는 비즈니스/도메인 레이어 컴포넌트인데, Discord `{ type: 9, data }` / Slack `{ response_action: 'errors' }` 와 같은 플랫폼 특화 HTTP 응답 JSON 을 그대로 반환 타입에 포함하고 있다. `HooksController` 는 이 필드를 `res.json` 으로 직접 전송하는데, 서비스가 HTTP 응답 shape 을 "알아야" 한다는 것은 레이어 책임 오염이다. 향후 REST가 아닌 다른 전송 계층(예: gRPC, 큐 소비자)에서 HooksService를 재사용할 때 `interactionHttpResponse` 개념 자체가 무의미해진다.
- 제안: `HooksService` 가 반환하는 결과 타입은 도메인 언어(`pendingModalOpened: true`, `formSubmitted: true`, `interactionResponse: { type: 'discord_modal'; payload: unknown }` 등)로 표현하고, `HooksController` 가 이를 보고 실제 HTTP 응답 body 를 합성하는 책임을 갖도록 분리한다.

---

### [INFO] `extractFormFields` 의 이중 shape 수용: 추상화 레벨의 혼재

- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields`
- 상세: `{ fields: [...] }` (formConfig 직접) 과 `{ config: { fields: [...] } }` (nodeOutput wrapping) 두 shape 을 단일 함수에서 처리한다. 두 shape 이 존재하는 이유는 dispatcher 의 `toChatChannelEvent` 에서 nodeOutput 을 변환하는 과정의 일관성 부재에서 기인한다. 정규화가 한 곳에 모여 있는 것은 좋으나, 호출 측(`discord-message.renderer.ts`, `slack-message.renderer.ts`, `chat-channel.dispatcher.ts`) 이 각각 다른 shape 을 전달하는 구조는 contract 가 모호하다는 신호다.
- 제안: upstream(`toChatChannelEvent`)에서 항상 단일 shape 으로 정규화하여 downstream 소비자가 하나의 shape 만 다루도록 한다. 두 shape 지원이 불가피하다면 shape 에 따라 overload 함수를 분리하는 것이 명시성을 높인다.

---

### [INFO] `form_modal.formConfig: unknown` — 타입 안전성 포기

- 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `ChannelMessageBody` 의 `form_modal` variant
- 상세: `formConfig: unknown` 으로 선언하여 어댑터가 이 값을 `(modalMsg.body as { formConfig: unknown }).formConfig` 형태로 캐스팅해 접근한다. `extractFormFields` 가 runtime 에서 normalize 하므로 안전하지만, 타입 레벨에서 `formConfig` 의 shape 이 보장되지 않아 컴파일러가 오용을 감지하지 못한다.
- 제안: `formConfig` 의 타입을 최소한 `FormModalField[] | { fields: FormModalField[] }` 로 좁히거나, `fields: FormModalField[]` 로 이미 정규화된 값만 담도록 설계한다. 후자라면 dispatcher 에서 `extractFormFields` 를 호출한 뒤 정규화된 배열을 `form_modal` body 에 넣고, 어댑터는 `fields: FormModalField[]` 를 직접 읽는다.

---

### [INFO] `decideFormMode` 의 `NATIVE_MODAL_MAX_FIELDS = 5` 상수가 Discord 플랫폼 제약을 전역 기본값으로 고정

- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`
- 상세: Discord modal 의 5 TEXT_INPUT 하드 리밋을 "공통 분모"로 채택하여 Slack 어댑터도 동일한 5필드 제한을 적용받는다. Slack `views.open` 은 사실상 훨씬 더 많은 block 을 허용한다. 현재 설계는 의도적으로 "공통 최소"로 단순화한 것이나, 향후 Slack 에서 5개 초과 폼을 네이티브 modal 로 처리하려 할 때 `decideFormMode` 내부 상수 변경 없이 per-adapter 최대 필드 수를 전달할 방법이 없다.
- 제안: `DecideFormModeParams` 에 `maxFields?: number` 옵션을 추가하고, 미지정 시 `NATIVE_MODAL_MAX_FIELDS` 를 기본값으로 사용하면 provider 별 한계를 외부에서 주입할 수 있다.

---

### [INFO] `HooksController` 에서 `TransformInterceptor` 우회: 암묵적 제어 흐름

- 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` — `interactionHttpResponse` 분기
- 상세: NestJS 의 인터셉터 파이프라인을 우회하여 `res.json` 을 직접 호출하는 패턴은 컨트롤러 레이어의 일관성을 해친다. 인터셉터가 나중에 교체되거나 응답 후처리 로직이 추가될 때 이 경로만 누락될 위험이 있다.
- 제안: `interactionHttpResponse` 를 별도 엔드포인트(예: `/hooks/:id/interaction`)로 분리하거나, `@SkipInterceptors` 데코레이터·custom exception filter 방식으로 명시적으로 처리한다. 최소한 해당 코드 블록에 명확한 주석과 테스트를 유지한다(현재는 주석 있음).

---

### [INFO] `openContext: Record<string, string>` — provider 비대칭을 타입으로 숨김

- 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `OpenFormModalParams.openContext` / `ChannelCommand open_form_modal.openContext`
- 상세: Slack은 `{ triggerId }`, Discord는 `{ interactionId, interactionToken }` 을 담는데, 공통 타입을 `Record<string, string>` 으로 erasure해 버렸다. 어댑터 구현(`slack.adapter.ts`, `discord.adapter.ts`)은 필드를 직접 string 접근한다. 컴파일러가 필수 키 누락을 잡지 못한다.
- 제안: provider별 타입 `SlackOpenContext = { triggerId: string }`, `DiscordOpenContext = { interactionId: string; interactionToken: string }` 을 정의하고, `openContext` 를 union 으로 좁히거나 generic 파라미터로 처리한다. 대안으로 `ChatChannelAdapter` 의 `openFormModal` 을 generic 어댑터 자체 타입으로 캡슐화해 외부는 opaque 타입으로만 다루게 한다.

---

## 요약

이번 변경은 `shared/form-mode.ts` 를 공통 판단 모듈로 추출하고 provider 별 렌더러/파서/어댑터에서 해당 모듈을 주입하는 방식으로 모달 게이팅 로직의 중복을 효과적으로 제거한 점이 아키텍처적으로 긍정적이다. `decideFormMode` 의 전략 패턴(isFieldModalCompatible 콜백 주입)은 개방-폐쇄 원칙을 잘 준수한다. 다만 `ChatChannelAdapter` 인터페이스의 boolean 필드와 옵션 메서드 간 계약 불일치, `HooksService` 가 HTTP 응답 body(`interactionHttpResponse`)를 반환 타입에 포함하는 레이어 책임 오염, `form_modal.formConfig: unknown` 으로 타입 안전성을 포기한 점은 구조적 개선이 필요하다. 전반적으로 기능 확장성(새 provider 추가 시 `supportsNativeForm` 선언과 옵션 메서드 구현만으로 통합 가능)은 양호하나, 인터페이스 계약의 타입 레벨 강제와 레이어 분리를 보완하면 장기 유지보수성이 더욱 향상될 것이다.

## 위험도

MEDIUM

---

STATUS: SUCCESS
