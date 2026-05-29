# 테스트(Testing) 리뷰

## 발견사항

### [WARNING] form_submission 실패 경로 (검증 오류 재안내) 테스트 미존재
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `form_submission` 블록의 catch 브랜치 (라인 343–358)
- 상세: `hooks.service.spec.ts` 의 `form_submission` 테스트는 성공 경로만 커버한다. `interactionService.interact` 가 throw 하는 경우(검증 실패) `buildFormSubmissionResponse({ validationError })` 가 호출되어 `interactionHttpResponse` 를 반환하는 경로가 테스트되지 않는다. 해당 catch 브랜치는 프로덕션에서 Discord ack type-4 / Slack response_action errors 재표시를 담당하는 핵심 경로다.
- 제안: `interactionService.interact.mockRejectedValue(new Error('validation'))` + `buildFormSubmissionResponse` spy 로 catch 브랜치 케이스를 추가. 검증 오류 메시지가 `validationError.message` 에 고정 문자열("입력값을 다시 확인해주세요.")로 하드코딩되는 점도 함께 검증할 것.

### [WARNING] open_form_modal — pendingFormModal 미설정 및 adapter.openFormModal 미정의 케이스 미커버
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 라인 291–307 / `hooks.service.spec.ts`
- 상세: `open_form_modal` 블록 내부 분기에서 `state?.pendingFormModal` 이 null 이거나 `adapter.openFormModal` 이 없는 경우(Telegram처럼 `supportsNativeForm=false` 어댑터가 해당 command 를 받는 이상 경로) 단순히 `{ executionId: 'ignored' }` 를 반환하는 라인이 테스트되지 않는다. 현재 spec 상 발생하기 어려운 경로지만, 계약 위반 시 silent ignore 되므로 회귀 보호가 없다.
- 제안: `pendingFormModal` 없이 `open_form_modal` 을 수신하는 케이스, `adapter.openFormModal` 이 undefined 인 케이스 각각 단순 케이스 추가.

### [WARNING] HooksController `interactionHttpResponse` 라우팅 단위 테스트 미존재
- 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` 라인 100–105
- 상세: `hooks.controller.ts` 에 신규 추가된 `interactionHttpResponse` 분기(TransformInterceptor 우회 후 `res.status(200).json(interactionHttpResponse)` 직접 전송)에 대한 컨트롤러 레벨 단위 테스트가 없다. `hooks.service.spec.ts` 는 서비스 반환값만 검증하므로, 컨트롤러의 `res.json` 호출 여부·응답 본문 구조는 검증되지 않는다. NestJS `@Res()` 를 직접 사용하는 코드는 E2E 없이는 검증 기회가 없다.
- 제안: 컨트롤러 spec 파일이 없으므로 최소한 `hooks.controller.spec.ts` 를 생성하여 `handleWebhook` 이 `interactionHttpResponse` 를 갖는 result 를 반환할 때 `res.status(200).json(...)` 이 호출되는지, 그렇지 않을 때 일반 return 을 타는지 각 1케이스를 검증할 것.

### [WARNING] Telegram adapter — `form_modal` 도달 exhaustiveness guard 테스트 미존재
- 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` 라인 230–634 / `telegram.adapter.spec.ts`
- 상세: `telegram.adapter.ts` 에 `form_modal` case 로 `throw new Error('Telegram 은 native form modal 미지원')` 가 추가됐다. `telegram.adapter.spec.ts` 에는 이 throw 경로를 직접 검증하는 테스트가 없다. `supportsNativeForm = false` 선언도 테스트되지 않는다. 이 guard 는 renderer 계약 위반을 조기에 잡는 fail-fast 로직이므로 검증이 필요하다.
- 제안: `adapter.sendMessage({ kind: 'form_modal' }, config)` 호출 시 reject 되는 1케이스, `adapter.supportsNativeForm === false` 단언 1케이스를 추가.

### [WARNING] ChatChannelDispatcher — renderNode 예외 시 markDegraded 경로 테스트 미존재
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` 라인 211–219 / `chat-channel.dispatcher.spec.ts`
- 상세: 이번 PR 에서 `renderNode` 호출 블록이 form_modal 분기 이전으로 이동(순서 변경)되면서 이미 존재했던 renderNode 실패 → `markDegraded` 경로가 `form_modal`/`form_prompt` 분기보다 앞에 위치하게 됐다. 그런데 `chat-channel.dispatcher.spec.ts` 의 신규 테스트(`buildDispatcher` 사용)는 `renderNode` 가 성공하는 경우만 다루며, renderNode 가 throw 할 때 `markDegraded` 가 호출되고 함수가 early-return 하는지 검증하지 않는다.
- 제안: `renderNode: jest.fn().mockRejectedValue(new Error('render fail'))` 케이스 + `markDegraded` spy 호출 여부 단언 추가.

### [INFO] Slack toInputElement — select/radio/date/checkbox 4개 분기 블록 매핑 테스트 미존재
- 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts` — `toInputElement` 함수 / `slack.adapter.spec.ts`
- 상세: `slack.adapter.spec.ts` 의 `openFormModal` 테스트는 `email` (plain_text_input default) + `select` (static_select) 필드를 검증한다. `textarea` (multiline true), `date` (datepicker), `checkbox` (checkboxes), `radio` (static_select) 분기는 별도 단언이 없다. 특히 `radio` 와 `select` 가 동일 element type (`static_select`) 로 매핑되는데, 이는 Slack API 설계상 `radio_buttons` 와 다르며 의도가 맞는지 확인이 필요하다.
- 제안: `toInputElement` 의 각 switch case 를 direct test 또는 `openFormModal` 의 field type 을 변경한 추가 it() 으로 커버.

### [INFO] trigger-dto-validation.spec.ts — `native_modal` / `auto` 신규 enum 값 미테스트
- 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` 라인 285–312
- 상세: `ChatChannelUiMappingDto.formMode` 가 `multi_step | native_modal | auto` 로 확장됐으나, 기존 validation 테스트는 `multi_step` 만 통과 케이스로 갖고 있다. `native_modal`, `auto` 값이 validation 을 통과하는지, 그리고 잘못된 값(예: `"inline"`)이 `@IsIn` 에서 reject 되는지 검증이 없다.
- 제안: `formMode: 'native_modal'`, `formMode: 'auto'` 통과 케이스 및 `formMode: 'invalid_mode'` reject 케이스 추가.

### [INFO] discord.adapter — openFormModal 빈 fields / 5초과 fields 엣지 케이스 미테스트
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` — `openFormModal` 라인 770 / `discord.adapter.spec.ts`
- 상세: `openFormModal` 은 `params.fields.slice(0, 5)` 로 최대 5개로 자르지만, 6개 이상 전달 시 slice 후 5개만 modal 에 포함되는지, 빈 배열 전달 시 components 가 빈 배열인지 검증하는 테스트가 없다. form-mode 레이어에서 5초과 시 multi_step 으로 fallback 하므로 이 경로가 실제 호출될 가능성은 낮지만 방어 검증이 없다.
- 제안: 6개 fields 전달 시 `modal.data.components.length === 5` 단언 케이스 1개 추가.

### [INFO] ChatChannelDispatcher — supportsNativeForm=false 어댑터에서 form 이벤트 처리 시 pendingFormModal 미설정 경로 미커버
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` 라인 226–259 / `chat-channel.dispatcher.spec.ts`
- 상세: `buildDispatcher` 헬퍼가 항상 `supportsNativeForm: true` 어댑터를 사용한다. Telegram 처럼 `supportsNativeForm: false` 어댑터에서 form 이벤트가 도달할 때(이 경우 renderer 는 `form_prompt` 를 낼 것이지만) dispatcher 가 `state.formState` 를 설정하고 `state.pendingFormModal` 은 건드리지 않는 경로 전체를 커버하는 케이스가 없다.
- 제안: `supportsNativeForm: false` 어댑터로 form 이벤트 전달 시 `formState` 설정, `pendingFormModal` undefined 단언 케이스 추가.

## 요약

전반적으로 이번 변경은 테스트 보강이 잘 되어 있다. `form-mode.spec.ts` 가 새 공유 모듈을 충분히 커버하고, 각 provider(Slack·Discord)의 renderer/parser/adapter 에 대한 신규 테스트가 핵심 경로(form_modal 버튼 생성, modal submit 파싱, openFormModal 응답 구조)를 검증한다. 그러나 `hooks.service.ts` 의 `form_submission` catch 브랜치(검증 오류 재안내), `open_form_modal` 의 방어 경로(pendingFormModal 없음·어댑터 미지원), `HooksController` 의 `interactionHttpResponse` 라우팅, `TelegramAdapter` 의 exhaustiveness guard 및 `supportsNativeForm` 값 등 중간 위험도의 미커버 경로가 여러 곳 존재한다. 특히 Discord 스타일 modal의 경우 HTTP 응답 body 에 직접 의존하는 컨트롤러 코드가 테스트 외부에 있어 회귀 위험이 상존한다.

## 위험도

MEDIUM
