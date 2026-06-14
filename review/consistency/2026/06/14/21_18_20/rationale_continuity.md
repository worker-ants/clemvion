# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/6-presentation/4-form.md` 구현 완료 후 diff (main...HEAD)
검토 범위: `execution-engine.service.ts`, `workflow-errors.ts`, `executions.controller.ts`, `interaction.service.ts`, `interaction.controller.ts`, `websocket.gateway.spec.ts`, `error-codes.ts`, `external-interaction.e2e-spec.ts` 및 관련 spec 의 `## Rationale`

---

## 발견사항

### [INFO] `VALIDATION_FAILED` → `VALIDATION_ERROR` 명칭 변경 — `idempotency.interceptor.ts` 주석 미갱신
- **target 위치**: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 27행, 39행, 130행 주석/docstring
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md § Rationale R8` — `submit_form` 의 field validation 실패는 `400 VALIDATION_ERROR` (idempotency 캐시 제외)로 명기. `§5.1` 에러 표도 `VALIDATION_ERROR` 단일 코드명으로 통일.
- **상세**: 본 diff 는 `interaction.controller.ts` `@ApiBadRequestResponse` 설명을 `'VALIDATION_FAILED'` → `'VALIDATION_ERROR'`로 갱신하고, `interaction.service.ts`·`workflow-errors.ts`·`error-codes.ts` 모두 `VALIDATION_ERROR`를 사용한다. 그러나 `idempotency.interceptor.ts` 의 세 곳 주석(27행 "VALIDATION_FAILED 는 캐시 제외", 39행 "400 VALIDATION_FAILED 응답은 캐시 제외", 130행 "특히 400 VALIDATION_FAILED 는 R8 으로 명시 제외")은 갱신되지 않아 코드베이스 내 용어 불일치가 남는다. 기능적 동작은 4xx 전체 캐시 제외라 실제 영향 없지만, 코드 내 SoT 표현이 분열된다.
- **제안**: `idempotency.interceptor.ts` 세 곳의 `VALIDATION_FAILED`를 `VALIDATION_ERROR`로 정정하거나, 캐시 제외 로직이 에러 코드 문자열을 직접 비교하지 않아 4xx 전체 적용임을 주석에 명시하는 방향으로 갱신한다.

---

### [INFO] `chat-channel/shared/form-mode.ts` 재사용 — spec SoT 문서화 부재
- **target 위치**: `execution-engine.service.ts` `assertFormSubmissionValid` — `import { extractFormFields, validateFormSubmission } from '../chat-channel/shared/form-mode'`
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` 및 `spec/conventions/chat-channel-adapter.md §4.1` — `validateFormSubmission` / `extractFormFields` 는 chat-channel adapter 의 form 검증 SoT 로 정의되어 있으며, 타 모듈 재사용에 대한 명시적 Rationale 또는 기각 결정이 spec 에 없음.
- **상세**: 현재 `form-mode.ts` 의 SoT 주석(`spec/conventions/chat-channel-adapter.md §4 / §4.1 / R-CCA-8`, `spec/5-system/15-chat-channel.md CCH-MP-03`)은 chat-channel 내부 용도를 가리킨다. 실행 엔진이 이를 재사용하는 것은 spec 에 명시된 기각 결정을 번복하는 것이 아니지만, chat-channel 전용 분류 파일에서 `execution-engine` 이 cross-import 하는 구조 결정의 Rationale 이 어디에도 기록되지 않았다. 향후 `form-mode.ts` 의 chat-channel-specific 변경(예: Discord modal hard limit 반영, `NATIVE_MODAL_MAX_FIELDS` 등)이 실행 엔진 검증에 의도치 않은 영향을 줄 수 있다.
- **제안**: `spec/4-nodes/6-presentation/4-form.md §6.2` 또는 실행 엔진 spec Rationale 에 "publisher 측 form 필드 검증은 `chat-channel/shared/form-mode.ts` 의 `validateFormSubmission`·`extractFormFields` 를 공유 유틸로 재사용 — chat-channel 전용 필드(`minLength`/`maxLength`/`options` 등)와 기본 타입 검증만 포함하고 file MIME/크기 검증은 Planned" 구조 결정을 명시하거나, 해당 유틸을 `shared/form-validation` 등 도메인 중립 위치로 이동하는 후속 안을 plan 에 기록한다.

---

### [INFO] `toHttpDetails()` FIRST-only 정책 — spec 의 `details[]` 배열 표현과 용어 정합
- **target 위치**: `workflow-errors.ts` `FormValidationError.toHttpDetails()` — "현재 단계 FIRST 오류만 surface. `details` 배열 길이 항상 1"
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §5.1` — `details[]` 를 배열로 정의하며, `§R8` / `EIA-IN-10` 에서 배열 형식임을 일관 표기. FIRST-only 정책의 명시적 spec 결정 또는 기각 대안은 현재 Rationale 에 없음.
- **상세**: `details[]` 는 spec 상 복수 오류를 담을 수 있는 배열이나, 구현은 항상 길이 1로 고정한다. 이 정책은 기능적으로 문제없으나, "복수 오류 배열 대신 FIRST-only" 선택의 배경 Rationale 이 spec 에 부재하다. chat-channel `validateFormSubmission` 도 첫 오류만 반환하므로 구현 일관성은 있으나, 향후 다중 오류 응답 요청이 들어올 때 spec 의 설계 의도가 불명확할 수 있다.
- **제안**: `spec/5-system/14-external-interaction-api.md §5.1` 또는 form spec Rationale 에 "v1 은 FIRST 오류만 surface (chat-channel `validateFormSubmission` 재사용 정책상 일관). 복수 오류 배열은 향후 스펙 개정 시 확장 가능" 문구를 추가한다.

---

## 요약

이번 구현 diff 는 `spec/5-system/14-external-interaction-api.md §5.1 / EIA-IN-10` 이 정의한 `400 VALIDATION_ERROR + details[{field,message,code:'INVALID_FIELD'}]` 계약과 `spec/4-nodes/6-presentation/4-form.md §4·§6.2` 의 publisher 측 field 검증 + waiting_for_input 유지 원칙을 모두 충실히 따르고 있다. 명시적으로 기각된 대안의 재도입이나 합의된 invariant 위반은 없다. 발견된 세 항목은 모두 INFO 수준으로, 첫째는 `idempotency.interceptor.ts` 주석에 남아있는 구 코드명(`VALIDATION_FAILED`) 불일치, 둘째는 chat-channel 전용 모듈을 실행 엔진이 cross-import 하는 구조 결정의 Rationale 부재, 셋째는 `details[]` FIRST-only 정책의 명시적 spec 기록 부재다. 기능 정합성과 기존 Rationale 연속성에는 문제가 없으며, INFO 항목들은 미래 유지보수 명확성 향상을 위한 보완 제안이다.

## 위험도

LOW
