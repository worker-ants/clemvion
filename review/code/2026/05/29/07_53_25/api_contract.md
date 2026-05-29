# API 계약(API Contract) 리뷰

검토 대상: chat-channel-form-native-modal PR (§4.1 native modal 게이팅)
검토 파일: 29개 파일 (types.ts, hooks.controller.ts, hooks.service.ts, discord/slack adapter, parser, renderer, DTO 등)

---

## 발견사항

### [WARNING] `ChannelCommand.open_form_modal.openContext` 타입이 `Record<string, string>` — provider 별 shape 불투명
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `ChannelCommand` union, `OpenFormModalParams.openContext`
- 상세: `openContext: Record<string, string>` 으로 선언되어 Slack(`{ triggerId }`)과 Discord(`{ interactionId, interactionToken }`)의 필드 구조가 타입 레벨에서 검증되지 않는다. HooksService 에서 이 객체를 adapter 에 그대로 전달하므로, 잘못된 키를 가진 openContext 가 런타임 silently 전달될 수 있다. adapter 별 openContext 타입을 branded 타입 또는 discriminated union 으로 좁히는 것이 권장된다.
- 제안: `openContext: SlackOpenContext | DiscordOpenContext` 형태의 discriminated union 을 `OpenFormModalParams` 에 적용하거나, 최소한 adapter 내부에서 필요 키 존재 여부를 assert 후 에러를 던지도록 방어 코드를 추가한다.

### [WARNING] `interactionHttpResponse` 필드가 `unknown` 타입 — 응답 형식 계약 미정형
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (반환 타입 선언), `hooks.controller.ts` (res.json 직접 전송)
- 상세: `interactionHttpResponse?: unknown` 으로 선언되어 있어 컴파일 시 Discord의 `{ type: 9, data }` 또는 Slack의 `{ response_action: 'errors', errors }` 형식의 적법성을 타입 시스템이 보장하지 않는다. 또한 controller 가 `res.status(200).json(interactionHttpResponse)` 로 직접 내보내면서 TransformInterceptor 를 우회하기 때문에, 향후 글로벌 응답 래핑 변경 시 이 경로만 누락될 위험이 있다.
- 제안: `InteractionHttpResponse` 인터페이스를 별도 정의하거나, 최소한 `{ type: number; data?: unknown } | { response_action: string; errors?: unknown }` 형태의 union 타입을 도입하여 계약을 명시한다.

### [WARNING] `ChannelMessageBody.form_modal.formConfig` 가 `unknown` 타입 — 하위 소비자 무방비
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `ChannelMessageBody` union
- 상세: `{ kind: 'form_modal'; openLabel: string; formConfig: unknown }` 로 선언되어 있어 adapter 의 `sendMessage` 에서 formConfig 를 소비할 때 형변환(`as { formConfig: unknown }`)을 강제한다. Discord adapter 에서 실제로 이 패턴이 나타난다 (`(modalMsg.body as { formConfig: unknown }).formConfig`). 이는 타입 안전성을 약화시킨다.
- 제안: `formConfig: FormConfig` 또는 최소한 `formConfig: { fields?: unknown[] }` 로 좁혀 소비 측의 타입 단언을 제거한다.

### [INFO] `formMode` DTO enum 확장은 하위 호환 — 신규 값 추가이므로 기존 클라이언트 영향 없음
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- 상세: `formMode` 가 `'multi_step'` 단일 값에서 `'multi_step' | 'native_modal' | 'auto'` 로 확장되었다. 기존에 `multi_step` 을 전달하던 클라이언트는 여전히 유효하다. default 가 `'multi_step'` 에서 `'auto'` 로 변경되었으나, 해당 default 는 Swagger 문서 용이고 `@IsOptional()` 이므로 미전달 시 런타임 기본값은 코드 로직에 의존한다 — 이 부분이 breaking change 로 작용하지 않는지 확인 필요.
- 제안: `formMode` 를 명시하지 않은 기존 trigger 레코드가 코드 상에서 `undefined` → `auto` 로 treated 되는 경로를 명확히 문서화한다. `decideFormMode` 에서 `formMode === undefined` 는 `auto` 와 동일하게 처리되므로 breaking 아님 — 확인 완료.

### [INFO] `openFormModal` / `buildFormSubmissionResponse` 가 optional interface 메서드 — 타입 가드 의존
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `ChatChannelAdapter` interface, `hooks.service.ts`
- 상세: 두 메서드 모두 optional (`?:`) 로 선언되어 `supportsNativeForm = true` 인 adapter 가 이를 구현하지 않아도 컴파일 에러 없이 통과된다. HooksService 에서 `adapter.openFormModal` 존재 여부를 type-guard 로 확인하므로 런타임 NPE 는 방지되지만, 미구현 adapter 가 `supportsNativeForm = true` 를 선언하면 `open_form_modal` command 를 silently 무시한다.
- 제안: `supportsNativeForm = true` 이면 `openFormModal` / `buildFormSubmissionResponse` 구현을 강제하는 별도 interface (`NativeFormAdapter extends ChatChannelAdapter`)를 도입하거나, 최소한 `openFormModal` 미존재 시 경고 로그를 추가하여 누락 가시성을 확보한다.

### [INFO] Slack `view_submission` 의 `conversationKey` 가 `view.private_metadata` 에 의존 — 빈 문자열 시 무음 실패
- 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack-update.parser.ts` — `parseInteractivity`
- 상세: `view_submission` 시 `conversationKey = view.private_metadata ?? ''` 로 fallback 처리하고 있으나, `private_metadata` 가 누락되거나 빈 문자열인 경우 `conversationKey = ''` 로 HooksService 에 전달된다. HooksService 에서 빈 conversationKey 에 대해 명시적 reject 가 없으면 state lookup 이 `null` 을 반환하고 submit_form 이 호출되지 않는 무음 실패가 된다.
- 제안: parser 레벨에서 `private_metadata` 가 유효하지 않으면 `null` 반환(무시)하거나, HooksService 에서 `conversationKey` 가 빈 문자열인 경우 명시적 에러 로그를 남긴다.

### [INFO] Discord `form_submission` 에서 빈 값 필드 완전 제거 — 필수 필드 누락 무음 처리
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord-update.parser.ts` — MODAL_SUBMIT `clemvion_form` 분기
- 상세: `tc.value.length > 0` 조건으로 빈 값 필드를 `fields` 에서 제거한다. 이는 optional 필드에는 적절하지만, required 필드가 빈 값으로 제출된 경우 서버 측 `submit_form` 에서 해당 필드가 누락된 채 전달되므로 EIA 검증이 실패할 수 있다. Slack 의 경우 `extractElementValue` 에서도 동일하게 빈 값 omit 로직이 있다.
- 제안: required 필드 검증은 EIA(서버) 가 담당하는 구조라면 현재 설계로 충분하나, 검증 실패 시 Discord 는 동일 modal 재전송이 불가(providers/discord §5.3 명시)하므로 UX 상 문제가 발생할 수 있다. 이 제약을 테스트 케이스 또는 주석으로 명시할 것을 권장한다.

---

## 요약

이번 변경은 chat-channel 의 form 처리를 기존 다단계(text prompt) 에서 native modal (Slack views.open / Discord MODAL type:9) 로 격상하는 §4.1 구현이다. API 계약 관점에서 가장 주목할 변경은 세 가지이다. 첫째, `ChannelCommand` union 에 `open_form_modal` / `form_submission` 두 variant 가 추가되었고(additive, 하위 호환), `ChatChannelAdapter` 인터페이스에 `supportsNativeForm` 필드 및 optional 메서드 두 개가 추가되었다(기존 구현체에 required 필드가 아니므로 하위 호환). 둘째, `formMode` DTO enum 이 `multi_step` 단일에서 `multi_step | native_modal | auto` 로 확장되었고, 미전달 시 `auto` 기본 동작이 적용된다(기존 explicit `multi_step` 클라이언트는 영향 없음). 셋째, HooksController 가 `interactionHttpResponse` 존재 시 `res.json` 으로 직접 응답을 내보내 TransformInterceptor 를 우회하는 새 경로가 생겼는데, 이 경로는 타입 계약이 `unknown` 으로 약하여 향후 유지보수 위험을 내포한다. 전반적으로 breaking change 는 없으나, openContext 타입 불투명, formConfig/interactionHttpResponse 의 `unknown` 타입 사용, supportsNativeForm 강제 미흡, Slack private_metadata 빈 값 무음 실패 가능성이 WARNING/INFO 수준의 계약 취약점으로 발견되었다.

---

## 위험도

MEDIUM
