# 문서화(Documentation) 리뷰 — chat-channel-form-native-modal

검토 범위: 파일 1–28 (테스트 spec 17개, 구현 소스 11개, plan/review 메타 파일 포함)

---

## 발견사항

### 1. [INFO] `normalizeOptions` 내부 함수에 독스트링 없음
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L88–112
- 상세: `decideFormMode`, `extractFormFields` 두 공개 함수는 모두 상세한 JSDoc 이 있지만, 동일 파일의 비공개 헬퍼 `normalizeOptions` 는 문서가 없다. 이 함수는 `string | {label,value} | {value:number}` 혼합 입력을 정규화하는 비자명한 로직을 포함하므로 최소한 한 줄 설명이 있으면 유지보수가 쉬워진다.
- 제안: `/** options 배열을 {label,value} 로 정규화. string → label=value, number value → String 변환. 빈 배열이면 undefined 반환. */` 수준의 간단한 JSDoc 추가.

### 2. [INFO] `toInputElement` 내부 함수에 독스트링 없음
- 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts` (추가된 `toInputElement` 함수)
- 상세: `toInputBlock` 은 JSDoc 이 있으나, 그 내부에서 호출하는 `toInputElement` 는 문서가 없다. `switch` 분기가 6 케이스 (`textarea`, `select`, `radio`, `date`, `checkbox`, default) 이며 각 케이스가 서로 다른 Slack Block Kit element type 을 낸다. 동반하는 `toInputBlock` 의 주석이 "block_id = field name, action_id = 'v'" 계약을 설명하지만 `toInputElement` 의 type 매핑 의도 (예: `radio` → `static_select` 를 선택한 이유) 는 기록이 없다.
- 제안: `/** FormModalField.type → Slack input element. radio 는 static_select 로 매핑 (Slack Block Kit radio_buttons 는 checkboxes 와 혼동 방지). action_id = 'v' 상수 (flattenViewStateValues 가 inner key 무관하게 첫 key 읽음). */` 추가.

### 3. [WARNING] `openFormModal` modal 제목·버튼 문구가 하드코딩된 한국어이며 `languageLocale` / `languageHints` 무시
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L264–283, `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts` openFormModal 내 `view` 객체
- 상세: Discord 의 `openFormModal` 에서 modal `title: '양식'`, Slack 에서 `title.text: '양식'` / `submit.text: '제출'` / `close.text: '취소'` 가 하드코딩되어 있다. `resolveFormOpenLabel` 이 `languageHints.formOpenLabel` 을 지원하고 KO/EN default 를 구현했음에도, modal 내부 제목·버튼 문구는 동일한 i18n 체계를 따르지 않는다. 주석에도 이 제한이 명시되지 않았다.
- 제안: JSDoc 에 `// TODO(i18n): modal title·submit·close 문구는 현재 ko 하드코딩. languageHints 확장 필요.` 를 명시하거나, `FORM_OPEN_LABEL_DEFAULTS` 와 같이 `FORM_MODAL_TITLE_DEFAULTS` 를 추가한다. 적어도 주석에 의도적 제한임을 기록해야 한다.

### 4. [WARNING] `decideFormMode` 의 `formMode === 'native_modal'` 경우에 대한 주석 누락
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L36–48
- 상세: 함수 서두 JSDoc 은 `formMode !== 'multi_step'` 가 조건 (b) 임을 말하지만, 실제 구현에서 `formMode === 'native_modal'` 분기를 별도로 처리하지 않고 `'auto'` 와 동일하게 흘러간다 (fields > 5 이면 fallback). 이는 DTO 의 `native_modal: "modal 우선 (미충족 시 다단계 fallback)"` 설명과 일치하지만, 코드 안에서 `native_modal` 이 `auto` 와 동일하게 동작한다는 점이 명시적으로 기록되지 않아 차후 유지보수 시 혼란을 유발할 수 있다.
- 제안: `decideFormMode` 내부에 `// formMode === 'native_modal' 도 'auto' 와 동일 경로 — 조건 미충족 시 multi_step fallback (§4.1 R-CCA-8).` 인라인 주석 추가.

### 5. [INFO] `hooks.service.ts` 의 `form_submission` 검증 실패 시 오류 메시지가 하드코딩
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L347 (`validationError: { message: '입력값을 다시 확인해주세요.' }`)
- 상세: 검증 실패 fallback 메시지가 한국어 하드코딩이다. `languageHints` / `languageLocale` 체계를 따르지 않으며, 이 제한이 주석에 기록되지 않았다. 영어 locale 사용자에게 한국어 오류가 표시된다.
- 제안: JSDoc 또는 인라인 주석에 `// TODO(i18n): 오류 메시지 locale 미적용 — fallback 고정 문구` 명시.

### 6. [INFO] `hooks.controller.ts` 의 `interactionHttpResponse` 처리 — TransformInterceptor 우회 이유 주석이 있으나 테스트 없음이 문서에 미반영
- 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` L229–237
- 상세: 주석이 `TransformInterceptor 래핑 우회 — res.json 으로 직접 전송` 이유를 잘 설명한다. 양호. 다만, `hooks.service.spec.ts` 의 `interactionHttpResponse` 테스트가 controller 레벨의 `res.status().json()` 호출까지 검증하지 않으므로, 통합 검증 범위 한계를 controller 주석에 간략히 기록하면 유익하다 (INFO 수준).
- 제안: `// Integration test TODO: controller 레벨의 res.json 분기는 e2e 테스트에서만 검증 가능.` 추가 고려.

### 7. [INFO] `ChannelConversationState.pendingFormModal` — `formState` 와의 배타성 규약 주석 불완전
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` L2199–2208 (추가된 `pendingFormModal` 필드)
- 상세: JSDoc 은 `multi_step 경로는 본 필드 미사용 (formState 사용)` 을 언급하지만, 두 필드가 동시에 존재할 수 없다는 배타성 보장 방식이 기록되지 않았다. dispatcher 에서 `form_modal` 결과 시 `state.formState = undefined` 로 명시적 초기화함이 테스트로 검증되어 있으나, 타입 정의 주석에도 `pendingFormModal 설정 시 formState 는 undefined 로 clear (dispatcher §4.1 분기)` 를 기록하면 타입만 보는 소비자가 규약을 이해하기 쉽다.
- 제안: `pendingFormModal` 필드 JSDoc 에 배타성 보장 한 줄 추가.

### 8. [INFO] `discord.adapter.ts openFormModal` — `fields.slice(0, 5)` 의 근거 주석 누락
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` L266
- 상세: `.slice(0, 5)` 가 Discord MODAL 의 5 TEXT_INPUT hard limit 때문임을 메서드 JSDoc 이 언급하지 않는다 (클래스 수준 주석 `TEXT_INPUT only` 는 있지만 slice 이유는 없다). `decideFormMode` 가 이미 5 초과 시 `form_modal` 을 내지 않도록 가드하므로 방어적 코드이지만 이유가 주석 없이는 매직 넘버처럼 보인다.
- 제안: `// Discord modal hard limit 5 — decideFormMode 가 이미 가드하므로 여기선 방어적 trim.` 인라인 주석 추가.

### 9. [INFO] `slack-update.parser.ts flattenViewStateValues` — `action_id = 'v'` 상수가 주석에만 언급
- 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack-update.parser.ts` L1246
- 상세: `action_id 는 상수 'v' 라 단일 inner element 만 존재 — 첫 key 의 값을 읽는다.` 는 주석이 있다. 양호. 다만 이 상수가 `toInputElement` 에서 설정한다는 cross-reference 가 없어서 이 파일만 읽으면 왜 'v' 인지, 누가 설정하는지 알기 어렵다.
- 제안: `// 'v' 는 slack.adapter.ts toInputElement 가 모든 element 에 부여하는 상수 action_id.` 한 줄 추가.

### 10. [INFO] 새 `formMode` 값('native_modal', 'auto')에 대한 API 문서(Swagger) 업데이트는 완료됨
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- 상세: `@ApiPropertyOptional` description 과 `enum` 이 세 값 모두 반영되어 있다. API 문서화 관점에서 양호.

### 11. [INFO] `plan/in-progress/chat-channel-form-native-modal.md` — impl 완료 여부 미갱신
- 위치: `plan/in-progress/chat-channel-form-native-modal.md`
- 상세: frontmatter `status: in-progress` 이고 구현이 이 PR 에서 완료되었다면 `plan/complete/` 로 이동(`git mv`) 해야 한다. plan 파일이 아직 in-progress 폴더에 있다는 점은 plan 라이프사이클 규약(`plan-lifecycle.md`) 상 PR 머지 후 완료 처리가 필요함을 의미한다. 리뷰 단계에서 확인 필요.
- 제안: PR 머지 시 `git mv plan/in-progress/chat-channel-form-native-modal.md plan/complete/chat-channel-form-native-modal.md` + frontmatter `status: complete` 갱신.

---

## 요약

이번 변경은 §4.1 native form modal 게이팅을 전면 도입하는 대규모 기능 추가로, 전반적으로 문서화 품질이 높다. 공개 인터페이스(`ChatChannelAdapter`, `FormModalField`, `OpenFormModalParams`, `FormSubmissionResult`, `ChannelCommand`, `ChannelMessageBody`)는 모두 상세한 JSDoc 과 SoT 링크를 갖추고 있으며, 핵심 로직 모듈(`form-mode.ts`)도 조건 (a)–(d) 를 나열한 모듈 수준 주석으로 잘 설명된다. API DTO 의 Swagger description 도 신규 enum 값을 정확히 반영한다. 주요 미비점은 몇 가지 내부 함수(`normalizeOptions`, `toInputElement`)의 독스트링 부재, modal 내 제목·버튼 문구의 i18n 미지원이 문서에 기록되지 않은 점, `pendingFormModal`/`formState` 배타성 규약의 타입 주석 미완성, 그리고 `decideFormMode` 에서 `native_modal` 값이 `auto` 와 동일하게 동작한다는 사실이 코드 내 명시되지 않은 점이다. 이들은 모두 INFO 또는 WARNING 수준이며 기능 정확성을 위협하지 않는다.

---

## 위험도

LOW
