# Rationale 연속성 검토 결과

## 발견사항

### [WARNING] chat-channel-adapter.md 의 `VALIDATION_FAILED` + `fieldErrors` 가 구현 변경과 불일치

- **target 위치**: diff 전반 (`idempotency.interceptor.ts` 주석, `interaction.controller.ts` OpenAPI 설명, `executions.controller.ts`, `interaction.service.ts`, frontend docs `triggers.mdx`/`triggers.en.mdx`) 에서 에러 코드를 `VALIDATION_FAILED` → `VALIDATION_ERROR` 로 교체하고, 응답 구조를 `details.fieldErrors` → `error.details[]` 로 변경.
- **과거 결정 출처**:
  - `spec/conventions/chat-channel-adapter.md §4.1 step 5` 및 `§4.2 step 5`: `400 VALIDATION_FAILED` + `fieldErrors` 형식을 명시적으로 사용 (Rationale 절에서 코드 이름 선택 근거를 기록하지 않음).
  - `spec/4-nodes/7-trigger/providers/slack.md §5.3`: `EIA 400 VALIDATION_FAILED` 참조.
- **상세**: `spec/5-system/14-external-interaction-api.md` 의 공식 표(`EIA-IN-10`, §5.1 에러 표, §8.3 예시)와 `## Rationale R8` 은 전부 `VALIDATION_ERROR` + `error.details[]({field,message,code:'INVALID_FIELD'})` 를 채택하고 있다. 구현 diff 는 이 EIA spec 의 결정을 올바르게 따른다. 그러나 `spec/conventions/chat-channel-adapter.md` 와 `spec/4-nodes/7-trigger/providers/slack.md` 는 아직 구 코드 이름을 그대로 담고 있어, spec 간 코드 이름이 분열된 상태다. 구현 자체가 Rationale 을 위반한 것은 아니나 spec 2곳의 갱신 없이 구현만 선행된 상황이며, chat-channel adapter 구현체가 해당 spec 구절을 참조해 응답 코드를 파싱하는 경우 동작 불일치를 초래할 수 있다.
- **제안**: `spec/conventions/chat-channel-adapter.md §4.1 step 5` 와 `§4.2 step 5` 의 `VALIDATION_FAILED` → `VALIDATION_ERROR`, `fieldErrors` → `error.details[]` 로 정정. `spec/4-nodes/7-trigger/providers/slack.md §5.3` 도 동일하게 갱신. 코드 선택 근거(`VALIDATION_ERROR` 는 API 규약 §5.3 기본값이고 EIA Rationale R8 이 이를 채택)를 해당 위치 또는 chat-channel-adapter 의 Rationale 절에 1문장 추가.

### [INFO] `spec/conventions/i18n-userguide.md` 의 `VALIDATION_ERROR` 번역 등재 여부 확인 권장

- **target 위치**: diff 에 포함된 frontend docs (`triggers.mdx`, `triggers.en.mdx`) 는 `VALIDATION_FAILED` → `VALIDATION_ERROR` 로 갱신됨.
- **과거 결정 출처**: `spec/conventions/i18n-userguide.md §P3-C-2` — "user-facing localized" 에러 코드 집합(`backend-labels.test.ts` 자동 가드)에 `GRAPH_VALIDATION_FAILED` 는 등재되어 있으나 `VALIDATION_ERROR` 의 번역 매핑 여부는 명시되지 않음.
- **상세**: 구현 변경이 사용자 대면 에러 코드를 바꾸므로 i18n 매핑 갱신이 누락될 경우 UI 에 영문 코드가 그대로 노출될 수 있다.
- **제안**: `spec/conventions/i18n-userguide.md §P3-C-2` 의 등재 집합에 `VALIDATION_ERROR` 포함 여부 점검 후 미포함 시 추가.

---

## 요약

구현 diff 는 `spec/5-system/14-external-interaction-api.md` 가 공식 채택한 `VALIDATION_ERROR` + `error.details[]` 구조를 올바르게 따르며, EIA `## Rationale R8` 에서도 이 코드 이름을 명시적으로 사용하고 있어 EIA Rationale 연속성 관점에서 충돌이 없다. 핵심 invariant(execution `waiting_for_input` 상태 유지·재제출 가능·publisher 측 publish 전 throw)도 모두 준수되고 있다. 다만 `spec/conventions/chat-channel-adapter.md` 와 `spec/4-nodes/7-trigger/providers/slack.md` 두 곳이 구 코드 이름(`VALIDATION_FAILED`, `fieldErrors`)을 여전히 담고 있어, 해당 spec 이 chat-channel adapter 의 EIA 응답 파싱 로직에 영향을 준다면 동작 불일치를 초래할 수 있다. 이는 기각된 대안의 재도입이 아니라 spec 갱신 누락에 해당하며, 조속한 spec 정정이 권장된다.

## 위험도

LOW
