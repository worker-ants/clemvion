# 유지보수성(Maintainability) 코드 리뷰

리뷰 대상: chat-channel form native modal 구현 (파일 1~27 기준, spec/plan/review 산출물 제외)
리뷰 일시: 2026-05-29

---

## 발견사항

### [WARNING] `form-mode.ts` `extractFormFields` 함수 — 중첩 삼항 연산자로 가독성 저하
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` `extractFormFields` 내 `rawFields` 결정 블록 (라인 ~1888~1894)
- 상세: `rawFields` 를 결정하는 로직이 `Array.isArray(root.fields) ? ... : root.config && typeof root.config === 'object' && Array.isArray(...) ? (...) : []` 형태의 3항 중첩 식이다. "직접 fields" 와 "nodeOutput wrapping shape" 두 경우를 조건 삼항 체인으로 처리하여 한 번에 파악하기 어렵다.
- 제안: 아래처럼 early-return 패턴 또는 명시적 if-else 블록으로 펼치면 의도가 즉시 파악된다.
  ```ts
  let rawFields: unknown[];
  if (Array.isArray(root.fields)) {
    rawFields = root.fields;
  } else if (root.config && typeof root.config === 'object') {
    const cfg = root.config as Record<string, unknown>;
    rawFields = Array.isArray(cfg.fields) ? (cfg.fields as unknown[]) : [];
  } else {
    rawFields = [];
  }
  ```

---

### [WARNING] `discord.adapter.ts` `openFormModal` — 매직 넘버 `5` 와 하드코딩 문자열
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` `openFormModal` (라인 ~770)
- 상세: `params.fields.slice(0, 5)` 에서 `5` 가 하드코딩되어 있다. `form-mode.ts` 에 이미 `NATIVE_MODAL_MAX_FIELDS = 5` 상수가 정의되어 있는데 어댑터에서 별도로 리터럴을 사용하고 있다. 또한 modal title `'양식'`, submit `'제출'`, close `'취소'` 가 하드코딩되어 있다 — `openLabel` 이 외부에서 주입되는 것과 일관되지 않다.
- 제안: `slice(0, NATIVE_MODAL_MAX_FIELDS)` 로 공유 상수를 사용하고, modal title/submit/close 라벨은 `languageHints` 나 `resolveFormOpenLabel` 과 유사한 다국어 룩업 함수를 통해 결정하거나, `OpenFormModalParams` 에 `title?: string` 을 추가해 caller 가 주입할 수 있도록 한다.

---

### [WARNING] `hooks.service.ts` `form_submission` 처리 블록 — 함수 길이·단일 책임 위반
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 라인 ~2428~2478
- 상세: `form_submission` 분기 블록(약 50줄)이 단일 메서드 안에서 (1) state 검증, (2) EIA interact 호출, (3) state clear + upsert, (4) httpResponse 합성, (5) 검증 오류 fallback 구성 등 여러 책임을 직렬로 처리한다. try-catch 안팎으로 중첩이 3단까지 도달하고, `state?.executionId ?? 'ignored'` 패턴이 동일 블록에서 4회 이상 반복된다.
- 제안: `handleFormSubmission(update, state, trigger, config, adapter)` 형태의 private helper 로 추출하여 `handleWebhook` 의 분기 점프 패턴을 단순화한다. `executionId ?? 'ignored'` 는 헬퍼 함수나 상수로 추출할 것.

---

### [WARNING] `open_form_modal` 처리 — `pendingFormModal` 부재 시 silent no-op
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `open_form_modal` 분기 (라인 ~2409~2425)
- 상세: `state?.pendingFormModal` 이 없거나 `adapter.openFormModal` 이 없을 때 `{ executionId: state?.executionId ?? 'ignored' }` 를 그냥 반환하고, 어떠한 로그도 남기지 않는다. 이는 디버깅 시 "버튼 클릭 → modal 안 열림" 원인을 추적하기 매우 어려운 silent failure 패턴이다.
- 제안: `pendingFormModal` 이 없거나 `openFormModal` 메서드가 없는 경우 `this.logger.warn(...)` 을 추가해 운영 추적성을 확보한다.

---

### [WARNING] `discord-update.parser.ts` — `form_submission` 필드 추출 로직이 인라인으로 구현됨 (중복 위험)
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord-update.parser.ts` MODAL_SUBMIT `clemvion_form` 분기 (라인 ~554~572)
- 상세: `components.flatMap((c) => c.components ?? [])` 로 평탄화 후 `custom_id`/`value` 를 추출하는 로직이 파서 내부에 인라인으로 구현되어 있다. Slack 의 경우 `flattenViewStateValues` / `extractElementValue` 라는 독립 헬퍼 함수로 분리되어 명확한 이름을 가지는 것과 대조적이다.
- 제안: `flattenDiscordModalComponents(components)` 와 같은 명명된 헬퍼로 분리하여 테스트 가능성을 높이고 Slack 측 구조와 대칭성을 맞춘다.

---

### [WARNING] `hooks.controller.ts` — `interactionHttpResponse` 존재 여부 확인 시 `as unknown as` 이중 캐스팅
- 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` 라인 ~2231~2237
- 상세: `(result as unknown as { interactionHttpResponse?: unknown }).interactionHttpResponse` 로 반환값 타입을 강제 캐스팅한다. 이는 `handleWebhook` 의 반환 타입이 `interactionHttpResponse` 를 포함하지 않는다는 것을 암시하며, 반환 타입과 실제 런타임 형태 간의 불일치가 존재한다.
- 제안: `handleWebhook` 반환 타입 정의에 `interactionHttpResponse?: unknown` 을 정식으로 포함시켜 캐스팅 없이 접근할 수 있도록 한다. 타입이 이미 선언되어 있다면 컨트롤러에서 해당 필드를 직접 접근할 수 있다.

---

### [WARNING] `slack-update.parser.ts` `flattenViewStateValues` — 주석과 구현의 불일치 가능성
- 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack-update.parser.ts` `flattenViewStateValues` 함수 (라인 ~1244~1252)
- 상세: 함수 주석에 "action_id 는 상수 'v' 라 단일 inner element 만 존재 — 첫 key 의 값을 읽는다" 고 명시되어 있다. 그러나 구현은 `Object.keys(inner)[0]` 으로 첫 번째 key 를 읽는데, action_id 가 외부 시스템에 의해 다를 경우 이 가정이 깨질 수 있다. 주석은 불변 가정을 설명하지만 코드는 방어적으로 동작하지 않는다.
- 제안: action_id 가 `'v'` 인지 검증하거나, 주석에 "외부 Slack payload 가 다른 action_id 를 사용할 경우 여전히 첫 key 의 값을 읽으므로 의도치 않은 동작이 가능하다" 는 경고를 추가해 주석-코드 간 정합성을 명확히 한다.

---

### [WARNING] `discord.adapter.ts` `buildFormSubmissionResponse` — 하드코딩된 한국어 UI 문자열
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` `buildFormSubmissionResponse` (라인 ~806~813)
- 상세: `'⚠️ ${params.validationError.message}'` 와 `'✅ 제출되었습니다.'` 가 메서드 내부에 하드코딩되어 있다. Slack adapter 의 `buildFormSubmissionResponse` 는 이런 문자열이 없고 구조적 응답만 반환한다. 이모지(`⚠️`, `✅`) 는 일부 환경에서 렌더링 문제를 유발할 수 있고, '제출되었습니다.' 는 KO 고정으로 국제화가 불가하다.
- 제안: Slack 방식처럼 응답 ack 의 content 는 validationError.message 만 사용하거나, `resolveFormOpenLabel` 류의 i18n 함수를 통해 성공/오류 메시지를 해결한다. 또는 `FORM_OPEN_LABEL_DEFAULTS` 처럼 Discord 전용 메시지 상수를 `language-hint-defaults.ts` 에 추가한다.

---

### [INFO] `channel-adapter.registry.spec.ts` `FakeAdapter` — `supportsNativeForm = false` 하드코딩
- 위치: `codebase/backend/src/modules/chat-channel/channel-adapter.registry.spec.ts` 라인 35
- 상세: `FakeAdapter` 의 `supportsNativeForm = false` 는 인터페이스 계약을 만족하기 위한 최소값이다. 레지스트리 테스트의 목적상 이 값은 테스트 시나리오에 영향을 주지 않으나, 향후 레지스트리가 `supportsNativeForm` 을 기반으로 동작을 변경할 경우 숨은 가정이 될 수 있다.
- 제안: 현재 값으로 충분하나, 레지스트리 테스트가 `supportsNativeForm` 에 의존하는 동작을 검증하는 케이스가 추가될 경우 `FakeAdapter` 를 파라미터화된 팩토리 함수로 전환하는 것을 검토한다.

---

### [INFO] `slack.adapter.ts` `toInputElement` — `default` case 의 fallback 범위가 암묵적
- 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts` `toInputElement` 함수 (라인 ~1536~1564)
- 상세: `switch(f.type)` 의 `default` 가 "text / email / number / phone (+ unknown fallback)" 라고 주석으로 설명되어 있으나, 실제로 지원되지 않는 타입이 들어와도 `plain_text_input` 으로 처리된다. 이는 의도적 방어 코드이지만, 알 수 없는 타입이 들어올 때 경고 없이 동작이 계속되어 예상치 못한 사용자 경험을 유발할 수 있다.
- 제안: default case 에서 `f.type` 이 알려진 text 계열 타입이 아닌 경우 `this.logger.warn` 또는 적어도 개발 환경에서의 console.warn 으로 알 수 없는 필드 타입을 기록하는 것을 검토한다.

---

### [INFO] `chat-channel.dispatcher.ts` `renderNode` 이동 — 기존 주석 "결정적 진단" 이 diff 중간에 노출
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` 라인 ~272~275
- 상세: `renderNode` 호출 블록을 함수 앞쪽으로 이동하는 리팩토링이 포함되어 있고, 그 이후에 "**결정적 진단** (2026-05-25): renderNode 결과 messages 의 개수와 종류 log." 라는 주석이 남아있다. 이 주석은 임시 진단용으로 보이며, 장기 유지보수 코드에 남을 경우 혼란을 줄 수 있다.
- 제안: 임시 진단 주석임을 명시하거나 (`// TODO(2026-05-25): 안정화 후 제거`), 진단이 완료된 시점에 제거한다.

---

### [INFO] `types.ts` `ChannelMessageBody` `form_modal` variant — `formConfig: unknown` 타입
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` 라인 ~2095
- 상세: `{ kind: 'form_modal'; openLabel: string; formConfig: unknown }` 에서 `formConfig` 가 `unknown` 으로 선언되어 있다. 이미 `FormModalField[]` 와 `extractFormFields` 가 있음에도 타입 계약이 `unknown` 으로 남아 있어, 어댑터가 `formConfig` 를 사용할 때마다 캐스팅이 필요하다 (discord.adapter.ts 에서 `(modalMsg.body as { formConfig: unknown }).formConfig` 사용 확인).
- 제안: `formConfig: { fields?: unknown[] } | unknown` 또는 이미 정의된 타입(`Record<string, unknown>`)으로 좁혀 어댑터의 캐스팅 코드를 줄인다. 완전한 타입 안전성을 원하면 `FormConfig` 인터페이스를 별도로 정의하여 `formConfig: FormConfig` 로 선언한다.

---

### [INFO] `form-mode.spec.ts` 동일 `it` 블록 내 두 assertion — 단일 테스트 두 케이스 혼합
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` "Slack: file 포함 시 multi_step / file 없으면 native_modal" 테스트 (라인 ~1739~1756)
- 상세: 하나의 `it` 블록 안에 두 개의 독립적인 `decideFormMode` 호출과 각각의 `expect` 가 포함되어 있다. 테스트 실패 시 어느 케이스가 실패했는지 구분하기 어렵다.
- 제안: 두 케이스를 각각 별도의 `it` 블록으로 분리한다 — "file 포함 → multi_step" / "file 없으면 native_modal".

---

## 요약

전체적으로 이 변경은 `form-mode.ts` 라는 공유 로직 모듈을 도입하여 Slack/Discord 양쪽에서 중복 없이 `decideFormMode` 와 `extractFormFields` 를 재사용하는 설계 선택이 유지보수성 측면에서 올바른 방향이다. 네이밍은 전반적으로 의도를 잘 전달하며, `FormModalField`, `OpenFormModalParams`, `FormSubmissionResult` 등 신규 타입도 적절한 이름을 가진다. 그러나 주요 진입점인 `hooks.service.ts` 의 `form_submission` 처리 블록이 50줄에 달하면서 여러 책임을 동시에 가지고, try-catch 중첩 3단과 `executionId ?? 'ignored'` 패턴 반복이 발생한다. 또한 `discord.adapter.ts` 가 `NATIVE_MODAL_MAX_FIELDS` 상수를 재사용하지 않고 `5` 리터럴을 직접 사용하는 점, `buildFormSubmissionResponse` 에 한국어 문자열을 하드코딩하는 점, `interactionHttpResponse` 접근 시 이중 캐스팅을 사용하는 점이 일관성과 유지보수성을 저하시킨다. Slack parser 의 helper 함수 분리 패턴이 Discord parser 에는 적용되지 않아 좌우 비대칭이 존재하며, `formConfig: unknown` 타입은 호출 지점마다 캐스팅을 강제해 타입 안전성을 약화시킨다.

---

## 위험도

MEDIUM
