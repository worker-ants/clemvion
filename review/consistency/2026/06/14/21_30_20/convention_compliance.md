# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/6-presentation/4-form.md` 구현 변경 (EIA form validation — `codebase/backend`)

---

## 발견사항

### [CRITICAL] 사용자 문서 2개 파일에 `VALIDATION_FAILED` + `details.fieldErrors` 잔류

- target 위치:
  - `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` line 283, 298
  - `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` line 272, 287
- 위반 규약: `spec/conventions/error-codes.md §2` (에러 코드 rename = breaking change), EIA spec `spec/5-system/14-external-interaction-api.md §5.1·EIA-IN-10` (정규 코드 `VALIDATION_ERROR`, 응답 shape `error.details[]` `{field,message,code}`)
- 상세:
  - `triggers.mdx` (한국어): `submit_form` 설명에 `400 VALIDATION_FAILED` + `details.fieldErrors` 기재. 실제 구현 및 EIA spec 정규 코드는 `VALIDATION_ERROR`, 응답 키는 `error.details[{field,message,code}]`.
  - `triggers.en.mdx` (영문): 동일 오류 — `VALIDATION_FAILED + details.fieldErrors` 노출.
  - backend diff 가 `VALIDATION_ERROR` 로 전환 완료한 상황에서 user-docs 가 구 코드를 표기하면 외부 클라이언트가 `VALIDATION_FAILED` 로 분기 코드를 작성하는 클라이언트 계약 불일치가 발생한다.
  - 추가로 `details.fieldErrors`는 존재하지 않는 필드명이다 — 실제 shape는 `error.details[{field,message,code}]`.
- 제안:
  - `triggers.mdx` line 283: `VALIDATION_FAILED` → `VALIDATION_ERROR`, `details.fieldErrors` → `error.details[{field,message,code}]`
  - `triggers.mdx` line 298 에러 표 동일 수정
  - `triggers.en.mdx` lines 272, 287 동일 수정

---

### [WARNING] `spec/conventions/chat-channel-adapter.md` 및 `spec/7-channel-web-chat/1-widget-app.md` 에 구 코드 잔류

- target 위치:
  - `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` lines 428, 449, 450
  - `/Volumes/project/private/clemvion/spec/7-channel-web-chat/1-widget-app.md` line 44
- 위반 규약: `spec/conventions/error-codes.md §2` (클라이언트 계약 코드 일관성), EIA spec `§5.1·§R8`
- 상세:
  - `chat-channel-adapter.md` §4.1·§5: `400 VALIDATION_FAILED + fieldErrors` 참조. 실제 응답 키는 `error.details[{field,message,code}]`.
  - `1-widget-app.md` line 44: `fieldErrors 표시` — 동일하게 구 형태 명시.
  - 이 두 파일은 spec 소속이므로 `project-planner` 관할이며 별도 spec 갱신 플랜이 필요하다.
- 제안: `spec/conventions/chat-channel-adapter.md` §4.1·§5 의 `VALIDATION_FAILED + fieldErrors` → `VALIDATION_ERROR + details[]({field,message,code})` 갱신. `spec/7-channel-web-chat/1-widget-app.md` 동일.

---

### [INFO] `INVALID_FIELD` 신설 — 명명 원칙 정합 확인

- target 위치: `codebase/backend/src/nodes/core/error-codes.ts` lines 99-100
- 위반 규약: 없음. `spec/conventions/error-codes.md §1` 의 의미 기반 명명 + `UPPER_SNAKE_CASE` 준수 확인.
- 상세: `INVALID_FIELD`는 `details[].code` 서브코드로 의미 기반·대문자 스네이크 형식을 따른다. `VALIDATION_ERROR`는 `spec/5-system/3-error-handling.md §1.1` 시스템 전역 공용 코드(prefix 없음) 범주와 일치한다.
- 제안: 없음 (정합). 선택적으로 `spec/conventions/error-codes.md` 에 `INVALID_FIELD` 신설 근거 주석을 추가하면 추적성이 개선된다.

---

### [INFO] Swagger `@ApiBadRequestResponse` description-only 사용

- target 위치: `codebase/backend/src/modules/executions/executions.controller.ts` lines 155-158; `interaction.controller.ts` lines 68-71
- 위반 규약: 없음. `spec/conventions/swagger.md §2-4` 의 `@ApiBadRequestResponse` description-only 패턴은 허용.
- 상세: 신규 두 데코레이터 모두 description 문자열만 사용. 규약상 허용이나 일부 기존 엔드포인트가 `type: ErrorResponseDto` 를 병용하는 것과 형식 일관성 차이 있음.
- 제안: 현 상태로 규약 준수. 일관성 향상을 원한다면 `@ApiBadRequestResponse({ type: ErrorResponseDto, description: ... })` 통일 검토 (선택).

---

## 요약

이번 구현 변경은 backend 코드 계층에서 `spec/conventions/error-codes.md`·EIA spec·node-output 규약을 대체로 올바르게 따른다. `idempotency.interceptor.ts` 주석의 구 코드 수정, `FormValidationError.toHttpDetails()` SoT 일원화, `@ApiBadRequestResponse` 추가는 출력 포맷·Swagger 규약과 정합한다. 그러나 사용자 문서 2개 파일(`triggers.mdx`, `triggers.en.mdx`)에 구 코드 `VALIDATION_FAILED` 와 존재하지 않는 `details.fieldErrors` 키가 잔류하고 있어 외부 클라이언트 계약 불일치(CRITICAL)가 발생한다. `spec/conventions/chat-channel-adapter.md`·`spec/7-channel-web-chat/1-widget-app.md` 에도 구 코드 참조가 남아(WARNING) spec 갱신이 병행되어야 한다.

---

## 위험도

HIGH
